/* Data layer: loads data/manifest.json (see the data contract in README.md) and exposes helpers. */
(function () {
  'use strict';
  var C = DCE.config, cache = {};

  function url(p) { return /^(https?:)?\/\//.test(p) ? p : C.DATA_BASE + p; }
  function fetchJSON(p) {
    if (!cache[p]) cache[p] = fetch(url(p)).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }).catch(function (e) { delete cache[p]; throw e; });
    return cache[p];
  }
  function fetchText(p) { return fetch(url(p)).then(function (r) { if (!r.ok) throw new Error(p + ' ' + r.status); return r.text(); }); }

  var D = DCE.data = { url: url, fetchJSON: fetchJSON, fetchText: fetchText, ready: false };

  D.load = function () {
    return fetchJSON('data/manifest.json').then(function (m) {
      D.manifest = m; D.source = m.source || {};
      D.chapters = m.chapters; D.episodes = []; D.parts = []; D.byId = {}; D.epById = {};
      m.chapters.forEach(function (c) {
        c.parts = [];
        c.episodes.forEach(function (e) {
          e.ch = c.n; e.chObj = c; e.id = e.id || ('ch' + c.n + '-ep' + e.n);
          D.episodes.push(e); D.epById[e.id] = e;
          e.parts.forEach(function (p) {
            p.ch = c.n; p.ep = e.n; p.epId = e.id; p.epObj = e; p.chObj = c;
            p.dur = p.duration; p.pagesArr = p.pages || e.pages; if (!p.title) p.title = e.title;
            D.parts.push(p); c.parts.push(p); D.byId[p.id] = p;
          });
          e.quizCount = e.parts.reduce(function (a, p) { return a + (p.quizCount || 0); }, 0);
        });
        c.quizCount = c.parts.reduce(function (a, p) { return a + (p.quizCount || 0); }, 0);
      });
      D.eras = (m.eras || []).map(function (e) {
        var ep = e.ep || ''; if (ep && ep.indexOf('ch') !== 0) ep = 'ch1-' + ep;
        e.epId = ep; e.group = e.from < 1700 ? 'early' : e.from < 1940 ? 'modern' : 'contemporary'; return e;
      });
      D.groups = { all: 'All eras', early: 'Before 1700', modern: '1700-1940', contemporary: '1940-today' };
      D.stats = {
        parts: D.parts.length, episodes: D.episodes.length,
        questions: D.parts.reduce(function (a, p) { return a + (p.quizCount || 0); }, 0),
        seconds: D.parts.reduce(function (a, p) { return a + (p.duration || 0); }, 0),
        audioBytes: D.parts.reduce(function (a, p) { return a + (p.audioBytes || 0); }, 0)
      };
      D.ready = true; return D;
    });
  };

  /* Edition wording, always taken from the manifest */
  D.titleDa = function () { return (D.source && D.source.titleDa) || 'Læremateriale til Indfødsretsprøven'; };
  D.edition = function () { return (D.source && D.source.edition) || ''; };
  D.editionLine = function () { return D.titleDa() + ', ' + D.edition() + ' edition'; };
  D.pagesLine = function (pg) {
    if (!pg) return '';
    return (pg[0] === pg[1] ? 'p. ' + pg[0] : 'pp. ' + pg[0] + '–' + pg[1]);
  };
  D.nextPart = function (p, dir) { var i = D.parts.indexOf(p) + (dir || 1); return D.parts[i] || null; };
  D.partLabel = function (p) { return 'Ch ' + p.ch + ' · Ep ' + p.ep + (p.epObj.parts.length > 1 ? ' · Part ' + p.p + '/' + p.epObj.parts.length : ''); };

  /* Topics: a grouping of episodes by theme, derived from chapter + English titles in the manifest. */
  var TOPICS = [
    { id: 'history', title: 'History of Denmark', blurb: 'From the Vikings to today.' },
    { id: 'gov', title: 'Government & courts', blurb: 'Democracy, parliament, law, police and the monarchy.' },
    { id: 'welfare', title: 'Welfare & work', blurb: 'The economy, the labour market, taxes, health and education.' },
    { id: 'europe', title: 'Europe & the world', blurb: 'The EU, NATO, the UN, the Nordic countries and the realm.' },
    { id: 'arts', title: 'Arts & culture', blurb: 'Literature, music, film, art, architecture and design.' },
    { id: 'society', title: 'Society & everyday life', blurb: 'Traditions, family, religion, media, housing and daily life.' }
  ];
  var RULES = [
    ['gov', /parliament|folketing|government|court|judicial|law\b|laws\b|constitution|election|democra|monarch|queen|king\b|royal|police|municipal|region|minister|party|parties|rights|citizenship|equality/i],
    ['welfare', /welfare|work|labou?r|employ|econom|tax|pension|unemploy|health|hospital|school|education|business|trade union|flexicurity|job|wage|social|income|energy|agricultur|industry/i],
    ['europe', /europe|\bEU\b|nato|united nations|\bUN\b|nordic|global|foreign|greenland|faroe|realm|world|international|defen[cs]e|military|migration|refugee|immigra/i],
    ['arts', /\bart\b|arts\b|music|film|cinema|literature|literary|theat|paint|architect|design|museum|writer|poet|author|danish golden|radio|television|sport/i]
  ];
  var CH_DEFAULT = { 1: 'history', 2: 'gov', 3: 'welfare', 4: 'europe', 5: 'arts', 6: 'society' };
  D.topicOf = function (e) {
    if (e.ch === 1) return 'history';
    if (e.ch === 6) { for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(e.title)) return RULES[i][0]; return 'society'; }
    return CH_DEFAULT[e.ch] || 'society';
  };
  D.topics = function () {
    return TOPICS.map(function (t) { return { id: t.id, title: t.title, blurb: t.blurb, episodes: D.episodes.filter(function (e) { return D.topicOf(e) === t.id; }) }; }).filter(function (t) { return t.episodes.length; });
  };

  /* Quiz JSON, normalised (the file may be a bare array or {questions:[]}; Danish options may be strings). */
  D.loadQuiz = function (path) {
    return fetchJSON(path).then(function (j) {
      if (j && j.__n) return j;
      var qs = Array.isArray(j) ? j : (j.questions || []);
      qs.forEach(function (q) {
        var L = function (i) { return String.fromCharCode(65 + i); };
        if (q.da) {
          q.da.options = (q.da.options || []).map(function (o, i) { return typeof o === 'string' ? { l: L(i), t: o } : o; });
          if (q.da.answer && !/^[A-Z]: /.test(q.da.answer)) q.da.answer = q.answer + ': ' + q.da.answer;
        }
      });
      var out = { __n: true, partId: j.partId, questions: qs }; cache[path] = Promise.resolve(out); return out;
    });
  };

  /* Thumbnails: first image of a part (lazy; the images JSON is tiny). */
  D.firstImage = function (part) {
    if (!part || !part.images) return Promise.resolve(null);
    return fetchJSON(part.images).then(function (j) { return (j.images && j.images[0]) || null; }).catch(function () { return null; });
  };
  /* Cover art: the manifest may give part.cover and chapter.cover (square images). Missing files are handled by the callers. */
  D.coverFor = function (part) { return (part && (part.cover || (part.chObj && part.chObj.cover))) || null; };
  D.fmtBytes = function (b) { if (!b && b !== 0) return ''; return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(b >= 1e8 ? 0 : 1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' kB'; };
})();
