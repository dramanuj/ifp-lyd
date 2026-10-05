/* Quiz tab: practice mode without audio, organised like the podcasts (Chapter > Episode > Part).
   Questions are fetched per scope from data/quiz/<partId>.json (only what is needed). The correct answer is
   never rendered before the user chooses. Results are stored through the store (only with consent). */
(function () {
  'use strict';
  var D = DCE.data, S = DCE.store, G = DCE.guard, V = DCE.views, esc = V.esc, fmt = V.fmt, I = V.I, plural = V.plural;
  var sess = null; // current quiz session (memory only)

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function scoreOf(s) { var ok = 0; s.qs.forEach(function (q) { var r = s.res[q.id]; if (r && r.ok) ok++; }); return ok; }
  function listenHref(q) {
    var l = q.learn;
    return '#/part/' + q.partId + (l && l.start != null ? '?t=' + Math.max(0, Math.round((l.start - 0.5) * 10) / 10) + '&le=' + (Math.round(l.end * 10) / 10) + '&play=1&back=quiz' : '?play=1&back=quiz');
  }
  function lastScoreHTML(key) {
    var s = S.quizGetScore(key); if (!s) return '<span class="muted small">You have not tried this yet</span>';
    return '<span class="small">Your last score: <b>' + s.s + '/' + s.n + '</b> (' + Math.round(s.s / s.n * 100) + '%)</span>';
  }
  function loadPartQuiz(p) { G.noteRequest('quiz'); return D.loadQuiz(p.quiz).then(function (j) { return j.questions.map(function (q) { var o = Object.assign({}, q); o.partId = p.id; return o; }); }); }

  /* Start a session; returns a promise. */
  function start(type, id, opts) {
    opts = opts || {};
    var s = { type: type, id: id, qs: [], res: {}, idx: 0, done: false, loading: true, error: null, showDa: !!S.pref('quizda'), limit: opts.limit || 0, label: '', key: null, blocked: false };
    sess = s;
    if (G.blocked()) { s.loading = false; s.blocked = true; return Promise.resolve(s); }
    var p;
    if (type === 'part') {
      var part = D.byId[id]; if (!part) { s.loading = false; s.error = 'Unknown quiz.'; return Promise.resolve(s); }
      s.label = part.title + ' (Ch ' + part.ch + ')'; s.key = 'p:' + id; p = loadPartQuiz(part);
    } else if (type === 'chapter') {
      var c = D.chapters[+id - 1]; if (!c) { s.loading = false; s.error = 'Unknown chapter.'; return Promise.resolve(s); }
      s.label = 'Chapter ' + c.n + ' mix' + (s.limit ? ' (quick ' + s.limit + ')' : ''); s.key = s.limit ? null : 'c:' + c.n;
      p = Promise.all(c.parts.filter(function (x) { return x.quiz; }).map(loadPartQuiz)).then(function (all) { var m = []; all.forEach(function (a) { m = m.concat(a); }); m = shuffle(m); return s.limit ? m.slice(0, s.limit) : m; });
    } else { p = Promise.resolve(opts.qs || []); s.label = opts.label || 'Retry'; s.key = null; }
    return p.then(function (qs) { s.qs = qs; s.loading = false; if (!qs.length) s.error = 'There are no questions for this choice.'; return s; })
      .catch(function () { s.loading = false; s.error = 'The questions could not be loaded. Please check your internet connection and try again.'; return s; });
  }

  /* ---------- weak spots (questions answered wrongly most often) ---------- */
  var WEAK_MAX = 10;
  function weakQuestions(limit) {
    var list = S.quizWeak().slice(0, limit || WEAK_MAX), byPart = {};
    list.forEach(function (w) { var pid = w.id.replace(/-q\d+$/, ''); (byPart[pid] = byPart[pid] || []).push(w.id); });
    return Promise.all(Object.keys(byPart).filter(function (pid) { return D.byId[pid] && D.byId[pid].quiz; }).map(function (pid) { return loadPartQuiz(D.byId[pid]); })).then(function (all) {
      var m = {}; all.forEach(function (a) { a.forEach(function (x) { m[x.id] = x; }); });
      return list.map(function (w) { return m[w.id] ? { q: m[w.id], w: w } : null; }).filter(Boolean);
    });
  }
  function weakHTML() {
    var w = S.quizWeak(), saving = S.canSaveProgress();
    var head = '<section class="weak" id="weak" aria-labelledby="weakH"><h2 class="h3" id="weakH">Your weak spots</h2>';
    if (!w.length) {
      return head + '<p>' + (saving ? 'There is nothing here yet. When you answer a question wrongly, it is saved on this device. It will then appear here, so you can practise it again.' :
        'There is nothing here yet. When you answer a question wrongly, it can be saved on this device, and it will appear here. Saving is switched off at the moment.') + '</p>' +
        (saving ? '' : '<p><button class="btn ghost sm" id="weakConsent" type="button">Change my choice about saving</button></p>') + '</section>';
    }
    return head + '<p>' + plural(w.length, 'question') + ' that you get wrong most often' + (w.length > WEAK_MAX ? '. The ' + WEAK_MAX + ' hardest are shown below' : '') + '.' + (saving ? '' : ' Saving is switched off, so this list is kept only until you close the page.') + '</p>' +
      '<ol class="weaklist" id="weakList" aria-live="polite"><li class="muted small">Loading the questions…</li></ol>' +
      '<p><a class="btn red sm" href="#/quiz/weak">Practise my weak spots (' + Math.min(w.length, WEAK_MAX) + ')</a></p></section>';
  }
  function weakMount(root) {
    var b = root.querySelector('#weakConsent'); if (b) b.onclick = function () { DCE.openConsent(true); };
    var ul = root.querySelector('#weakList'); if (!ul) return;
    weakQuestions(WEAK_MAX).then(function (rows) {
      if (!document.body.contains(ul)) return;
      ul.innerHTML = rows.length ? rows.map(function (r) { return '<li><span>' + esc(r.q.q) + '</span> <span class="muted small">Wrong ' + r.w.wrong + (r.w.wrong === 1 ? ' time' : ' times') + '</span></li>'; }).join('') : '<li class="muted small">The questions could not be loaded.</li>';
    }).catch(function () { ul.innerHTML = '<li class="muted small">The questions could not be loaded.</li>'; });
  }

  /* ---------- hub ---------- */
  function hub() {
    return { title: 'Quiz', html: function () {
      var qs = DCE.quizSummary();
      var resume = sess && !sess.loading && !sess.done && sess.qs.length ? '<div class="callout ok resume"><b>You have a quiz in progress:</b> ' + esc(sess.label) + ' (question ' + (sess.idx + 1) + ' of ' + sess.qs.length + '). <a class="btn red sm" href="#/quiz/resume">Resume</a></div>' : '';
      return V.head({ eyebrow: 'Practice mode, no audio', h1: 'Quiz', lede: 'Practise ' + D.stats.questions + ' real exam questions. They are organised like the podcasts. You see one question at a time, in English. You can also show the Danish original, because the real exam is in Danish.' }) +
        '<div class="wrap sec">' + weakHTML() + resume + '<div class="qsummary"><div><b>' + qs.answered + '</b> of ' + D.stats.questions + ' questions answered' + (qs.answered ? ' · <b>' + Math.round(qs.ok / qs.answered * 100) + '%</b> correct the last time' : '') + '</div><a class="more" href="#/progress">My learning ' + I.right + '</a></div>' +
        V.editionBox() +
        D.chapters.map(function (c) {
          return '<details class="qch"' + (c.n === 1 ? ' open' : '') + '><summary><span><b>Chapter ' + c.n + ' · ' + esc(c.titleDa) + '</b> <span class="muted small">' + esc(c.titleEn) + '</span></span><span class="muted small">' + plural(c.quizCount, 'question') + '</span></summary>' +
            '<div class="qmix"><div>' + lastScoreHTML('c:' + c.n) + '</div><div class="row"><a class="btn red sm" href="#/quiz/chapter/' + c.n + '">Mix all ' + c.quizCount + ' (shuffled)</a><a class="btn ghost sm" href="#/quiz/chapter/' + c.n + '?n=10">Quick 10</a></div></div>' +
            c.episodes.map(function (e) {
              return '<h2 class="h4">Episode ' + e.n + ': ' + esc(e.title) + '</h2><ul class="qlist">' + e.parts.filter(function (p) { return p.quizCount; }).map(function (p) {
                return '<li class="qrow"><div><b>' + (e.parts.length > 1 ? 'Part ' + p.p + ' of ' + e.parts.length : 'Questions') + '</b><span class="muted small"> ' + plural(p.quizCount, 'question') + '</span><br>' + lastScoreHTML('p:' + p.id) + '</div><a class="btn red sm" href="#/quiz/part/' + p.id + '" aria-label="Start quiz: ' + esc(p.title) + '">Start</a></li>';
              }).join('') + '</ul>';
            }).join('') + '</details>';
        }).join('') + '</div>';
    }, mount: weakMount };
  }

  /* ---------- run ---------- */
  function run(args, qs) {
    var kind = args[0], id = args[1], pending = null;
    if (kind === 'resume') { if (!sess) return { html: '', mount: function () { location.replace('#/quiz'); } }; }
    else if (kind === 'part' || kind === 'chapter') pending = start(kind, id, { limit: +qs.n || 0 });
    else if (kind === 'weak') pending = start('missed', null, { label: 'My weak spots', qs: weakQuestions(WEAK_MAX).then(function (rows) { return rows.map(function (r) { return r.q; }); }) });
    else return { html: '', mount: function () { location.replace('#/quiz'); } };
    return { title: 'Quiz', stable: true, html: function () {
      return '<div class="quizpage"><div class="wrap qw"><div id="qbody"></div></div></div>';
    }, mount: function (root) {
      var body = root.querySelector('#qbody');
      function q() { return sess.qs[sess.idx]; }
      function qtopHTML() {
        return '<div class="qtop"><a class="qback" href="#/quiz">' + I.left + ' All quizzes</a><button class="pill sm light" id="daBtn" type="button" aria-pressed="' + sess.showDa + '">Danish original: ' + (sess.showDa ? 'on' : 'off') + '</button></div>';
      }
      function optHTML(o, dao, r, qq) {
        var cls = 'qopt', mark = '', sr = '';
        if (r) {
          if (o.l === qq.answer) { cls += ' right'; mark = I.check; sr = '<span class="sr">Correct answer. </span>'; }
          else if (o.l === r.choice) { cls += ' wrong'; mark = I.cross; sr = '<span class="sr">Your answer, incorrect. </span>'; }
          else cls += ' dim';
          if (o.l === r.choice && o.l === qq.answer) sr = '<span class="sr">Your answer, correct. </span>';
        }
        return '<button type="button" class="' + cls + '" data-l="' + esc(o.l) + '"' + (r ? ' aria-disabled="true"' : '') + '><span class="ql" aria-hidden="true">' + esc(o.l) + '</span><span class="qt">' + sr + esc(o.t) + (sess.showDa && dao ? '<span class="qdat" lang="da">' + esc(dao.t) + '</span>' : '') + '</span><span class="qmark" aria-hidden="true">' + mark + '</span></button>';
      }
      function feedback(qq, r) {
        var ok = r.ok, ansO = qq.options.filter(function (o) { return o.l === qq.answer; })[0], l = qq.learn;
        var listen = '<a class="btn ' + (ok ? 'ghost' : 'red') + '" id="listen" href="' + listenHref(qq) + '">' + I.headphones + (ok ? ' Listen to where this is taught' : ' Listen to the relevant part of the podcast') + '</a>';
        return '<div class="fb ' + (ok ? 'ok' : 'bad') + '"><p class="fb-h">' + (ok ? I.check + '<b>Correct!</b>' : I.cross + '<span><b>Not quite.</b> The correct answer is <b>' + esc(qq.answer) + ': ' + esc(ansO ? ansO.t : qq.answerText) + '</b></span>') + '</p>' +
          (sess.showDa && qq.da ? '<p class="fb-da" lang="da">' + esc(qq.da.answer) + '</p>' : '') +
          (qq.appeared ? '<p class="fb-ap">' + esc(qq.appeared) + '</p>' : '') +
          (l && l.text && !ok ? '<blockquote class="learnq"><span class="small muted">The podcast explains it here (' + fmt(l.start) + ')</span>' + esc(l.text) + '</blockquote>' : '') + '<div class="row">' + listen + '</div></div>';
      }
      function render(focus) {
        if (sess.loading) { body.innerHTML = '<p class="muted ql-load">Loading questions…</p>'; return; }
        if (sess.blocked) { body.innerHTML = '<div class="callout">The quiz is hidden because a robot may be using the site. <button class="link" id="ub" type="button">I am a person</button></div>'; body.querySelector('#ub').onclick = function () { G.unlock(); location.reload(); }; return; }
        if (sess.error) { body.innerHTML = '<div class="callout warn">' + esc(sess.error) + '</div><a class="btn dark" href="#/quiz">Back to quizzes</a>'; return; }
        if (sess.done) return renderSummary();
        var qq = q(), r = sess.res[qq.id], n = sess.qs.length, last = sess.idx === n - 1;
        body.innerHTML = qtopHTML() + '<p class="qscope muted small">' + esc(sess.label) + '</p>' +
          '<div class="qprog"><span>Question ' + (sess.idx + 1) + ' of ' + n + '</span><div class="meter"><i style="width:' + (sess.idx / n * 100) + '%"></i></div></div>' +
          '<h1 class="qtext" id="qtext">' + esc(qq.q) + '</h1>' + (sess.showDa && qq.da ? '<p class="qda" lang="da"><span class="dl">Dansk</span> ' + esc(qq.da.q) + '</p>' : '') +
          '<div class="qopts" role="group" aria-labelledby="qtext">' + qq.options.map(function (o, i) { return optHTML(o, qq.da && qq.da.options[i], r, qq); }).join('') + '</div>' +
          '<p class="small muted qhint">Keyboard: ' + qq.options.map(function (o, i) { return '<kbd>' + (i + 1) + '</kbd>/<kbd>' + esc(o.l) + '</kbd>'; }).join(' ') + (r ? ' · <kbd>Enter</kbd> next' : '') + '</p>' +
          '<div class="qfbwrap" role="status" aria-live="polite">' + (r ? feedback(qq, r) : '') + '</div>' +
          '<div class="qnav">' + (r ? '<button class="btn red lg" id="next" type="button">' + (last ? 'See results' : 'Next question') + ' ' + I.right + '</button>' : '<span class="muted small qpick">Choose an answer</span>') + '</div>';
        if (focus === 'next') { var nb = body.querySelector('#next'); if (nb) nb.focus({ preventScroll: false }); }
        else if (focus === 'q') { var h = body.querySelector('#qtext'); h.tabIndex = -1; h.focus({ preventScroll: true }); }
      }
      function choose(l) {
        var qq = q(); if (!qq || sess.res[qq.id]) return;
        if (!qq.options.some(function (o) { return o.l === l; })) return;
        var ok = l === qq.answer; sess.res[qq.id] = { choice: l, ok: ok };
        S.quizRecord(qq.id, ok); render('next');
      }
      function advance() {
        if (!sess.res[q().id]) return;
        if (sess.idx < sess.qs.length - 1) { sess.idx++; render('q'); window.scrollTo(0, 0); }
        else { sess.done = true; var sc = scoreOf(sess); if (sess.key) S.quizScore(sess.key, sc, sess.qs.length); renderSummary(); window.scrollTo(0, 0); }
      }
      function renderSummary() {
        var n = sess.qs.length, sc = scoreOf(sess), pct = Math.round(sc / n * 100), missed = sess.qs.filter(function (x) { var r = sess.res[x.id]; return !r || !r.ok; });
        body.innerHTML = '<div class="qtop"><a class="qback" href="#/quiz">' + I.left + ' All quizzes</a></div><div class="qsum"><span class="eyebrow">Results · ' + esc(sess.label) + '</span><h1 class="qscore" tabindex="-1" id="sumh"><span class="big">' + sc + '</span> / ' + n + '</h1><div class="meter big2" role="img" aria-label="' + pct + ' percent correct"><i style="width:' + pct + '%"></i></div><p class="lede2">' + pct + '% correct. ' + (pct === 100 ? 'Perfect score!' : pct >= 75 ? 'Good work. Look at the questions you missed below.' : 'Keep going. Listen to the parts of the podcast behind the questions you missed.') + '</p>' +
          '<div class="row">' + (missed.length ? '<button class="btn red lg" id="retry" type="button">Retry ' + plural(missed.length, 'missed question') + '</button>' : '') + '<button class="btn ghost lg" id="restart" type="button">Restart</button><a class="btn ghost lg" href="#/quiz">All quizzes</a></div></div>' +
          (missed.length ? '<h2 class="h2 mt">Missed questions</h2><ul class="missed">' + missed.map(function (x) { var a = x.options.filter(function (o) { return o.l === x.answer; })[0]; return '<li><p><b>' + esc(x.q) + '</b></p><p class="muted small">Correct: ' + esc(x.answer) + ': ' + esc(a ? a.t : x.answerText) + (sess.res[x.id] ? '' : ' (skipped)') + '</p><a class="btn ghost sm" href="' + listenHref(x) + '">' + I.headphones + ' Listen to the relevant part</a></li>'; }).join('') + '</ul>' : '');
        var rb = body.querySelector('#retry');
        if (rb) rb.onclick = function () { var lb = 'Retry missed: ' + sess.label.replace(/^Retry missed: /, ''); var pr = start('missed', null, { qs: shuffle(missed), label: lb }); render(); pr.then(function () { render('q'); }); };
        body.querySelector('#restart').onclick = function () {
          var t = sess.type, i = sess.id, lim = sess.limit, qs0 = sess.qs, lb = sess.label;
          var pr = t === 'missed' ? start('missed', null, { qs: shuffle(qs0), label: lb }) : start(t, i, { limit: lim });
          render(); pr.then(function () { render('q'); });
        };
        body.querySelector('#sumh').focus({ preventScroll: true });
      }
      body.addEventListener('click', function (e) {
        var o = e.target.closest('.qopt'); if (o) { choose(o.dataset.l); return; }
        if (e.target.closest('#next')) { advance(); return; }
        var d = e.target.closest('#daBtn'); if (d) { sess.showDa = !sess.showDa; S.pref('quizda', sess.showDa); render(); var b = body.querySelector('#daBtn'); if (b) b.focus(); }
      });
      function keys(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || !sess || sess.loading || sess.done || sess.error || sess.blocked) return;
        if (e.target.closest('input,textarea,select')) return;
        var qq = q(); if (!qq) return; var k = e.key, r = sess.res[qq.id];
        if (!r) {
          var l = null; if (/^[1-9]$/.test(k)) { var o = qq.options[+k - 1]; l = o && o.l; } else if (/^[a-zA-Z]$/.test(k)) l = k.toUpperCase();
          if (l && qq.options.some(function (o) { return o.l === l; })) { e.preventDefault(); choose(l); }
        } else if (k === 'ArrowRight' || k === 'n' || (k === 'Enter' && !e.target.closest('a,button'))) { e.preventDefault(); advance(); }
      }
      document.addEventListener('keydown', keys);
      this._off = function () { document.removeEventListener('keydown', keys); };
      if (pending) { render(); pending.then(function () { if (document.body.contains(body)) render('q'); }); } else render('q');
    }, unmount: function () { if (this._off) this._off(); } };
  }
  DCE.views.quiz = function (args, qs) { return args.length ? run(args, qs) : hub(); };
})();
