/* The part page = the player: audio, synced transcript with spoiler-free quiz answers, images, controls. */
(function () {
  'use strict';
  var D = DCE.data, S = DCE.store, P = DCE.player, G = DCE.guard, V = DCE.views, esc = V.esc, fmt = V.fmt, I = V.I;
  var reduce = function () { return matchMedia('(prefers-reduced-motion: reduce)').matches; };

  function spoken(t) { t = Math.floor(t || 0); var m = Math.floor(t / 60), x = t % 60; return (m ? m + (m === 1 ? ' minute ' : ' minutes ') : '') + x + (x === 1 ? ' second' : ' seconds'); }
  /* "Report a mistake": opens a pre-filled GitHub issue. Nothing is sent until the visitor presses the green button on GitHub. */
  function reportUrl(t) {
    var pt = DCE.reportPart, C = DCE.config, mmss = fmt(t), sec = Math.round(t), site = C.SITE_URL || (location.origin + location.pathname);
    var base = (C.ISSUES_URL || 'https://github.com/dramanuj/ifp-lyd/issues').replace(/\/$/, '') + '/new';
    var title = 'Possible mistake: ' + pt.title + ' at ' + mmss;
    var body = 'Part: ' + pt.id + '\nTime: ' + mmss + ' (' + sec + ' s)\nWhat sounds wrong or is wrong? (please write here)\n\nWhat should it say instead? (please write here)\n\nLink to this moment: ' + site + '#/part/' + pt.id + '?t=' + sec;
    return base + '?title=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(body);
  }
  function part(args, qs) {
    var pt = D.byId[args[0]];
    if (!pt) return V.notfound();
    DCE.reportPart = pt;
    var follow = true, tab = 'tr', progScroll = 0, timer = 0, bState = {}, cueEl = [], lastIdx = -2, offUn = [];
    var tStart = qs.t != null && qs.t !== '' ? Math.max(0, +qs.t) : null, tEnd = qs.le ? +qs.le : null, fromQuiz = qs.back === 'quiz', autoplay = qs.play === '1';
    var ep = pt.epObj, ch = pt.chObj, i0 = D.parts.indexOf(pt), prev = D.parts[i0 - 1], next = D.parts[i0 + 1];
    return {
      title: pt.title, stable: true,
      html: function () {
        var chip = fromQuiz || (tStart != null && tEnd != null);
        return '<section class="stage dark" id="stage"><div class="wrap stage-in' + (chip ? ' withchip' : '') + '">' +
          '<div class="stage-top' + (chip ? ' has-chip' : '') + '"><nav class="crumb" aria-label="Breadcrumb"><a href="#/chapter/' + pt.ch + '">Chapter ' + pt.ch + '</a> / <a href="#/episode/' + ep.id + '">Episode ' + pt.ep + '</a>' + (ep.parts.length > 1 ? ' / <span aria-current="page">Part ' + pt.p + '</span>' : '') + '</nav>' +
          (fromQuiz ? '<a class="chip-back" href="#/quiz/resume">' + I.left + ' Back to quiz</a>' : '') +
          (tStart != null && tEnd != null ? '<button class="pill sm" id="loopBtn" type="button" aria-pressed="false">' + I.repeat + ' Replay this section <span class="muted-d">(' + fmt(tStart) + '–' + fmt(tEnd) + ')</span></button>' : '') + '</div>' +
          '<div class="stage-media" id="media"><div class="imgpanel tile ch' + pt.ch + '" id="imgpanel"><span class="tile-cross" aria-hidden="true"></span><img id="imA" alt=""><img id="imB" alt=""><span class="img-empty" id="imEmpty"><span class="ie-mark" aria-hidden="true">' + I.mark + '</span><span id="imEmptyTxt">No picture at this moment</span></span><canvas id="snap" class="snap" width="1600" height="900" aria-hidden="true" hidden></canvas><button type="button" class="anim-btn" id="animBtn" aria-pressed="false">Pause animation</button></div>' +
          '<div class="capline"><div><span id="cap" class="cap"></span><span id="credit" class="credit"></span></div><span id="pageref" class="pageref"></span></div></div>' +
          '<div class="stage-text"><div class="tabs"><div class="tablist" role="tablist" aria-label="View"><button class="tab" role="tab" data-v="tr" aria-selected="true" id="tabTr" aria-controls="tr">Transcript</button><button class="tab" role="tab" data-v="gal" aria-selected="false" id="tabGal" aria-controls="gal" tabindex="-1">Gallery</button></div>' +
          '<button class="imgtoggle" type="button" id="imgToggle" aria-pressed="true" aria-label="Show picture">' + I.img + '<span>Picture</span></button></div>' +
          '<div class="tr-tools" id="trTools"><span class="tr-note small">' + I.lock + ' Quiz answers stay hidden until they are read out.</span><button class="swbtn" id="revAll" type="button" aria-pressed="false" aria-label="Reveal all answers"><span class="knob" aria-hidden="true"></span><span class="lg" aria-hidden="true">Reveal all answers</span><span class="sh" aria-hidden="true">Answers</span></button></div>' +
          '<div class="tr-wrap"><div class="transcript" id="tr" tabindex="0" role="tabpanel" aria-labelledby="tabTr" aria-label="Transcript, synced to audio"><p class="muted-d tr-load">Loading transcript…</p></div>' +
          '<div class="gallery" id="gal" role="tabpanel" aria-labelledby="tabGal" hidden></div>' +
          '<button class="jump" id="jump" type="button" hidden>Jump to current line</button></div></div>' +
          '<div class="controls" id="controls">' +
          '<div class="now"><div><span class="kicker-d">' + D.partLabel(pt) + '</span><h1 class="ptitle" title="' + esc(pt.title) + '">' + esc(pt.title) + '</h1></div>' +
          '<div class="statuses"><span class="status" id="finBadge" hidden>' + I.check + ' Finished</span></div></div>' +
          '<div class="seek"><span class="t" id="tNow">0:00</span><div class="seekwrap"><input id="seek" type="range" min="0" max="' + (pt.dur || 0) + '" step="0.1" value="0" aria-label="Seek"></div><span class="t" id="tDur">' + fmt(pt.dur) + '</span></div>' +
          '<div class="btnrow main" id="mainRow"><button class="pill" id="rate" type="button"></button>' +
          '<button class="ctl" id="back" type="button" aria-label="Back 15 seconds">' + I.back + '</button>' +
          '<button class="ctl big flag" id="play" type="button" aria-label="Play">' + I.fplay + '</button>' +
          '<button class="ctl" id="fwd" type="button" aria-label="Forward 15 seconds">' + I.fwd + '</button>' +
          '<button class="pill" id="rep" type="button">' + I.repeat + '<span>Repeat</span></button>' +
          '<button class="pill more-btn" id="more" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="sheet" aria-label="More options"><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg><span>More</span></button></div>' +
          '<div class="sheet" id="sheet"><div class="sheet-back" id="sheetBack"></div><div class="sheet-panel" id="sheetPanel"><div class="sheet-grip" id="sheetGrip" aria-hidden="true"></div>' +
          '<div class="sheet-head"><div><span class="kicker-d">' + D.partLabel(pt) + '</span><h2 class="sheet-title" id="sheetTitle">' + esc(pt.title) + '</h2></div><button class="pill sm" id="sheetClose" type="button">Close</button></div>' +
          '<div class="sheet-body"><div class="btnrow sub" id="subRow"><button class="pill sm" id="prev" type="button" aria-label="Previous part"' + (prev ? '' : ' disabled') + '>' + I.left + '<span>Prev</span></button>' +
          '<button class="pill sm" id="quiz" type="button" aria-label="Jump to the exam practice at ' + fmt(pt.quizStart) + '">Quiz <span class="x">· ' + fmt(pt.quizStart) + '</span></button>' +
          '<label class="pill sm sel"><span class="sr">Sleep timer</span><select id="sleep" aria-label="Sleep timer"><option value="0">Sleep</option><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="end">End of part</option></select></label>' +
          '<a class="pill sm flag-pill" id="flag" href="' + esc(reportUrl(0)) + '" target="_blank" rel="noopener noreferrer">' + I.flag + '<span>Report a mistake</span></a>' +
          '<button class="pill sm" id="fin" type="button"></button>' +
          '<button class="pill sm" id="next" type="button" aria-label="Next part"' + (next ? '' : ' disabled') + '><span>Next</span>' + I.right + '</button></div></div></div></div>' +
          '<p class="small notice" id="note" aria-live="polite"></p></div>' +
          '<p class="small ai-line" id="aiLine">These podcasts were made with artificial intelligence (AI). We have not checked every fact. Please check the official learning material. If you notice a mistake, use “Report a mistake” in the player or the footer. It opens GitHub with the details filled in.</p></div></section>' +
          '<div class="wrap sec"><div class="two"><div><h2 class="h2">About this part</h2>' +
          V.basedOn(pt.pagesArr) +
          '<p class="muted">' + (ep.pdfSections && ep.pdfSections.length ? 'Sections ' + esc(ep.pdfSections.join(', ')) + ' of the learning material. ' : '') + (pt.quizCount ? 'It ends with ' + V.plural(pt.quizCount, 'real exam question') + '. ' : '') + 'See <a href="#/about">About</a> to learn how this was made.</p>' +
          '<div class="row"><a class="btn ghost" href="#/quiz/part/' + pt.id + '">Practise these questions (no audio)</a><a class="btn ghost" href="#/episode/' + ep.id + '">Episode page</a></div><div class="mt-s">' + V.updateNote() + '</div>' +
          '<p class="muted small"><b>Keyboard:</b> <kbd>k</kbd> play/pause · <kbd>j</kbd>/<kbd>l</kbd> −/+15 s · <kbd>[</kbd>/<kbd>]</kbd> slower/faster · <kbd>r</kbd> repeat · Enter on a transcript line seeks to it.</p></div>' +
          '<div><h2 class="h2">In this episode</h2><ul class="plist">' + ep.parts.map(function (q) { var s = S.getPart(q.id); return '<li><a href="#/part/' + q.id + '"' + (q.id === pt.id ? ' aria-current="page"' : '') + '>' + (ep.parts.length > 1 ? 'Part ' + q.p + ' · ' : '') + esc(q.title) + '</a><span class="muted small">' + (s && s.finished ? 'Finished' : fmt(q.dur)) + '</span></li>'; }).join('') + '</ul>' +
          '<div id="credits"></div></div></div></div>';
      },
      mount: function (root) {
        var $ = function (s) { return root.querySelector(s); }, tr = $('#tr'), gal = $('#gal'), a = P.audio, imA = $('#imA'), imB = $('#imB'), front = imA, curImg = -2, seeking = false, loopInfo = null;
        document.body.classList.add('on-episode');
        if (tStart != null && tEnd != null && tEnd > tStart) loopInfo = { start: tStart, end: tEnd };
        P.load(pt.id, tStart != null ? { t: tStart, loop: null } : {});
        if (autoplay || tStart != null && qs.play !== '0') a.play().catch(function () { $('#note').textContent = 'Press the play button to start.'; });

        /* ---- transcript ---- */
        function cueHTML(c, i, first) {
          var tag = '';
          if (c.type === 'qnum') tag = '<span class="tag">Quiz · ' + esc(c.text.replace(/\.$/, '')) + '</span>';
          else if (c.block != null && first) tag = '<span class="tag ok">' + I.check + ' Correct answer</span>';
          var body = c.type === 'qnum' ? '' : '<span class="en">' + esc(c.text) + '</span>';
          var da = c.da ? '<span class="da" lang="da"><span class="dl">' + (c.ans ? 'Danish' : 'Danish original') + '</span> ' + esc(c.ans ? '✔ ' + c.da : c.da) + '</span>' : '';
          return '<div class="cuerow"><button type="button" class="cue ' + (c.block != null ? 'answer' : c.type) + '" data-i="' + i + '" data-t="' + c.start + '">' + tag + body + da + '</button>' +
            '<a class="flagbtn" tabindex="-1" data-t="' + c.start + '" href="' + esc(reportUrl(c.start)) + '" target="_blank" rel="noopener noreferrer" aria-label="Report a mistake in this line, at ' + spoken(c.start) + ' (opens GitHub in a new tab)"><span class="rp-t">Report</span></a></div>';
        }
        function maskHTML(b) {
          return '<div class="cue answer masked" data-m="' + b.id + '"><span class="tag lock">' + I.lock + ' Answer hidden</span><span class="en mtxt">Answer revealed when the narrator reads it</span><button type="button" class="revbtn" data-b="' + b.id + '">' + I.eye + ' Reveal this answer</button></div>';
        }
        function blockHTML(b, open) {
          if (!open) return maskHTML(b);
          var h = ''; for (var i = b.first; i <= b.last; i++) h += cueHTML(P.st.cues[i], i, i === b.first); return h;
        }
        function mapBlock(b, open, wrap) {
          if (open) { var bs = wrap.querySelectorAll('.cue'); for (var i = b.first; i <= b.last; i++) cueEl[i] = bs[i - b.first]; }
          else for (var j = b.first; j <= b.last; j++) cueEl[j] = wrap.firstElementChild;
        }
        function buildTranscript() {
          tr.innerHTML = ''; cueEl = []; bState = {}; lastIdx = -2;
          var cues = P.st.cues;
          if (P.st.blocked) {
            tr.innerHTML = '<div class="blocked"><b>The transcript is hidden.</b><p>The site thinks a robot may be using it. If you are a person, you can show the transcript.</p><button class="btn red" id="unlock" type="button">I am a person: show the transcript</button></div>';
            $('#unlock').onclick = function () { G.unlock(); P.load(pt.id); location.reload(); };
            return;
          }
          if (!cues.length) { tr.innerHTML = P.st.dataReady ? '<p class="muted-d tr-load">There is no transcript for this part.</p>' : '<p class="muted-d tr-load">Loading transcript…</p>'; return; }
          var rows = [], i; for (i = 0; i < cues.length; i++) { if (cues[i].block != null) { var b = P.st.blocks[cues[i].block]; rows.push(b); i = b.last; } else rows.push(i); }
          var r = 0, t = a.currentTime;
          (function batch() {
            var end = Math.min(rows.length, r + 14), html = '';
            var frag = document.createElement('div');
            for (; r < end; r++) {
              var row = rows[r];
              if (typeof row === 'number') html += cueHTML(cues[row], row);
              else { var open = P.isRevealed(row, t); bState[row.id] = open; html += '<div class="ablock" data-ab="' + row.id + '">' + blockHTML(row, open) + '</div>'; }
            }
            frag.innerHTML = html;
            while (frag.firstChild) {
              var el = frag.firstChild; tr.appendChild(el);
              if (el.classList.contains('cuerow')) cueEl[+el.firstChild.dataset.i] = el.firstChild;
              else { var bb = P.st.blocks[+el.dataset.ab]; mapBlock(bb, bState[bb.id], el); }
            }
            if (r < rows.length) requestAnimationFrame(batch); else { lastIdx = -2; update(true); }
          })();
        }
        function refreshBlocks(t) {
          var changed = false;
          P.st.blocks.forEach(function (b) {
            var open = P.isRevealed(b, t);
            if (bState[b.id] === undefined || bState[b.id] === open) return;
            var w = tr.querySelector('[data-ab="' + b.id + '"]'); if (!w) return;
            bState[b.id] = open; w.innerHTML = blockHTML(b, open); mapBlock(b, open, w); changed = true;
          });
          if (changed) lastIdx = -2;
        }
        function scrollToEl(el, instant) {
          if (!el) return; progScroll = Date.now();
          var top = el.getBoundingClientRect().top - tr.getBoundingClientRect().top + tr.scrollTop - tr.clientHeight * 0.38 + el.offsetHeight / 2;
          tr.scrollTo({ top: Math.max(0, top), behavior: instant || reduce() ? 'auto' : 'smooth' });
        }
        function setImage(k) {
          if (k === curImg) return; curImg = k;
          var back = front === imA ? imB : imA, im = P.st.images[k];
          $('#imEmpty').style.opacity = k < 0 ? 1 : 0;
          $('#snap').hidden = true;
          if (k >= 0) { back.onload = function () { if (back.dataset.k === String(curImg)) snapshot(); }; back.onerror = function () { if (back.dataset.k === String(curImg)) { back.classList.remove('show'); $('#imEmpty').style.opacity = 1; } }; back.dataset.k = k; back.removeAttribute('src'); back.src = D.url(im.src); back.alt = im.alt || ''; back.classList.add('show'); }
          front.classList.remove('show'); front = back;
          if (k < 0) front.classList.remove('show');
          $('#cap').textContent = k >= 0 ? im.caption || '' : ''; $('#credit').textContent = k >= 0 && V.creditOf(im) ? ' · ' + V.creditOf(im) : '';
          $('#pageref').textContent = k >= 0 && im.page ? 'p. ' + im.page + ' of the learning material' : '';
          gal.querySelectorAll('.gitem').forEach(function (g, j) { g.classList.toggle('on', j === k); if (j === k) g.setAttribute('aria-current', 'true'); else g.removeAttribute('aria-current'); });
        }
        var animOff = S.pref('animpaused'); if (animOff === undefined) animOff = reduce();
        function snapshot() {
          var sn = $('#snap'); if (!animOff) { sn.hidden = true; return; }
          try { sn.getContext('2d').drawImage(front, 0, 0, 1600, 900); sn.hidden = false; } catch (e) { sn.hidden = true; }
        }
        function animUi() { var b = $('#animBtn'); b.setAttribute('aria-pressed', animOff); b.textContent = animOff ? 'Play animation' : 'Pause animation'; b.hidden = !P.st.images.length; }
        $('#animBtn').onclick = function () { animOff = !animOff; S.pref('animpaused', animOff); animUi(); snapshot(); };
        var lastSec = -1;
        function flagLabel(t) { var b = $('#flag'); if (b) { b.setAttribute('aria-label', 'Report a mistake at ' + spoken(t) + ' (opens GitHub in a new tab)'); b.href = reportUrl(t); } }
        function update(instant) {
          var t = a.currentTime, d = P.dur();
          if (P.st.dataReady) refreshBlocks(t);
          var i = P.activeCue(t);
          if (i !== lastIdx && cueEl.length) {
            var prevEl = null;
            cueEl.forEach(function (el, j) {
              if (!el) return; var on = j === i;
              el.classList.toggle('active', on); el.classList.toggle('past', j < i && !on);
              if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
            });
            lastIdx = i; if (follow && cueEl[i]) scrollToEl(cueEl[i], instant);
          }
          setImage(P.activeImage(t));
          if (Math.floor(t) !== lastSec) { lastSec = Math.floor(t); flagLabel(t); }
          var sk = $('#seek'); sk.max = d; if (!seeking) sk.value = t;
          sk.style.setProperty('--p', (d ? t / d * 100 : 0) + '%'); sk.setAttribute('aria-valuetext', fmt(t) + ' of ' + fmt(d));
          $('#tNow').textContent = fmt(t); $('#tDur').textContent = fmt(d);
        }
        function ui() {
          var s = S.getPart(pt.id), cur = P.st.part && P.st.part.id === pt.id, pl = !a.paused && cur;
          $('#play').innerHTML = pl ? I.fpause : I.fplay; $('#play').setAttribute('aria-label', pl ? 'Pause' : 'Play');
          $('#rate').textContent = P.st.rate + '×'; $('#rate').setAttribute('aria-label', 'Playback speed ' + P.st.rate + ' times. Press to change.');
          var m = P.st.repeat; $('#rep span').textContent = (m === 'off' ? 'Repeat' : m === 'part' ? 'Loop part' : 'Loop quiz'); $('#rep').setAttribute('aria-pressed', m !== 'off'); $('#rep').setAttribute('aria-label', 'Repeat: ' + (m === 'off' ? 'off' : m === 'part' ? 'this part' : 'the quiz only') + '. Press to change.'); $('#rep').classList.toggle('on', m !== 'off');
          var fin = !!(s && s.finished); $('#finBadge').hidden = !fin; $('#fin').textContent = fin ? 'Unfinish' : 'Finish'; $('#fin').setAttribute('aria-label', fin ? 'Mark as unfinished' : 'Mark as finished');
          var lb = $('#loopBtn'); if (lb) { var lo = !!P.st.loop; lb.setAttribute('aria-pressed', lo); lb.classList.toggle('on', lo); }
          var msg = '';
          if (P.st.error) msg = 'The audio could not be loaded. Please check your internet connection and reload the page.';
          else {
            if (!S.canSaveProgress()) msg = (S.consent() ? 'Your progress is not being saved, because you said no. ' : 'Your progress is not saved until you choose in the privacy banner. ') + 'Everything else works as normal.';
            else if (P.st.resumed && a.currentTime >= P.st.resumed - 1 && a.currentTime < P.st.resumed + 8) msg = 'Continuing from where you stopped (' + fmt(P.st.resumed) + ').';
            if (P.st.sleepEnd) msg += ' The sleep timer will stop the audio at ' + new Date(P.st.sleepEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.';
            if (P.st.sleepEndOfPart) msg += ' The audio will stop at the end of this part.';
          }
          $('#note').textContent = msg;
          $('#revAll').setAttribute('aria-pressed', P.st.revealAll);
        }
        function buildGallery() {
          var ims = P.st.images;
          $('#media').classList.toggle('noimg', !ims.length);
          $('#imEmptyTxt').textContent = ims.length ? 'No picture at this moment' : 'No pictures for this part';
          gal.innerHTML = ims.length ? ims.map(function (im, k) {
            return '<button type="button" class="gitem" data-k="' + k + '"><img alt="' + esc(im.alt || '') + '" loading="lazy" src="' + esc(D.url(im.src)) + '" onerror="this.style.visibility=\'hidden\'"><span class="gt">' + fmt(im.start) + '</span><span class="gc">' + esc(im.caption || '') + '</span><span class="gp">' + (im.page ? 'p. ' + im.page : '') + (V.creditOf(im) ? ' · ' + esc(V.creditOf(im)) : '') + '</span></button>';
          }).join('') + '<p class="gnote small">' + esc(V.ILL_NOTE) + '</p>' : '<p class="muted-d tr-load">This part has no pictures.</p>';
          var cr = $('#credits');
          var cl = ims.filter(function (im) { return im.credit; });
          cr.innerHTML = cl.length ? '<h2 class="h3 mt-s">Pictures</h2><p class="small muted">' + esc(V.ILL_NOTE) + '</p>' : '';
          curImg = -2; lastIdx = -2; animUi();
        }
        function dataReady() { buildGallery(); buildTranscript(); $('#trTools').hidden = !(P.st.blocks.length) || tab !== 'tr'; ui(); update(true); }
        if (P.st.dataReady && P.st.part.id === pt.id) dataReady(); else { buildGallery(); ui(); update(true); }

        /* ---- events ---- */
        offUn.push(P.on('time', function () { update(false); }), P.on('state', ui), P.on('data', function () { if (P.st.part.id === pt.id) dataReady(); }),
          P.on('reveal', function () { ui(); update(true); }),
          P.on('advance', function (n) { location.hash = '#/part/' + n.id; }));
        timer = setInterval(function () { if (!a.paused) update(false); }, 120);
        tr.addEventListener('click', function (e) {
          var rv = e.target.closest('.revbtn');
          if (rv) { var b = P.st.blocks[+rv.dataset.b]; P.revealBlock(b); refreshBlocks(a.currentTime); update(true); return; }
          var fb = e.target.closest('.flagbtn'); if (fb) return;
          var b2 = e.target.closest('button.cue'); if (!b2) return; follow = true; $('#jump').hidden = true; P.seek(+b2.dataset.t + 0.01); a.play().catch(function () {});
        });
        gal.addEventListener('click', function (e) { var b = e.target.closest('.gitem'); if (!b) return; P.seek(P.st.images[+b.dataset.k].start + 0.01); a.play().catch(function () {}); });
        function userScroll() { if (Date.now() - progScroll < 700) return; follow = false; $('#jump').hidden = tab !== 'tr'; }
        ['wheel', 'touchmove'].forEach(function (ev) { tr.addEventListener(ev, userScroll, { passive: true }); });
        tr.addEventListener('keydown', function (e) { if (['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(e.key) > -1 && e.target === tr) userScroll(); });
        $('#jump').onclick = function () { follow = true; this.hidden = true; scrollToEl(cueEl[lastIdx]); };
        $('#revAll').onclick = function () { P.setRevealAll(!P.st.revealAll); };
        var lb = $('#loopBtn'); if (lb) lb.onclick = function () { P.setLoop(P.st.loop ? null : loopInfo); if (P.st.loop && (a.currentTime < loopInfo.start || a.currentTime >= loopInfo.end)) P.seek(loopInfo.start); if (P.st.loop) a.play().catch(function () {}); };
        ['focus', 'pointerdown', 'click', 'mouseenter'].forEach(function (ev) { $('#flag').addEventListener(ev, function () { flagLabel(a.currentTime); }); });
        tr.addEventListener('focusin', function (e) {
          tr.querySelectorAll('.flagbtn[tabindex="0"]').forEach(function (x) { x.tabIndex = -1; });
          var row = e.target.closest && e.target.closest('.cuerow'); if (row) row.querySelector('.flagbtn').tabIndex = 0;
        });
        $('#play').onclick = function () { if (!P.st.part || P.st.part.id !== pt.id) P.load(pt.id); P.toggle(); };
        $('#back').onclick = function () { P.skip(-15); }; $('#fwd').onclick = function () { P.skip(15); };
        var sk = $('#seek');
        sk.addEventListener('input', function () { seeking = true; P.seek(+this.value); });
        ['change', 'blur', 'pointerup', 'keyup'].forEach(function (ev) { sk.addEventListener(ev, function () { seeking = false; }); });
        sk.addEventListener('keydown', function (e) {
          var d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 30, PageDown: -30 }[e.key];
          if (d) { e.preventDefault(); P.seek(a.currentTime + d); } else if (e.key === 'Home') { e.preventDefault(); P.seek(0); } else if (e.key === 'End') { e.preventDefault(); P.seek(P.dur()); }
        });
        var rates = [0.75, 1, 1.25, 1.5, 1.75, 2];
        $('#rate').onclick = function () { P.setRate(rates[(rates.indexOf(P.st.rate) + 1) % rates.length]); };
        $('#rep').onclick = function () { var m = ['off', 'part', 'quiz']; P.setRepeat(m[(m.indexOf(P.st.repeat) + 1) % 3]); };
        $('#quiz').onclick = function () { P.seek(pt.quizStart); a.play().catch(function () {}); };
        $('#fin').onclick = function () { var s = S.getPart(pt.id); P.markFinished(!(s && s.finished)); };
        $('#sleep').onchange = function () { P.sleep(this.value === 'end' ? 'end' : +this.value); };
        $('#prev').onclick = function () { if (prev) location.hash = '#/part/' + prev.id + '?play=1'; };
        $('#next').onclick = function () { if (next) location.hash = '#/part/' + next.id + '?play=1'; };
        var tabs = root.querySelectorAll('.tab[data-v]');
        function setTab(v) {
          tab = v; tabs.forEach(function (x) { var on = x.dataset.v === v; x.setAttribute('aria-selected', on); x.tabIndex = on ? 0 : -1; });
          tr.hidden = tab !== 'tr'; gal.hidden = tab !== 'gal'; $('#jump').hidden = true; $('#trTools').hidden = !(P.st.blocks.length) || tab !== 'tr';
          if (tab === 'tr' && cueEl[lastIdx]) scrollToEl(cueEl[lastIdx], true);
        }
        tabs.forEach(function (b) { b.onclick = function () { setTab(b.dataset.v); }; b.onkeydown = function (e) { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { var o = tabs[0] === b ? tabs[1] : tabs[0]; setTab(o.dataset.v); o.focus(); } }; });
        $('#imgToggle').onclick = function () { var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', on); $('#media').classList.toggle('collapsed', !on); };
        function keys(e) {
          if (e.key === 'Escape' && sheetOpen) { closeSheet(); return; }
          if (e.target.closest('input,select,textarea,button') && e.key !== 'k' ? e.target.closest('input,select,textarea') : false) return;
          if (e.target.closest('input,select,textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
          if (e.key === 'k') { e.preventDefault(); P.toggle(); } else if (e.key === 'j') P.skip(-15); else if (e.key === 'l') P.skip(15);
          else if (e.key === '[') P.setRate(Math.max(0.75, +(P.st.rate - 0.25).toFixed(2))); else if (e.key === ']') P.setRate(Math.min(2, +(P.st.rate + 0.25).toFixed(2)));
          else if (e.key === 'r') $('#rep').click();
        }
        /* ---- phone layout: docked bar, "More" sheet, transcript sizing ---- */
        var mq = matchMedia('(max-width: 899px)'), sheet = $('#sheet'), panel = $('#sheetPanel'), moreBtn = $('#more'), ctl = $('#controls'), wrapEl = $('.tr-wrap'), docRoot = document.documentElement, sheetOpen = false, ro = null;
        function focusables() { return [].filter.call(panel.querySelectorAll('button,select,a[href]'), function (x) { return !x.disabled && x.offsetParent !== null; }); }
        function openSheet() {
          if (sheetOpen) return; sheetOpen = true; sheet.classList.add('open'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'sheetTitle');
          moreBtn.setAttribute('aria-expanded', 'true'); panel.style.transform = ''; $('#sheetClose').focus();
        }
        function closeSheet(noFocus) {
          if (!sheetOpen) return; sheetOpen = false; sheet.classList.remove('open'); sheet.removeAttribute('role'); sheet.removeAttribute('aria-modal'); sheet.removeAttribute('aria-labelledby');
          moreBtn.setAttribute('aria-expanded', 'false'); if (!noFocus) moreBtn.focus();
        }
        moreBtn.onclick = function () { sheetOpen ? closeSheet() : openSheet(); };
        $('#sheetClose').onclick = function () { closeSheet(); }; $('#sheetBack').onclick = function () { closeSheet(); };
        sheet.addEventListener('keydown', function (e) {
          if (!sheetOpen) return;
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
          if (e.key !== 'Tab') return;
          var f = focusables(); if (!f.length) return; var first = f[0], last = f[f.length - 1];
          if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
          else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
        ['quiz', 'prev', 'next'].forEach(function (id) { $('#' + id).addEventListener('click', function () { closeSheet(true); }); });
        (function swipe() {
          var y0 = null, dy = 0, g = panel.querySelector('.sheet-head'), grip = $('#sheetGrip');
          [g, grip].forEach(function (h) {
            h.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
            h.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
            h.addEventListener('touchend', function () { if (y0 == null) return; y0 = null; if (dy > 70) closeSheet(); else panel.style.transform = ''; });
          });
        })();
        /* Put "Repeat" and the status note where they belong for the current width. */
        function place() {
          var rep = $('#rep'), note = $('#note'), ai = $('#aiLine');
          if (mq.matches) { var sub = $('#subRow'); if (rep.parentNode !== sub) sub.insertBefore(rep, sub.firstChild); if (note.parentNode === ctl) ai.parentNode.insertBefore(note, ai); }
          else { closeSheet(true); var row = $('#mainRow'); if (rep.parentNode !== row) row.insertBefore(rep, moreBtn); if (note.parentNode !== ctl) ctl.appendChild(note); }
          size();
        }
        /* Size the transcript so its bottom sits just above the docked bar. Only measured positions are used (no 100vh). */
        function size() {
          if (!mq.matches) { wrapEl.style.height = ''; docRoot.style.removeProperty('--dock-h'); return; }
          docRoot.style.setProperty('--dock-h', Math.ceil(ctl.getBoundingClientRect().height) + 'px');
          var top = wrapEl.getBoundingClientRect().top + window.pageYOffset, dock = ctl.getBoundingClientRect().top;
          var h = Math.round(dock - top - 14); wrapEl.style.height = Math.max(160, Math.min(h, 640)) + 'px';
        }
        mq.addListener ? mq.addListener(place) : mq.addEventListener('change', place);
        window.addEventListener('resize', size); window.addEventListener('orientationchange', size);
        if (window.ResizeObserver) { ro = new ResizeObserver(size); ro.observe(ctl); ro.observe($('#media')); ro.observe($('#trTools')); }
        if (mq.matches && window.innerHeight < 760) { $('#imgToggle').setAttribute('aria-pressed', 'false'); $('#media').classList.add('collapsed'); }
        place(); setTimeout(size, 400); setTimeout(size, 1500);
        $('#imgToggle').addEventListener('click', function () { setTimeout(size, 0); });
        document.addEventListener('keydown', keys);
        this._off = function () { if (ro) ro.disconnect(); window.removeEventListener('resize', size); window.removeEventListener('orientationchange', size); docRoot.style.removeProperty('--dock-h'); offUn.forEach(function (f) { f(); }); clearInterval(timer); document.removeEventListener('keydown', keys); document.body.classList.remove('on-episode'); if (P.st.loop && !loopInfo) P.setLoop(null); };
      },
      unmount: function () { if (this._off) this._off(); P.st.loop = null; }
    };
  }
  DCE.views.part = part;
})();
