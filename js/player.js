/* Global player: ONE <audio> element for the whole app so playback continues while navigating
   (sticky mini-player). The part page UI lives in views.js and subscribes to events here.
   Also owns: VTT parsing, image cues, quiz JSON (for the spoiler-free transcript), Media Session. */
(function () {
  'use strict';
  var D = DCE.data, S = DCE.store, G = DCE.guard;
  var a = new Audio(); a.preload = 'metadata';
  var st = {
    part: null, cues: [], images: [], blocks: [], quiz: null, repeat: 'off', rate: 1, resumed: 0,
    sleepEnd: 0, sleepEndOfPart: false, sleepStopped: false, blocked: false, loading: false, dataReady: false,
    error: false, loop: null, revealAll: false
  };
  var subs = {}, lastSave = 0, sleepTimer = null, token = 0, pendingStart = null, revealed = {};

  function on(ev, f) { (subs[ev] = subs[ev] || []).push(f); return function () { subs[ev] = (subs[ev] || []).filter(function (x) { return x !== f; }); }; }
  function emit(ev, x) { (subs[ev] || []).forEach(function (f) { try { f(x); } catch (e) { console.error(e); } }); }

  /* ---------- VTT ---------- */
  function sec(s) { var m = String(s).trim().match(/(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0; }
  function parseVTT(txt) {
    var out = [], blocks = txt.replace(/\r/g, '').split(/\n\n+/), afterQ = false;
    blocks.forEach(function (b) {
      var lines = b.split('\n'), i = lines.findIndex(function (l) { return l.indexOf('-->') > -1; });
      if (i < 0) return;
      var t = lines[i].split('-->'), body = lines.slice(i + 1).filter(function (l) { return l !== ''; });
      var cue = { start: sec(t[0]), end: sec(t[1]), text: body[0] || '', da: '', ans: false, type: 'narr' };
      if (body[1] && /^\[DA\]/.test(body[1])) {
        var d = body[1].replace(/^\[DA\]\s*/, '');
        if (/^✔/.test(d)) { cue.ans = true; d = d.replace(/^✔\s*/, ''); }
        cue.da = d;
      }
      if (/^Now it is time for your exam practice/i.test(cue.text)) cue.type = 'quizhead';
      else if (/^Question \d+\./.test(cue.text)) { cue.type = 'qnum'; afterQ = true; }
      else if (/^Option [A-Z]:/.test(cue.text)) { cue.type = 'option'; afterQ = false; }
      else if (afterQ) { cue.type = 'question'; afterQ = false; }
      out.push(cue);
    });
    return out;
  }
  /* Answer blocks = the cues of every quiz answer (spoilers). Ranges come from data/quiz/<partId>.json
     (aStart..aEnd); the VTT markers ("The answer is", "[DA] ✔") are a safety net if the quiz JSON is missing. */
  function buildBlocks(cues, quiz) {
    var masked = cues.map(function () { return false; }), i, q;
    for (i = 0; i < cues.length; i++) {
      var c = cues[i];
      if (/^The answer is\b/i.test(c.text)) { var j = i; while (j < cues.length && !cues[j].ans && j < i + 4) j++; for (var k = i; k <= Math.min(j, cues.length - 1); k++) masked[k] = true; }
      if (c.ans) masked[i] = true;
    }
    var qs = (quiz && quiz.questions) || [];
    qs.forEach(function (qq) {
      if (typeof qq.aStart !== 'number' || typeof qq.aEnd !== 'number') return;
      cues.forEach(function (c, ix) { if (c.start >= qq.aStart - 0.03 && c.start <= qq.aEnd + 0.02) masked[ix] = true; });
    });
    var blocks = [];
    for (i = 0; i < cues.length; i++) {
      if (!masked[i]) continue;
      var f = i; while (i + 1 < cues.length && masked[i + 1]) i++;
      var b = { id: blocks.length, first: f, last: i, reveal: cues[f].start };
      for (var n = 0; n < qs.length; n++) { q = qs[n]; if (typeof q.aStart === 'number' && cues[f].start >= q.aStart - 0.03 && cues[f].start < q.aEnd) { b.reveal = q.aStart; break; } }
      blocks.push(b);
      for (var m = f; m <= i; m++) cues[m].block = b.id;
    }
    return blocks;
  }

  /* ---------- load ---------- */
  function setStart(t) {
    function go() { try { a.currentTime = t; } catch (e) {} tick(); emit('state'); }
    if (a.readyState >= 1) go(); else { pendingStart = t; a.addEventListener('loadedmetadata', function h() { a.removeEventListener('loadedmetadata', h); if (pendingStart === t) go(); }); }
  }
  function load(id, o) {
    o = o || {};
    var part = D.byId[id]; if (!part) return false;
    if (st.part && st.part.id === id) {
      if (o.t != null) { seek(o.t); }
      if (o.loop !== undefined) st.loop = o.loop;
      return true;
    }
    save(true);
    var my = ++token;
    st.part = part; st.cues = []; st.images = []; st.blocks = []; st.quiz = null; st.resumed = 0; st.dataReady = false; st.error = false; st.loading = true; st.blocked = false; st.loop = o.loop || null;
    a.pause(); a.src = D.url(part.audio);
    var s = S.getPart(id), start = 0;
    if (o.t != null) start = o.t;
    else if (s && !s.finished && s.pos > 3 && s.pos < (part.dur || 1e9) - 3) { start = s.pos; st.resumed = start; }
    if (start > 0) setStart(start); else { pendingStart = null; }
    S.setPart(id, { dur: part.dur, noLast: false });
    setMeta(); emit('part', part); emit('state');
    // text data (guarded): transcript, quiz (for answer masking), image cues
    var blockedNow = (function () { G.noteRequest('vtt'); return G.blocked(); })();
    st.blocked = blockedNow;
    var pv = blockedNow ? Promise.resolve('') : D.fetchText(part.transcript).catch(function () { return ''; });
    var pq = blockedNow || !part.quiz ? Promise.resolve(null) : (G.noteRequest('quiz'), D.loadQuiz(part.quiz).catch(function () { return null; }));
    var pi = part.images ? D.fetchJSON(part.images).catch(function () { return { images: [] }; }) : Promise.resolve({ images: [] });
    Promise.all([pv, pq, pi]).then(function (r) {
      if (my !== token) return;
      st.cues = r[0] ? parseVTT(r[0]) : []; st.quiz = r[1]; st.blocks = buildBlocks(st.cues, r[1]);
      st.images = ((r[2] && r[2].images) || []).slice().sort(function (x, y) { return x.start - y.start; });
      st.loading = false; st.dataReady = true; emit('data'); tick();
    });
    return true;
  }
  function dur() { return (a.duration && isFinite(a.duration)) ? a.duration : (st.part ? st.part.dur : 0); }
  function save(force) {
    if (!st.part) return;
    var now = Date.now(); if (!force && now - lastSave < 5000) return; lastSave = now;
    var s = S.getPart(st.part.id) || {}, d = dur(), t = a.currentTime, r = d ? t / d : 0, patch = { pos: t, dur: d };
    if (a.readyState < 1 && !t) return; // metadata not loaded yet: do not overwrite a saved position with 0
    if (r < 0.9) patch.manual = false;
    if (!s.manual && r >= 0.95) patch.finished = true;
    S.setPart(st.part.id, patch);
  }
  function tick() {
    var t = a.currentTime, d = dur();
    if (st.loop && !a.paused && t >= st.loop.end) { a.currentTime = st.loop.start; t = st.loop.start; }
    if (st.repeat === 'quiz' && st.part && d && t >= d - 0.6) { a.currentTime = st.part.quizStart; if (a.paused) a.play().catch(function () {}); }
    if (st.sleepEnd && Date.now() >= st.sleepEnd) { a.pause(); sleep(0); emit('sleep'); }
    save(false); emit('time', { t: t, d: d });
    if ('mediaSession' in navigator && d) { try { navigator.mediaSession.setPositionState({ duration: d, position: Math.min(t, d), playbackRate: a.playbackRate || 1 }); } catch (e) {} }
  }
  a.addEventListener('timeupdate', tick);
  a.addEventListener('seeked', function () { save(true); tick(); });
  a.addEventListener('play', function () { emit('state'); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; });
  a.addEventListener('pause', function () { save(true); emit('state'); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'; });
  a.addEventListener('error', function () { if (a.getAttribute('src')) { st.error = true; emit('state'); } });
  a.addEventListener('loadedmetadata', function () { emit('state'); });
  a.addEventListener('ended', function () {
    if (st.repeat === 'part') { a.currentTime = 0; a.play(); return; }
    if (st.repeat === 'quiz' && st.part) { a.currentTime = st.part.quizStart; a.play(); return; }
    if (st.part) S.setPart(st.part.id, { pos: 0, finished: true, manual: false, dur: dur() });
    var stop = st.sleepEndOfPart; if (stop) sleep(0);
    emit('state'); S.emit();
    var n = st.part && D.nextPart(st.part);
    if (n && !stop) { load(n.id); a.play().catch(function () {}); emit('advance', n); }
  });
  addEventListener('pagehide', function () { save(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) save(true); });

  function setMeta() {
    if (!('mediaSession' in navigator) || !st.part) return;
    var abs = function (p) { return new URL(p, document.baseURI).href; }, part = st.part;
    function set(art) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: part.title, artist: 'IFP Lyd',
          album: 'Chapter ' + part.ch + ': ' + (part.chObj.titleEn || part.chObj.titleDa), artwork: art
        });
      } catch (e) {}
    }
    var icon = [{ src: abs('brand/icon-512.png'), sizes: '512x512', type: 'image/png' }, { src: abs('brand/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }];
    set(icon);
    // Use the square cover art when the file exists; otherwise keep the logo.
    var c = D.coverFor(part);
    if (c) { var im = new Image(); im.onload = function () { if (st.part === part) set([{ src: D.url(c).indexOf('http') === 0 ? D.url(c) : abs(D.url(c)), sizes: '1400x1400', type: 'image/jpeg' }].concat(icon)); }; im.src = D.url(c); }
  }
  if ('mediaSession' in navigator) {
    var H = function (n, f) { try { navigator.mediaSession.setActionHandler(n, f); } catch (e) {} };
    H('play', function () { a.play(); }); H('pause', function () { a.pause(); });
    H('seekbackward', function (d) { skip(-(d && d.seekOffset || 15)); });
    H('seekforward', function (d) { skip(d && d.seekOffset || 15); });
    H('seekto', function (d) { seek(d.seekTime); });
    H('previoustrack', function () { step(-1); }); H('nexttrack', function () { step(1); });
  }
  function step(dir) {
    if (!st.part) return null; var n = D.nextPart(st.part, dir);
    if (n) { load(n.id); a.play().catch(function () {}); }
    return n;
  }
  function toggle() { if (a.paused) return a.play().catch(function () {}); a.pause(); }
  function seek(t) { var d = dur(); a.currentTime = Math.max(0, d ? Math.min(d, t) : t); }
  function skip(d) { seek(a.currentTime + d); }
  function setRate(r) { st.rate = r; a.playbackRate = r; a.defaultPlaybackRate = r; S.pref('rate', r); emit('state'); }
  function setRepeat(m) { st.repeat = m; S.pref('repeat', m); emit('state'); }
  function sleep(min) {
    clearTimeout(sleepTimer); st.sleepEnd = 0; st.sleepEndOfPart = false; st.sleepStopped = false;
    if (min === 'end') st.sleepEndOfPart = true; else if (min) st.sleepEnd = Date.now() + min * 60000;
    emit('state');
  }
  function markFinished(f) {
    if (!st.part) return;
    var cur = S.getPart(st.part.id) || {};
    S.setPart(st.part.id, { finished: f, manual: !f, pos: f ? 0 : (cur.pos || 0), noLast: true });
    emit('state'); S.emit();
  }
  function activeCue(t) {
    var c = st.cues, lo = 0, hi = c.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (c[m].start <= t + 0.05) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  function activeImage(t) {
    var r = -1;
    st.images.forEach(function (im, i) { if (im.start <= t) r = i; });
    if (r >= 0 && st.images[r].end != null && t >= st.images[r].end) r = -1;
    return r;
  }
  /* ---- spoiler control ---- */
  function revKey(b) { return st.part.id + ':' + b.id; }
  function isRevealed(b, t) { return st.revealAll || !!revealed[revKey(b)] || t >= b.reveal; }
  function revealBlock(b) { revealed[revKey(b)] = true; }
  function setRevealAll(v) { st.revealAll = !!v; emit('reveal'); }
  function applyPrefs() {
    var r = S.pref('rate'); if (r) { st.rate = r; a.playbackRate = r; }
    var m = S.pref('repeat'); if (m) st.repeat = m;
  }
  DCE.player = {
    audio: a, st: st, on: on, emit: emit, load: load, toggle: toggle, seek: seek, skip: skip, step: step, setRate: setRate,
    setRepeat: setRepeat, sleep: sleep, markFinished: markFinished, activeCue: activeCue, activeImage: activeImage,
    isRevealed: isRevealed, revealBlock: revealBlock, setRevealAll: setRevealAll, applyPrefs: applyPrefs, dur: dur,
    setLoop: function (l) { st.loop = l; emit('state'); }, parseVTT: parseVTT, buildBlocks: buildBlocks
  };
})();
