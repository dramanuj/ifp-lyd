/* PARKED FEATURE (off unless DCE.config.FLAGS_ENABLED is true). Kept as an extension point; nothing here runs, fetches or
   appears on the site while it is off.
   Crowd-checked flags: "Flag this moment", "Yes, it looks wrong" / "No, it is fine", and the Help check page.
   No text is typed anywhere. Data lives in the owner's free Firebase Realtime Database (see FLAGS-SETUP.md,
   firebase/database.rules.json):  flags/{partId}/{bucket} = { t, confirm:{uid:true}, deny:{uid:true} }, bucket = floor(t/10).
   Reading is a plain fetch. Writing uses the Firebase SDK, loaded lazily (dynamic import) only when someone presses a
   flag or vote button. Two back ends sit behind one small adapter: 'firebase' and 'mock' (localhost + ?flagsmock=1, tests only). */
(function () {
  'use strict';
  var C = DCE.config, S = DCE.store, V = DCE.views, D = DCE.data, esc = V.esc, I = V.I;
  var SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var mockOn = !!C.FLAGS_ENABLED && local && /[?&]flagsmock=1/.test(location.search);
  var tree = null, loadP = null, subs = [], prompted = {}, MAXW = 30, HOUR = 36e5;

  function fbc() { return C.FIREBASE || {}; }
  function configured() { return !!C.FLAGS_ENABLED && (mockOn || !!fbc().databaseURL); }
  function conf() { return C.FLAG_CONFIRM_MIN || 10; }
  function rej() { return C.FLAG_REJECT_MIN || 5; }
  function count(o) { return o ? Object.keys(o).length : 0; }
  function state(c, d) { return d >= rej() ? 'rejected' : c >= conf() ? 'confirmed' : 'pending'; }
  function bucketOf(t) { return String(Math.floor(t / 10)); }
  function notify() { subs.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  /* ---------------- back ends ---------------- */
  var mock = (function () {
    var KEY = 'ifp.mocktree', UK = 'ifp.mockuid', t = null, uid = null;
    function load() { if (t) return; try { t = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {} if (!t) { t = {}; if (/[?&]flagsseed=1/.test(location.search)) seed(); save(); } }
    function save() { try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} }
    function fill(n, p) { var o = {}; for (var i = 0; i < n; i++) o[p + i] = true; return o; }
    function seed() {
      t['ch1-ep1-p1'] = { '12': { t: 125.5, confirm: fill(4, 'seedc') }, '40': { t: 402, confirm: fill(10, 'seedc') }, '60': { t: 605, deny: fill(5, 'seedd'), confirm: fill(1, 'seedc') } };
    }
    function allow(path, val) {
      // Mirrors firebase/database.rules.json
      var part = path[0], b = path[1], node = (t[part] || {})[b];
      if (!/^ch[1-6]-ep[0-9]{1,2}-p[1-9]$/.test(part) || !/^[0-9]{1,3}$/.test(b)) return false;
      if (path.length === 2) { return !node && val && typeof val.t === 'number' && val.t >= 0 && val.t < 7200 && Object.keys(val).every(function (k) { return ['t', 'confirm', 'deny'].indexOf(k) > -1; }) && Object.keys(val.confirm || {}).every(function (k) { return k === uid; }); }
      var kind = path[2], u = path[3], other = kind === 'confirm' ? 'deny' : 'confirm';
      return !!node && (kind === 'confirm' || kind === 'deny') && u === uid && val === true && !(node[kind] && node[kind][u]) && !(node[other] && node[other][u]);
    }
    return {
      read: function () { load(); return Promise.resolve(JSON.parse(JSON.stringify(t))); },
      uid: function () { if (!uid) { try { uid = sessionStorage.getItem(UK); } catch (e) {} if (!uid) { uid = 'mock' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem(UK, uid); } catch (e) {} } } return Promise.resolve(uid); },
      write: function (path, val) {
        load(); return this.uid().then(function () {
          if (!allow(path, val)) return Promise.reject({ denied: true });
          var n = t; for (var i = 0; i < path.length - 1; i++) { n[path[i]] = n[path[i]] || {}; n = n[path[i]]; } n[path[path.length - 1]] = val; save();
          if (window.__mockWrites) window.__mockWrites.push({ path: path.join('/'), val: val });
        });
      }
    };
  })();

  var sdkP = null;
  var firebase = {
    read: function () {
      return fetch(fbc().databaseURL.replace(/\/$/, '') + '/flags.json?shallow=false').then(function (r) { if (!r.ok) throw new Error('read'); return r.json(); });
    },
    sdk: function () {
      if (!sdkP) sdkP = Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-database.js')]).then(function (m) {
        var app = m[0].initializeApp(fbc()), auth = m[1].getAuth(app), c = S.consent();
        // The anonymous ID is kept on this device only if the visitor agreed to saving progress.
        return m[1].setPersistence(auth, c && c.progress ? m[1].browserLocalPersistence : m[1].inMemoryPersistence)
          .then(function () { return m[1].signInAnonymously(auth); })
          .then(function (cred) { return { uid: cred.user.uid, db: m[2].getDatabase(app), ref: m[2].ref, set: m[2].set }; });
      }).catch(function (e) { sdkP = null; throw e; });
      return sdkP;
    },
    uid: function () { return this.sdk().then(function (x) { return x.uid; }); },
    write: function (path, val) {
      return this.sdk().then(function (x) { return x.set(x.ref(x.db, 'flags/' + path.join('/')), val); })
        .catch(function (e) { if (e && (e.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(e.message || ''))) throw { denied: true }; throw e; });
    }
  };
  function be() { return mockOn ? mock : firebase; }

  /* ---------------- local memory: my votes and write attempts ---------------- */
  function myVotes() { return S.pref('flagvotes') || {}; }
  function myVote(part, b) { return myVotes()[part + ':' + b] || null; }
  function setMine(part, b, v) { var m = myVotes(); m[part + ':' + b] = v; S.pref('flagvotes', m); }
  function writes() { return (S.pref('flagwrites') || []).filter(function (x) { return Date.now() - x < HOUR; }); }
  function noteWrite() { var w = writes(); w.push(Date.now()); S.pref('flagwrites', w); }

  /* ---------------- reading ---------------- */
  function load() {
    if (!configured()) return Promise.resolve(null);
    if (!loadP) loadP = be().read().then(function (t) { tree = t || {}; notify(); return tree; }).catch(function () { tree = tree || {}; return tree; });
    return loadP;
  }
  function entry(part, b) { return tree && tree[part] && tree[part][b] || null; }
  function mk(part, b, e) { var c = count(e.confirm), d = count(e.deny); return { part: part, bucket: b, t: +e.t || 0, c: c, d: d, state: state(c, d) }; }
  function forPart(part) { var o = (tree && tree[part]) || {}; return Object.keys(o).map(function (b) { return mk(part, b, o[b]); }); }
  function confirmedCount(partOrIds) {
    var ids = Array.isArray(partOrIds) ? partOrIds : [partOrIds];
    return ids.reduce(function (a, id) { return a + forPart(id).filter(function (x) { return x.state === 'confirmed'; }).length; }, 0);
  }
  function pending() {
    var out = []; Object.keys(tree || {}).forEach(function (p) { if (D.byId[p]) forPart(p).forEach(function (x) { if (x.state === 'pending') out.push(x); }); });
    return out.sort(function (a, b) { return b.c - a.c || a.t - b.t; });
  }

  /* ---------------- writing ---------------- */
  var MSG = {
    off: 'Flagging is not switched on yet.',
    newFlag: 'Thank you. We have noted this moment so that other listeners can check it.',
    confirmed: 'Thank you. You have said that this moment may be wrong.',
    counted: 'Thank you. Your answer has been counted.',
    already: 'You have already voted on this.',
    limit: 'You have done this many times in the last hour. Please try again later.',
    fail: 'Could not send. Please try again.'
  };
  var busy = false;
  function localAdd(part, b, t, kind, uid) {
    tree = tree || {}; tree[part] = tree[part] || {};
    var e = tree[part][b] = tree[part][b] || { t: t };
    e[kind] = e[kind] || {}; e[kind][uid] = true; notify();
  }
  function guard() {
    if (!configured()) { V.toast(MSG.off); return false; }
    if (writes().length >= MAXW) { V.toast(MSG.limit); return false; }
    if (busy) return false;
    return true;
  }
  function done(ok, msg) { busy = false; V.toast(msg); return ok; }
  function fail(e, mine) { return done(false, e && e.denied ? (mine ? MSG.already : MSG.fail) : MSG.fail); }

  function vote(part, b, kind) {
    if (!guard()) return Promise.resolve(false);
    if (myVote(part, b)) return Promise.resolve(done(false, MSG.already));
    busy = true; noteWrite(); var k = kind === 'deny' ? 'deny' : 'confirm', u;
    return be().uid().then(function (uid) { u = uid; var e = entry(part, b); if (e && ((e.confirm && e.confirm[u]) || (e.deny && e.deny[u]))) { setMine(part, b, (e.confirm && e.confirm[u]) ? 'c' : 'd'); throw { denied: true, mine: true }; } return be().write([part, b, k, u], true); })
      .then(function () { setMine(part, b, k === 'deny' ? 'd' : 'c'); localAdd(part, b, 0, k, u); return done(true, MSG.counted); })
      .catch(function (e) { return fail(e, e && e.mine || e && e.denied); });
  }
  function flag(part, t) {
    if (!guard()) return Promise.resolve(false);
    t = Math.round(t * 10) / 10; var b = bucketOf(t);
    if (myVote(part, b)) { V.toast(MSG.already); return Promise.resolve(false); }
    busy = true; noteWrite(); var u;
    return load().then(function () { return be().uid(); }).then(function (uid) {
      u = uid; var e = entry(part, b);
      if (e) return be().write([part, b, 'confirm', u], true).then(function () { setMine(part, b, 'c'); localAdd(part, b, e.t, 'confirm', u); return done(true, MSG.confirmed); });
      var o = { t: t, confirm: {} }; o.confirm[u] = true;
      return be().write([part, b], o).then(function () { setMine(part, b, 'c'); localAdd(part, b, t, 'confirm', u); return done(true, MSG.newFlag); }, function (err) {
        if (!(err && err.denied)) throw err;
        // Someone created this step a moment ago: treat our flag as a confirmation.
        return be().write([part, b, 'confirm', u], true).then(function () { setMine(part, b, 'c'); localAdd(part, b, t, 'confirm', u); return done(true, MSG.confirmed); });
      });
    }).catch(function (e) { return fail(e, true); });
  }

  /* ---------------- decorating cards ---------------- */
  function decorate(root) {
    if (!tree) return;
    root.querySelectorAll('.card[data-pid],.card[data-chid]').forEach(function (a) {
      var old = a.querySelector('.badge.warn'); if (old) old.remove();
      var ids = a.dataset.pid ? [a.dataset.pid] : (D.chapters[+a.dataset.chid - 1] || { parts: [] }).parts.map(function (p) { return p.id; });
      var n = confirmedCount(ids), th = a.querySelector('.thumb');
      if (n && th) th.insertAdjacentHTML('beforeend', '<span class="badge warn" title="Many listeners have flagged ' + n + (n === 1 ? ' moment' : ' moments') + ' here as possibly wrong">' + I.warn + '<span aria-hidden="true">' + n + '</span><span class="sr">' + n + (n === 1 ? ' moment' : ' moments') + ' flagged by many listeners as possibly wrong</span></span>');
    });
  }

  /* ---------------- Help check page ---------------- */
  var rowsP = {};
  function sentenceRows(ch) {
    if (!rowsP[ch]) rowsP[ch] = D.fetchJSON('data/search/ch' + ch + '.json').then(function (a) { var m = {}; a.forEach(function (r) { (m[r[0]] = m[r[0]] || []).push([r[1], r[2]]); }); return m; }).catch(function () { return {}; });
    return rowsP[ch];
  }
  function sentenceAt(map, part, t) { var rows = map[part] || [], r = null; rows.forEach(function (x) { if (x[0] <= t + 0.5) r = x; }); return r && t - r[0] < 25 ? r[1] : null; }

  function check() {
    if (!C.FLAGS_ENABLED) return V.notfound();
    var on = configured(), off = null;
    return { title: 'Help check', stable: true, html: function () {
      return V.head({ eyebrow: 'Help check', h1: 'Help check flagged moments', lede: 'Listeners can flag a moment in a podcast as a possible mistake. Here you can help to check the moments that are still waiting.' }) +
        '<div class="wrap sec prose"><div class="callout"><b>How it works.</b> Nobody types any text. When you press “Flag this moment”, the part and the time are saved. Other listeners then say “Yes, it looks wrong” or “No, it is fine”. When ' + conf() + ' people agree that a moment looks wrong, it is shown in red with a warning. If ' + rej() + ' people say it is fine, it is marked as checked. The owner reviews the flagged moments.</div>' +
        (on ? '<div id="cklist" aria-live="polite"><p class="muted">Loading…</p></div>' : '<div class="callout" role="status"><b>Flagging is not switched on yet.</b></div>') + '</div>';
    }, mount: function (root) {
      if (!on) return;
      var box = root.querySelector('#cklist'), shown = 20, texts = {};
      function draw() {
        var list = pending();
        if (!list.length) { box.innerHTML = '<p>There are no moments waiting to be checked.</p>'; return; }
        box.innerHTML = '<ul class="results ck">' + list.slice(0, shown).map(function (x) {
          var p = D.byId[x.part], mine = myVote(x.part, x.bucket), s = texts[x.part + ':' + x.bucket];
          return '<li data-p="' + esc(x.part) + '" data-b="' + esc(x.bucket) + '"><article><h2 class="h4">' + esc(p.title) + ' <span class="muted small">(' + esc(D.partLabel(p)) + ')</span></h2>' +
            '<p class="small">At <b>' + V.fmt(x.t) + '</b> · <span>' + x.c + ' of ' + conf() + ' confirmations</span></p>' +
            '<p class="cksent">' + (s === undefined ? 'Loading the sentence…' : s ? '“' + esc(s) + '”' : 'This moment is in the quiz section.') + '</p>' +
            '<div class="row"><a class="btn ghost sm" href="#/part/' + esc(x.part) + '?t=' + Math.max(0, Math.floor(x.t - 1)) + '&amp;play=1">Open at this moment</a>' +
            (mine ? '<span class="small muted" role="status">You have voted on this. Thank you.</span>' : '<button type="button" class="btn red sm" data-a="confirm">Yes, it looks wrong</button><button type="button" class="btn ghost sm" data-a="deny">No, it is fine</button>') + '</div></article></li>';
        }).join('') + '</ul>' + (list.length > shown ? '<button class="btn ghost" id="ckmore" type="button">Show more</button>' : '');
        var m = box.querySelector('#ckmore'); if (m) m.onclick = function () { shown += 20; draw(); fetchTexts(); };
      }
      function fetchTexts() {
        pending().slice(0, shown).forEach(function (x) {
          var k = x.part + ':' + x.bucket; if (texts[k] !== undefined) return;
          sentenceRows(D.byId[x.part].ch).then(function (m) { texts[k] = sentenceAt(m, x.part, x.t) || ''; draw(); });
        });
      }
      var off = function () {};
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-a]'); if (!b) return; var li = b.closest('li');
        vote(li.dataset.p, li.dataset.b, b.dataset.a).then(function () { var n = box.querySelector('li[data-p="' + li.dataset.p + '"][data-b="' + li.dataset.b + '"] .row'); draw(); });
      });
      subs.push(draw); this._off = function () { subs = subs.filter(function (f) { return f !== draw; }); };
      load().then(function () { draw(); fetchTexts(); });
    }, unmount: function () { if (this._off) this._off(); } };
  }
  DCE.views.check = check;

  DCE.flags = {
    configured: configured, load: load, flag: flag, vote: vote, forPart: forPart, pending: pending, confirmedCount: confirmedCount,
    myVote: myVote, state: state, bucketOf: bucketOf, decorate: decorate, on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    prompted: prompted, thresholds: function () { return { confirm: conf(), reject: rej() }; }, ready: function () { return !!tree; }
  };
})();
