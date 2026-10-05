/* Route views. Each view(args, qs) returns { html, mount(root), unmount(), title }.
   All content comes from data/manifest.json (see data.js); nothing is hard-coded about episodes. */
(function () {
  'use strict';
  var D = DCE.data, S = DCE.store, P = DCE.player, G = DCE.guard, C = DCE.config;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + ('0' + m).slice(-2) : m) + ':' + ('0' + (s % 60)).slice(-2); }
  function fmtLong(s) { var m = Math.round(s / 60); return m >= 60 ? Math.floor(m / 60) + ' h ' + (m % 60) + ' min' : m + ' min'; }
  function toast(msg) { var t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove('show'); }, 3600); }
  function plural(n, w, ws) { return n + ' ' + (n === 1 ? w : (ws || w + 's')); }
  function partHref(id, t, extra) { return '#/part/' + id + (t != null ? '?t=' + (Math.round(t * 10) / 10) + (extra || '') : ''); }

  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
    fplay: '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#flag-play"/></svg>',
    fpause: '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#flag-pause"/></svg>',
    mark: '<svg viewBox="0 0 64 64" aria-hidden="true"><use href="#flag-mark"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2L7 6l5 4V7a6 6 0 11-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" font-family="Helvetica,Arial">15</text></svg>',
    fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2l5 4-5 4V7a6 6 0 106 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><text x="12" y="16.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" font-family="Helvetica,Arial">15</text></svg>',
    repeat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
    dl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0l-5-5m5 5l5-5M4 20h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4m0 1h12l-2.5 4L17 13H5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2zM12 10v5M12 17.5v.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    img: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 21.5zM4 5.5v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 018 0v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15v-3a8 8 0 0116 0v3M4 15h3v5H5a1 1 0 01-1-1zM20 15h-3v5h2a1 1 0 001-1z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };

  /* ---------- shared components ---------- */
  function thumb(part, extraCls, inner, cover) {
    return '<span class="thumb tile ch' + (part ? part.ch : 1) + (extraCls ? ' ' + extraCls : '') + '"' + (part ? ' data-part="' + part.id + '"' : '') + (cover ? ' data-cover="' + esc(cover) + '"' : '') + '>' +
      '<span class="tile-cross" aria-hidden="true"></span><img alt="" hidden>' + (inner || '') + '</span>';
  }
  function hydrateThumbs(root) {
    if (DCE.flags) DCE.flags.decorate(root);
    var els = root.querySelectorAll('.thumb[data-part]');
    if (!els.length) return;
    function fill(el) {
      var p = D.byId[el.dataset.part], cover = el.dataset.cover, img = el.querySelector('img'); el.removeAttribute('data-part');
      function shown() { img.hidden = false; el.classList.add('has-img'); }
      function viaImage() {
        D.firstImage(p).then(function (im) { if (!im) return; img.onerror = null; img.onload = shown; img.src = D.url(im.src); });
      }
      viaImage(); /* cards use the wide illustration; the square cover (with its text band) is kept for the lock screen and the MP3 */
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); } }); }, { rootMargin: '300px' });
      els.forEach(function (el) { io.observe(el); });
    } else els.forEach(fill);
  }
  function partCard(p) {
    var s = S.getPart(p.id), pct = s && s.dur ? Math.min(100, Math.round(s.pos / s.dur * 100)) : 0;
    if (s && s.finished) pct = 100;
    return '<a class="card" href="#/part/' + p.id + '" data-pid="' + p.id + '">' +
      thumb(p, '', '<span class="badge dur">' + fmt(p.dur) + '</span>' +
        (s && s.finished ? '<span class="badge done">' + I.check + '<span class="sr">Finished</span></span>' : '') +
        '<span class="playhint" aria-hidden="true">' + I.fplay + '</span>' +
        (pct ? '<span class="bar" role="img" aria-label="' + pct + '% played"><i style="width:' + pct + '%"></i></span>' : '')) +
      '<span class="kicker">' + D.partLabel(p) + '</span>' +
      '<span class="ctitle">' + esc(p.title) + '</span>' +
      '<span class="muted small">' + D.pagesLine(p.pagesArr) + (p.quizCount ? ' · ' + plural(p.quizCount, 'question') : '') + '</span></a>';
  }
  function chapterCard(c) {
    var st = S.chapterStats(c.n, D.parts), pct = Math.round(st.frac * 100);
    return '<a class="card chcard" href="#/chapter/' + c.n + '" data-chid="' + c.n + '">' +
      thumb(c.parts[0], '', '<span class="bignum" aria-hidden="true">' + c.n + '</span><span class="badge dur">' + plural(st.total, 'part') + '</span>' +
        '<span class="bar" role="img" aria-label="' + pct + '% of the chapter complete"><i style="width:' + pct + '%"></i></span>', c.cover) +
      '<span class="kicker">' + D.pagesLine(c.pages) + '</span><span class="ctitle">' + esc(c.titleDa) + '</span><span class="muted small">' + esc(c.titleEn) + ' · ' + st.done + ' of ' + st.total + ' finished</span></a>';
  }
  /* Edition wording (always from manifest.source) */
  function editionLong() { return '<i lang="da">' + esc(D.titleDa()) + '</i>, ' + esc(D.edition()) + ' edition'; }
  function basedOn(pages) {
    return '<p class="based">' + I.book + '<span>Based on ' + (pages ? D.pagesLine(pages) + ' of ' : '') + 'the ' + editionLong() + (D.source.editionNote ? ' <span class="muted-n">(' + esc(D.source.editionNote) + ')</span>' : '') + '.</span></p>';
  }
  function updateNote() {
    return '<p class="upd small"><b>Content may change.</b> The ministry may update the learning material. If it does, this site may be out of date. Please check the current edition on the official website: open <a href="https://uim.dk" rel="noopener noreferrer" target="_blank">uim.dk</a> and search for “Indfødsretsprøven”.</p>';
  }
  function editionBox(pages) { return '<div class="edbox">' + basedOn(pages) + updateNote() + '</div>'; }
  function head(opts) {
    return '<section class="page-head dark"><div class="wrap">' + (opts.crumb || '') + (opts.eyebrow ? '<span class="eyebrow">' + opts.eyebrow + '</span>' : '') + '<h1 class="h1">' + opts.h1 + '</h1>' + (opts.lede ? '<p class="lede">' + opts.lede + '</p>' : '') + (opts.extra || '') + '</div></section>';
  }
  function creditOf(im) { return im && (im.illustration || /^Original illustration/i.test(im.credit || '')) ? 'Illustration: IFP Lyd' : (im && im.credit) || ''; }
  var ILL_NOTE = 'The pictures are original illustrations drawn for IFP Lyd, inspired by the pictures in the learning material. They are not the book’s photographs.';
  function aiNote() { return '<p class="ai"><b>These podcasts were made with artificial intelligence (AI).</b> We have not checked every fact. Please check the official learning material. If you notice a mistake, use “Report a mistake” in the player or the footer. It opens GitHub with the details filled in.</p>'; }
  function crumb(items) { return '<nav class="crumb" aria-label="Breadcrumb">' + items.map(function (x, i) { return x[1] ? '<a href="' + x[1] + '">' + esc(x[0]) + '</a>' : '<span aria-current="page">' + esc(x[0]) + '</span>'; }).join(' / ') + '</nav>'; }

  /* ---------- Timeline component ---------- */
  function eraLink(e) {
    var ep = D.epById[e.epId]; if (!ep) return null;
    var part = ep.parts.filter(function (p) { return p.eraAnchors && p.eraAnchors[e.id] != null; })[0] || ep.parts[0];
    var t = part.eraAnchors && part.eraAnchors[e.id];
    return { href: partHref(part.id, t != null ? t : null, t != null ? '&play=1' : ''), t: t, part: part, ep: ep };
  }
  function timelineHTML(full) {
    return '<div class="tl" id="tl">' +
      '<div class="tl-tools"><div class="chips" role="group" aria-label="Filter eras">' +
      Object.keys(D.groups).map(function (g, i) { return '<button class="chip" type="button" data-g="' + g + '" aria-pressed="' + (i === 0) + '">' + D.groups[g] + '</button>'; }).join('') +
      '</div><div class="zoom" role="group" aria-label="Zoom timeline"><button class="icon-btn sm" type="button" data-z="-1" aria-label="Zoom out">' + I.minus + '</button><button class="icon-btn sm" type="button" data-z="1" aria-label="Zoom in">' + I.plus + '</button></div></div>' +
      '<div class="tl-scroll" id="tlScroll"><div class="tl-track" id="tlTrack" role="tablist" aria-label="Eras of Danish history, in order"></div></div>' +
      '<div class="tl-detail" id="tlDetail" role="tabpanel" aria-live="polite"></div>' +
      (full ? '<h2 class="h2">All eras</h2><div class="grid g3" id="eraCards"></div>' : '') + '</div>';
  }
  function mountTimeline(root, full, startId) {
    var zoom = +(S.pref('tlzoom') || 1), group = 'all', sel = startId || D.eras[0].id;
    var track = root.querySelector('#tlTrack'), detail = root.querySelector('#tlDetail');
    function vis() { return D.eras.filter(function (e) { return group === 'all' || e.group === group; }); }
    function eraCardInner(e, i) {
      var l = eraLink(e);
      return '<div class="tl-date" aria-hidden="true"><span>' + e.from + '</span><span class="dash">–</span><span>' + e.to + '</span></div><div class="tl-body"><span class="eyebrow">Era ' + (i + 1) + ' of ' + D.eras.length + ' · ' + e.from + '–' + e.to + (e.pdfSection ? ' · section ' + esc(e.pdfSection) : '') + '</span>' +
        '<h2 class="h3"><span lang="da">' + esc(e.titleDa) + '</span> <span class="muted">· ' + esc(e.titleEn) + '</span></h2><p>' + esc(e.summary) + '</p>' +
        (l ? '<div class="row"><a class="btn red" href="' + l.href + '">' + I.play + (l.t != null ? ' Listen from here (' + fmt(l.t) + ')' : ' Listen to this episode') + '</a><a class="btn ghost" href="#/episode/' + l.ep.id + '">Episode: ' + esc(l.ep.title) + '</a></div>' : '') + '</div>';
    }
    function draw() {
      var list = vis(); if (!list.some(function (e) { return e.id === sel; })) sel = list[0].id;
      track.style.setProperty('--w', Math.round(176 * zoom) + 'px');
      track.innerHTML = list.map(function (e) {
        var on = e.id === sel;
        return '<button class="era" role="tab" type="button" id="t-' + e.id + '" data-id="' + e.id + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" aria-controls="tlDetail">' +
          '<span class="era-date">' + e.from + '–' + e.to + '</span><span class="era-dot" aria-hidden="true"></span><span class="era-label" lang="da">' + esc(e.titleDa) + '</span><span class="era-en">' + esc(e.titleEn) + '</span></button>';
      }).join('');
      var e = D.eras.filter(function (x) { return x.id === sel; })[0], i = D.eras.indexOf(e);
      detail.setAttribute('aria-labelledby', 't-' + e.id);
      detail.innerHTML = '<div class="tl-card">' + eraCardInner(e, i) + '</div>';
      var cards = root.querySelector('#eraCards');
      if (cards) cards.innerHTML = list.map(function (x) {
        var k = D.eras.indexOf(x), l = eraLink(x);
        return '<a class="card erac" href="' + (l ? l.href : '#/chapter/1') + '"><span class="thumb tile ch1"><span class="tile-cross" aria-hidden="true"></span><span class="bigdate" aria-hidden="true">' + x.from + '<small>–' + x.to + '</small></span></span><span class="kicker">Era ' + (k + 1) + ' · section ' + esc(x.pdfSection || '') + '</span><span class="ctitle"><span lang="da">' + esc(x.titleDa) + '</span></span><span class="muted small">' + esc(x.titleEn) + '</span></a>';
      }).join('');
      root.querySelectorAll('.chip').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.g === group); });
    }
    function select(id, focus) {
      sel = id; draw();
      var b = track.querySelector('[data-id="' + id + '"]');
      if (focus) b.focus({ preventScroll: true });
      b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    track.addEventListener('click', function (e) { var b = e.target.closest('.era'); if (b) select(b.dataset.id, true); });
    track.addEventListener('keydown', function (e) {
      var list = vis(), i = list.findIndex(function (x) { return x.id === sel; }), n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = list[Math.min(list.length - 1, i + 1)];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = list[Math.max(0, i - 1)];
      else if (e.key === 'Home') n = list[0]; else if (e.key === 'End') n = list[list.length - 1];
      if (n) { e.preventDefault(); select(n.id, true); }
    });
    root.querySelector('.tl-tools').addEventListener('click', function (e) {
      var c = e.target.closest('.chip'), z = e.target.closest('[data-z]');
      if (c) { group = c.dataset.g; draw(); }
      if (z) { zoom = Math.max(0.6, Math.min(1.8, zoom + (+z.dataset.z) * 0.3)); S.pref('tlzoom', zoom); draw(); var b = track.querySelector('[aria-selected=true]'); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest' }); }
    });
    draw();
  }

  /* ---------- Chapters / topics components ---------- */
  function outlineHTML(openFirst) {
    return '<div class="outline">' + D.chapters.map(function (c) {
      return '<details' + (openFirst && c.n === 1 ? ' open' : '') + '><summary><b>' + c.n + '. ' + esc(c.titleDa) + '</b><span class="muted small">' + plural(c.episodes.length, 'episode') + ' · ' + D.pagesLine(c.pages) + '</span></summary><ol>' +
        c.episodes.map(function (e) { return '<li><a href="#/episode/' + e.id + '">' + esc(e.title) + '</a><span class="muted small">' + plural(e.parts.length, 'part') + ' · ' + D.pagesLine(e.pages) + '</span></li>'; }).join('') + '</ol></details>';
    }).join('') + '</div>';
  }
  function topicsHTML() {
    return D.topics().map(function (t) {
      return '<section class="topic"><h2 class="h3">' + esc(t.title) + '</h2><p class="muted small">' + esc(t.blurb) + '</p><div class="chips big">' +
        t.episodes.map(function (e) { return '<a class="chip" href="#/episode/' + e.id + '"><span class="chip-k">Ch ' + e.ch + '</span>' + esc(e.title) + '</a>'; }).join('') + '</div></section>';
    }).join('');
  }

  /* ---------- Home ---------- */
  function home() {
    return {
      title: 'IFP Lyd: Indfødsretsprøven by ear',
      html: function () {
        var last = D.byId[S.last()], cont = D.parts.filter(function (p) { var s = S.getPart(p.id); return s && !s.finished && s.pos > 3; })
          .sort(function (a, b) { return S.getPart(b.id).updated - S.getPart(a.id).updated; }).slice(0, 4);
        var feat = last || D.parts[0], st = D.stats;
        return '<section class="hero dark"><div class="wrap hero-grid"><div>' +
          '<span class="eyebrow">Indfødsretsprøven by ear</span>' +
          '<h1 class="h1">Learn for the Danish citizenship test, by ear.</h1>' +
          '<p class="lede">' + st.parts + ' short audio parts that follow the official learning material, chapter by chapter. Each part has a transcript that follows the audio, original illustrations and real exam questions. You can also practise the questions in the Quiz, without audio.</p>' +
          '<div class="row"><a class="btn red lg" href="#/part/' + feat.id + '">' + I.play + (last ? ' Continue listening' : ' Start with Chapter 1') + '</a><a class="btn ghost-d lg" href="#/quiz">Practise the quiz</a><a class="btn ghost-d lg" href="#/timeline">Explore the timeline</a></div>' +
          '<div class="hero-ed">' + basedOn() + '</div></div>' +
          '<a class="feature" href="#/part/' + feat.id + '">' + thumb(feat, 'feat-thumb', '', D.coverFor(feat)) + '<span class="feat-play" aria-hidden="true">' + I.fplay + '</span><span class="feat-cap"><span class="kicker-d">' + (last ? 'Continue' : 'Start here') + ' · ' + D.partLabel(feat) + '</span><b>' + esc(feat.title) + '</b></span></a></div></section>' +
          '<div class="wrap">' +
          (cont.length ? '<section class="sec"><div class="sec-head"><h2 class="h2">Continue listening</h2><a class="more" href="#/progress">My learning ' + I.right + '</a></div><div class="grid g4">' + cont.map(partCard).join('') + '</div></section>' : '') +
          '<section class="sec"><div class="sec-head"><h2 class="h2">Browse</h2>' +
          '<div class="seg" role="tablist" aria-label="Browse by"><button role="tab" class="seg-b" data-tab="tl" aria-selected="true">Timeline</button><button role="tab" class="seg-b" data-tab="ch" aria-selected="false">Chapters</button><button role="tab" class="seg-b" data-tab="tp" aria-selected="false">Topics</button></div></div>' +
          '<div id="browse" role="tabpanel"></div></section>' +
          '<section class="sec"><div class="sec-head"><h2 class="h2">The learning material</h2><span class="muted small">' + plural(D.chapters.length, 'chapter') + ' · ' + D.source.pages + ' pages · ' + st.parts + ' parts · about ' + Math.round(st.seconds / 3600) + ' hours of audio</span></div><div class="grid g3">' + D.chapters.map(chapterCard).join('') + '</div></section>' +
          '<section class="sec"><div class="howcard"><div><span class="eyebrow">How to use</span><h2 class="h2">IFP Lyd is a supplement</h2><p>The official learning material is your main source. Use this site to listen and revise on the move, and to check what you remember.</p></div><a class="btn dark lg" href="#/howto">Read how to use it</a></div><div class="quizpromo"><div><span class="eyebrow">Quiz</span><h2 class="h2">Practise ' + st.questions + ' real exam questions</h2><p class="muted">The questions are organised like the podcasts. You see one question at a time, in English, and you can show the Danish original. If you get one wrong, you can jump to the part of the podcast that explains it.</p></div><a class="btn red lg" href="#/quiz">Open the quiz</a></div>' + editionBox() + '</section></div>';
      },
      mount: function (root) {
        hydrateThumbs(root);
        var box = root.querySelector('#browse'), tabs = root.querySelectorAll('.seg-b');
        function show(t) {
          tabs.forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t); });
          if (t === 'tl') { box.innerHTML = '<p class="muted">Chapter 1 is a journey through ' + D.eras.length + ' eras. Choose an era, then listen from the moment it starts. <a href="#/timeline">Open full timeline</a></p>' + timelineHTML(false); mountTimeline(box, false); }
          if (t === 'ch') box.innerHTML = '<p class="muted">This is the same order as the table of contents in the book.</p>' + outlineHTML(true);
          if (t === 'tp') box.innerHTML = '<p class="muted">The same episodes, grouped by theme.</p>' + topicsHTML();
        }
        tabs.forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
        show('tl');
      }
    };
  }
  function timelinePage() {
    return { title: 'Timeline', html: function () {
      return head({ eyebrow: 'Chapter 1 · Danmarks historie', h1: 'History timeline', lede: D.eras.length + ' eras, from ' + D.eras[0].from + ' to today. Each era links to the episode that covers it. Where we know it, the link starts at the exact moment the era begins. Some eras overlap, so they follow the order of the book.' }) +
        '<div class="wrap sec">' + timelineHTML(true) + editionBox(D.chapters[0].pages) + '</div>';
    }, mount: function (root) { mountTimeline(root, true); } };
  }
  function chaptersPage() {
    return { title: 'Chapters', html: function () {
      return head({ eyebrow: 'The learning material', h1: 'Chapters', lede: 'This is the table of contents of the book, as audio. Choose a chapter, then an episode. You can also browse by <a href="#/topics">topic</a>.' }) +
        '<div class="wrap sec"><div class="grid g3">' + D.chapters.map(chapterCard).join('') + '</div>' + '<h2 class="h2 mt">Table of contents</h2>' + outlineHTML(true) + editionBox() + '</div>';
    }, mount: hydrateThumbs };
  }
  function topicsPage() {
    return { title: 'Topics', html: function () {
      return head({ eyebrow: 'Browse by theme', h1: 'Topics', lede: 'Chapters 2 to 6 follow themes, not dates. Here the episodes are grouped by theme. For example, you can find everything about government and courts in one place.' }) +
        '<div class="wrap sec">' + topicsHTML() + '</div>';
    } };
  }

  /* ---------- Chapter ---------- */
  function chapter(p) {
    var c = D.chapters[(+p[0] || 1) - 1] || D.chapters[0];
    return { title: 'Chapter ' + c.n + ': ' + c.titleDa, html: function () {
      var st = S.chapterStats(c.n, D.parts), pct = Math.round(st.frac * 100), mb = c.parts.reduce(function (a, q) { return a + (q.audioBytes || 0); }, 0);
      return '<section class="page-head dark"><div class="wrap">' + crumb([['Home', '#/'], ['Chapters', '#/chapters'], ['Chapter ' + c.n]]) + '<span class="eyebrow">Chapter ' + c.n + ' · ' + esc(c.titleEn) + '</span><h1 class="h1" lang="da">' + esc(c.titleDa) + '</h1>' +
        '<p class="lede">' + esc(c.description || '') + '</p><div class="based-d">' + basedOn(c.pages) + '</div><div class="row"><span class="pill-info">' + plural(st.total, 'part') + '</span><span class="pill-info">' + D.fmtBytes(mb) + ' audio</span><span class="pill-info">' + plural(c.quizCount, 'quiz question') + '</span><span class="pill-info">' + st.done + ' finished · ' + pct + '%</span></div>' +
        '<div class="row mt-s"><a class="btn red" href="#/part/' + c.parts[0].id + '">' + I.play + ' Play chapter</a><a class="btn ghost-d" href="#/quiz/chapter/' + c.n + '">Quiz this chapter</a><a class="btn ghost-d" href="#/downloads">' + I.dl + ' Download</a>' + (c.n === 1 ? '<a class="btn ghost-d" href="#/timeline">View on timeline</a>' : '') + '</div></div></section>' +
        '<div class="wrap"><nav class="chtabs" aria-label="Chapters">' + D.chapters.map(function (x) { return '<a href="#/chapter/' + x.n + '"' + (x.n === c.n ? ' aria-current="page"' : '') + '>Ch ' + x.n + '</a>'; }).join('') + '</nav>' +
        c.episodes.map(function (e) {
          return '<section class="sec tight"><h2 class="h3"><a class="eplink" href="#/episode/' + e.id + '">Episode ' + e.n + ': ' + esc(e.title) + '</a></h2><p class="muted small ep-sub">Based on ' + D.pagesLine(e.pages) + ' of the ' + esc(D.edition()) + ' edition' + (e.pdfSections && e.pdfSections.length ? ' · sections ' + esc(e.pdfSections[0]) + (e.pdfSections.length > 1 ? '–' + esc(e.pdfSections[e.pdfSections.length - 1]) : '') : '') + '</p><div class="grid g4">' + e.parts.map(partCard).join('') + '</div></section>';
        }).join('') + '<div class="sec">' + updateNote() + '</div></div>';
    }, mount: hydrateThumbs };
  }

  /* ---------- Episode page ---------- */
  function episodePage(p) {
    var id = p[0], pt = D.byId[id];
    if (pt) { location.replace('#/part/' + id + (location.hash.indexOf('?') > -1 ? location.hash.slice(location.hash.indexOf('?')) : '')); return { html: '' }; }
    var e = D.epById[id] || D.episodes[0], c = e.chObj;
    return { title: e.title, html: function () {
      var eras = (e.eras || []).map(function (x) { return D.eras.filter(function (y) { return y.id === x; })[0]; }).filter(Boolean);
      var i = D.episodes.indexOf(e), prev = D.episodes[i - 1], next = D.episodes[i + 1];
      return '<section class="page-head dark"><div class="wrap">' + crumb([['Home', '#/'], ['Chapter ' + c.n, '#/chapter/' + c.n], ['Episode ' + e.n]]) + '<span class="eyebrow">Chapter ' + c.n + ' · Episode ' + e.n + (e.pdfSections && e.pdfSections.length ? ' · sections ' + esc(e.pdfSections.join(', ')) : '') + '</span><h1 class="h1">' + esc(e.title) + '</h1>' +
        '<div class="based-d">' + basedOn(e.pages) + '</div><div class="row"><span class="pill-info">' + plural(e.parts.length, 'part') + '</span><span class="pill-info">' + fmtLong(e.parts.reduce(function (a, q) { return a + q.dur; }, 0)) + '</span><span class="pill-info">' + plural(e.quizCount, 'quiz question') + '</span></div>' +
        '<div class="row mt-s"><a class="btn red" href="#/part/' + e.parts[0].id + '">' + I.play + ' Play episode</a><a class="btn ghost-d" href="#/quiz/part/' + e.parts[0].id + '">Practise the questions</a></div></div></section>' +
        '<div class="wrap sec"><h2 class="h2">' + (e.parts.length > 1 ? 'Parts' : 'Part') + '</h2><div class="grid g4">' + e.parts.map(partCard).join('') + '</div>' +
        (eras.length ? '<h2 class="h2 mt">Eras covered</h2><div class="chips big">' + eras.map(function (x) { var l = eraLink(x); return '<a class="chip" href="' + (l ? l.href : '#/timeline') + '"><span class="chip-k">' + x.from + '–' + x.to + '</span><span lang="da">' + esc(x.titleDa) + '</span></a>'; }).join('') + '</div>' : '') +
        '<div class="two mt"><div>' + updateNote() + '</div><div class="row">' + (prev ? '<a class="btn ghost" href="#/episode/' + prev.id + '">' + I.left + ' Previous episode</a>' : '') + (next ? '<a class="btn ghost" href="#/episode/' + next.id + '">Next episode ' + I.right + '</a>' : '') + '</div></div></div>';
    }, mount: hydrateThumbs };
  }

  DCE.views = { aiNote: aiNote, creditOf: creditOf, ILL_NOTE: ILL_NOTE, esc: esc, fmt: fmt, fmtLong: fmtLong, toast: toast, plural: plural, I: I, partHref: partHref, thumb: thumb, hydrateThumbs: hydrateThumbs, partCard: partCard, chapterCard: chapterCard,
    editionLong: editionLong, basedOn: basedOn, updateNote: updateNote, editionBox: editionBox, head: head, crumb: crumb, eraLink: eraLink,
    home: home, timeline: timelinePage, chapters: chaptersPage, topics: topicsPage, chapter: chapter, episode: episodePage };
})();
