/* App shell: hash router, theme, consent banner, mini-player. */
(function () {
  'use strict';
  var S = DCE.store, P = DCE.player, D = DCE.data, V = DCE.views, I = V.I, main = document.getElementById('main'), cur = null, curRoute = '';
  var root = document.documentElement, tb = document.getElementById('themeBtn');

  S.init();
  P.applyPrefs();

  /* ---------- theme ---------- */
  var savedTheme = S.pref('theme'); if (savedTheme) root.setAttribute('data-theme', savedTheme);
  function drawTheme() {
    var dark = root.getAttribute('data-theme') === 'dark';
    tb.innerHTML = dark ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    tb.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  tb.onclick = function () { var d = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; root.setAttribute('data-theme', d); S.pref('theme', d); drawTheme(); };
  drawTheme();

  /* ---------- menu + search ---------- */
  var mb = document.getElementById('menuBtn'), nav = document.getElementById('nav');
  mb.onclick = function () { var o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); };
  nav.addEventListener('click', function () { nav.classList.remove('open'); mb.setAttribute('aria-expanded', 'false'); });
  document.getElementById('searchForm').addEventListener('submit', function (e) { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent(document.getElementById('q').value); });

  /* ---------- router ---------- */
  function route() {
    var h = location.hash.replace(/^#\/?/, ''), qs = {}, qi = h.indexOf('?');
    if (qi > -1) { h.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) qs[p[0]] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); h = h.slice(0, qi); }
    var frag = ''; var fi = h.indexOf('#'); if (fi > -1) { frag = h.slice(fi + 1); h = h.slice(0, fi); }
    var seg = h.split('/').filter(Boolean), name = seg[0] || 'home', args = seg.slice(1);
    if (cur && cur.unmount) cur.unmount();
    var fn = V[name]; if (name === 'protect' || typeof fn !== 'function' || ['esc', 'fmt', 'toast', 'plural', 'head', 'crumb', 'aiNote', 'creditOf', 'partHref', 'thumb', 'hydrateThumbs', 'partCard', 'chapterCard', 'editionLong', 'basedOn', 'updateNote', 'editionBox', 'eraLink'].indexOf(name) > -1) fn = V.notfound;
    var view = fn(args, qs);
    cur = view; curRoute = name;
    main.innerHTML = typeof view.html === 'function' ? view.html() : view.html;
    if (view.mount) view.mount(main);
    document.querySelectorAll('#nav a').forEach(function (a) {
      var on = a.dataset.r === name || ((name === 'part' || name === 'episode' || name === 'chapter' || name === 'topics') && a.dataset.r === 'chapters');
      a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0); main.focus({ preventScroll: true });
    if (frag) { var fe = document.getElementById(frag); if (fe) fe.scrollIntoView(); }
    document.title = (view.title ? view.title + ' · ' : '') + 'IFP Lyd' + (view.title ? '' : ': Indfødsretsprøven by ear');
    if (DCE.flags) DCE.flags.decorate(main);
    drawMini();
  }
  addEventListener('hashchange', function () { if (D.ready) route(); });
  S.onChange(function () {
    if (cur && !cur.stable && cur.html && curRoute !== 'search') { var y = scrollY; main.innerHTML = typeof cur.html === 'function' ? cur.html() : cur.html; if (cur.mount) cur.mount(main); scrollTo(0, y); }
    drawMini();
  });

  /* ---------- mini-player ---------- */
  var mini = document.getElementById('mini');
  function drawMini() {
    var p = P.st.part, show = p && curRoute !== 'part';
    mini.hidden = !show; document.body.classList.toggle('has-mini', !!show);
    if (!show) return;
    var playing = !P.audio.paused;
    mini.innerHTML = '<div class="mini-bar"><i id="mpf"></i></div><div class="wrap mini-in"><a class="mini-info" href="#/part/' + p.id + '"><span class="mini-mark" aria-hidden="true">' + I.mark + '</span><span><b>' + V.esc(p.title) + '</b><span class="muted-d small" id="mpt"></span></span></a>' +
      '<div class="mini-ctl"><button class="ctl" id="mb" type="button" aria-label="Back 15 seconds">' + I.back + '</button><button class="ctl big flag" id="mp" type="button" aria-label="' + (playing ? 'Pause' : 'Play') + '">' + (playing ? I.fpause : I.fplay) + '</button><button class="ctl" id="mf" type="button" aria-label="Forward 15 seconds">' + I.fwd + '</button></div></div>';
    mini.querySelector('#mp').onclick = P.toggle; mini.querySelector('#mb').onclick = function () { P.skip(-15); }; mini.querySelector('#mf').onclick = function () { P.skip(15); };
    mt();
  }
  function mt() { var d = P.dur(), t = P.audio.currentTime, f = mini.querySelector('#mpf'), x = mini.querySelector('#mpt'); if (f) f.style.width = (d ? t / d * 100 : 0) + '%'; if (x) x.textContent = V.fmt(t) + ' / ' + V.fmt(d); }
  P.on('time', mt); P.on('state', drawMini); P.on('part', drawMini);

  /* ---------- consent banner ---------- */
  var cb = document.getElementById('consent');
  function openConsent(manage) {
    var c = S.consent() || { progress: false, prefs: false };
    cb.hidden = false;
    cb.innerHTML = '<div class="consent-in"><h2 id="cTitle">Shall we remember where you stopped?</h2><p id="cText">We can save your listening progress, quiz results and settings. They stay <b>only on this device</b>. There are no cookies, and nothing is sent to anyone. If you say no, everything still works, but you start fresh each visit. <a href="#/privacy">Read more</a></p>' +
      '<div class="cm" ' + (manage ? '' : 'hidden') + '><label class="sw"><input type="checkbox" checked disabled><span><b>Your choice (necessary)</b><small>Remembers your choice for 12 months.</small></span></label>' +
      '<label class="sw"><input type="checkbox" id="cp"' + (c.progress ? ' checked' : '') + '><span><b>Progress</b><small>Where you stopped, finished parts and quiz results. Kept for 12 months after you last use the site.</small></span></label>' +
      '<label class="sw"><input type="checkbox" id="cs"' + (c.prefs ? ' checked' : '') + '><span><b>Settings</b><small>Speed, repeat, theme, timeline zoom and quiz language.</small></span></label></div>' +
      '<div class="crow"><button class="btn dark" id="cAcc" type="button">Accept all</button><button class="btn dark" id="cDec" type="button">Decline</button>' +
      (manage ? '<button class="btn ghost" id="cSave" type="button">Save my choice</button>' : '<button class="btn ghost" id="cMan" type="button">Manage</button>') + '</div></div>';
    function done(o, msg) { S.setConsent(o); cb.hidden = true; V.toast(msg); }
    cb.querySelector('#cAcc').onclick = function () { done({ choice: 'all', progress: true, prefs: true }, 'Saved. We will remember your progress and settings.'); };
    cb.querySelector('#cDec').onclick = function () { done({ choice: 'declined', progress: false, prefs: false }, 'Understood. Nothing will be saved.'); };
    var m = cb.querySelector('#cMan'); if (m) m.onclick = function () { openConsent(true); cb.querySelector('#cAcc').focus(); };
    var sv = cb.querySelector('#cSave'); if (sv) sv.onclick = function () { done({ choice: 'custom', progress: cb.querySelector('#cp').checked, prefs: cb.querySelector('#cs').checked }, 'Your choice is saved.'); };
  }
  DCE.openConsent = openConsent;
  if (!S.consent()) openConsent(false);

  /* ---------- boot ---------- */
  D.load().then(function () {
    document.getElementById('footEd').textContent = 'Based on ' + D.editionLine() + (D.source.editionNote ? ' (' + D.source.editionNote + ')' : '') + '. The ministry may update the material, so this site may become out of date. Please check uim.dk.';
    if (DCE.flags.configured()) { DCE.flags.load(); DCE.flags.on(function () { DCE.flags.decorate(main); }); }
    if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#/');
    route();
  }).catch(function (e) {
    console.error(e);
    main.innerHTML = '<div class="wrap sec"><h1 class="h2">The lessons could not be loaded</h1><p class="muted">Please check your internet connection and reload the page. Site owners: make sure the <code>data</code> folder has been uploaded (see HOSTING.md).</p></div>';
  });
})();
