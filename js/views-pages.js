/* Secondary pages: downloads, search, my learning, privacy, about, honeypot, not found. */
(function () {
  'use strict';
  var D = DCE.data, S = DCE.store, P = DCE.player, G = DCE.guard, C = DCE.config, V = DCE.views, esc = V.esc, fmt = V.fmt, I = V.I, toast = V.toast, head = V.head, plural = V.plural;

  /* ---------- Downloads ---------- */
  function downloads() {
    var placeholder = /USER\/REPO/.test(C.RELEASE_BASE_URL);
    function zipRow(d) {
      var btn = placeholder ? '<span class="btn ghost sm is-off" aria-disabled="true">Not ready yet</span>' : '<a class="btn dark sm" href="' + esc(C.RELEASE_BASE_URL + d.file) + '" download>' + I.dl + ' Download</a>';
      return '<div class="dl-row"><span><b>' + esc(d.title) + '</b><span class="muted small"> · ' + esc(d.file) + (d.parts ? ' · ' + plural(d.parts, 'file') : '') + (d.description ? ' · ' + esc(d.description) : '') + '</span></span><span class="muted">' + D.fmtBytes(d.bytes) + '</span>' + btn + '</div>';
    }
    return { title: 'Downloads', html: function () {
      var dls = D.manifest.downloads || [];
      var rows = D.chapters.map(function (c) {
        var mine = dls.filter(function (d) { return d.chapter === c.n; }), bytes = c.parts.reduce(function (a, p) { return a + (p.audioBytes || 0); }, 0);
        return '<section class="dl-ch"><div class="dl-head"><div><span class="eyebrow">Chapter ' + c.n + '</span><h2 class="h3" lang="da">' + esc(c.titleDa) + '</h2></div><span class="muted small">' + plural(c.parts.length, 'part') + ' · ' + D.fmtBytes(bytes) + '</span></div>' +
          mine.map(zipRow).join('') +
          '<details class="dl-files"><summary>Single files (' + c.parts.length + ' audio files and ' + c.parts.length + ' transcripts)</summary><ul>' + c.parts.map(function (p) {
            return '<li><span>' + esc(p.title) + '</span><span class="muted">' + D.fmtBytes(p.audioBytes) + '</span><a href="' + esc(D.url(p.audio)) + '" download>mp3</a> <a href="' + esc(D.url(p.transcript)) + '" download>vtt</a></li>';
          }).join('') + '</ul></details></section>';
      }).join('');
      var rest = dls.filter(function (d) { return !d.chapter; });
      return head({ eyebrow: 'Downloads', h1: 'Take it offline', lede: 'Save the audio and transcripts to listen offline. You can download a whole chapter as one zip file, or choose single files. The zip files are kept in a separate place because the website allows no single file over 100 MB.',
        extra: '<div class="row"><span class="pill-info">' + D.stats.parts + ' audio files · ' + D.fmtBytes(D.stats.audioBytes) + '</span></div><div class="based-d">' + V.basedOn() + '</div>' }) +
        '<div class="wrap sec">' + (placeholder ? '<div class="callout"><b>The zip files are not ready yet.</b> They will appear here when the site owner has published them. The single audio and transcript files below always work.</div>' : '') + rows +
        (rest.length ? '<section class="dl-ch"><div class="dl-head"><div><span class="eyebrow">Everything</span><h2 class="h3">Complete packages</h2></div></div>' + rest.map(zipRow).join('') + '</section>' : '') +
        V.editionBox() + '<p class="muted small">Anyone can copy these files. Please read the terms on the <a href="#/about">About page</a> first.</p></div>';
    } };
  }

  /* ---------- Search ---------- */
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a'); }
  var idx = null, idxP = null;
  function loadIndex() {
    if (idx) return Promise.resolve(idx);
    if (!idxP) idxP = Promise.all(D.chapters.map(function (c) { G.noteRequest('quiz'); return D.fetchJSON('data/search/ch' + c.n + '.json').catch(function () { return []; }); })).then(function (all) {
      idx = []; all.forEach(function (a) { a.forEach(function (r) { idx.push({ p: r[0], t: r[1], s: r[2], n: norm(r[2]) }); }); }); return idx;
    });
    return idxP;
  }
  function search(p, qs) {
    var q = (qs.q || '').trim(), toks = norm(q).split(/\s+/).filter(Boolean), shown = 40, hits = [];
    return { title: q ? 'Search: ' + q : 'Search', html: function () {
      return head({ eyebrow: 'Search', h1: q ? 'Results for “' + esc(q) + '”' : 'Search', lede: 'Search episode titles, eras and every sentence of the transcripts. Each result takes you to the exact moment. Quiz answers are not included, so nothing is spoiled.' }) +
        '<div class="wrap sec"><form class="bigsearch" id="sf" role="search" aria-label="Search the transcripts"><label class="sr" for="sq">Search</label><input id="sq" type="search" value="' + esc(q) + '" placeholder="e.g. Harald Bluetooth, 1864, folketing" autocomplete="off"><button class="btn red" type="submit">Search</button></form><div id="res" aria-live="polite">' + (q ? '<p class="muted">Searching…</p>' : '<p class="muted">Type a word or a phrase in the box above.</p>') + '</div></div>';
    }, mount: function (root) {
      var res = root.querySelector('#res');
      root.querySelector('#sf').onsubmit = function (e) { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent(root.querySelector('#sq').value); };
      if (!toks.length) return;
      var re = new RegExp('(' + q.split(/\s+/).filter(Boolean).map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig');
      function mark(s) { return esc(s).replace(new RegExp('(' + q.split(/\s+/).filter(Boolean).map(function (t) { return esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')', 'ig'), '<mark>$1</mark>'); }
      function has(text) { var n = norm(text); return toks.every(function (t) { return n.indexOf(t) > -1; }); }
      var meta = [];
      D.eras.forEach(function (e) { if (has(e.titleDa + ' ' + e.titleEn + ' ' + e.from + ' ' + e.to + ' ' + e.summary)) meta.push({ t: 'Era', title: e.titleEn + ' · ' + e.titleDa + ' (' + e.from + '–' + e.to + ')', href: (V.eraLink(e) || { href: '#/timeline' }).href, sub: e.summary }); });
      D.chapters.forEach(function (c) { if (has(c.titleDa + ' ' + c.titleEn + ' ' + (c.description || ''))) meta.push({ t: 'Chapter', title: c.titleDa + ' · ' + c.titleEn, href: '#/chapter/' + c.n, sub: D.pagesLine(c.pages) }); });
      D.episodes.forEach(function (e) { if (has(e.title + ' ch' + e.ch + ' ' + e.ch + '.' + e.n)) meta.push({ t: 'Episode', title: e.title, href: '#/episode/' + e.id, sub: 'Chapter ' + e.ch + ' · ' + plural(e.parts.length, 'part') }); });
      G.noteRequest('quiz');
      if (G.blocked()) { res.innerHTML = '<div class="callout">The transcript search is hidden because a robot may be using the site. <button class="link" id="ub" type="button">I am a person</button></div>'; res.querySelector('#ub').onclick = function () { G.unlock(); location.reload(); }; return; }
      function draw() {
        var h = '';
        if (meta.length) h += '<h2 class="h3">Titles and eras</h2><ul class="results">' + meta.map(function (r) { return '<li><a href="' + r.href + '"><span class="tagp">' + r.t + '</span><b>' + mark(r.title) + '</b><span class="muted small">' + esc(r.sub) + '</span></a></li>'; }).join('') + '</ul>';
        h += '<h2 class="h3">In the transcripts' + (hits.length ? ' (' + hits.length + (hits.length >= 400 ? '+' : '') + ')' : '') + '</h2>';
        if (!hits.length) h += '<p class="muted">Nothing found in the transcripts.</p>';
        else h += '<ul class="results">' + hits.slice(0, shown).map(function (r) { var pt = D.byId[r.p]; return '<li><a href="#/part/' + r.p + '?t=' + Math.max(0, Math.floor(r.t - 1)) + '&play=1"><span class="tagp">' + fmt(r.t) + '</span><span class="hit">' + mark(r.s) + '</span><span class="muted small">' + (pt ? esc(D.partLabel(pt) + ' · ' + pt.title) : '') + '</span></a></li>'; }).join('') + '</ul>' + (hits.length > shown ? '<button class="btn ghost" id="more" type="button">Show more</button>' : '');
        res.innerHTML = h; var m = res.querySelector('#more'); if (m) m.onclick = function () { shown += 40; draw(); };
      }
      loadIndex().then(function (ix) {
        var phrase = norm(q);
        var all = ix.filter(function (r) { return toks.every(function (t) { return r.n.indexOf(t) > -1; }); });
        all.sort(function (a, b) { return (b.n.indexOf(phrase) > -1) - (a.n.indexOf(phrase) > -1); });
        hits = all.slice(0, 400); draw();
      }).catch(function () { res.innerHTML = '<p class="muted">The search could not be loaded. Please try again later.</p>'; });
    } };
  }

  /* ---------- My learning ---------- */
  function quizSummary() {
    var all = S.quizAll(), tot = {}, perCh = {}, answered = 0, okLast = 0, scopes = [];
    Object.keys(all.q).forEach(function (id) { var m = /^ch(\d+)-/.exec(id); if (!m) return; answered++; var r = all.q[id]; if (r.last) okLast++; var c = perCh[m[1]] = perCh[m[1]] || { n: 0, ok: 0 }; c.n++; if (r.last) c.ok++; });
    Object.keys(all.s).forEach(function (k) { scopes.push({ k: k, s: all.s[k] }); });
    scopes.sort(function (a, b) { return b.s.t - a.s.t; });
    return { answered: answered, ok: okLast, perCh: perCh, scopes: scopes };
  }
  function scopeLabel(k) {
    var m = /^p:(.+)$/.exec(k); if (m) { var p = D.byId[m[1]]; return p ? p.title + ' (Ch ' + p.ch + ')' : k; }
    m = /^c:(\d+)$/.exec(k); if (m) { var c = D.chapters[+m[1] - 1]; return 'Chapter ' + m[1] + ' mix' + (c ? ': ' + c.titleEn : ''); }
    return k;
  }
  function progress() {
    return { title: 'My learning', html: function () {
      var c = S.consent(), saved = S.canSaveProgress(), total = D.parts.length;
      var started = D.parts.filter(function (p) { return S.getPart(p.id); }).sort(function (a, b) { return S.getPart(b.id).updated - S.getPart(a.id).updated; });
      var done = D.parts.filter(function (p) { var s = S.getPart(p.id); return s && s.finished; }).length, qs = quizSummary();
      return '<section class="page-head dark"><div class="wrap"><span class="eyebrow">My learning</span><h1 class="h1">' + done + ' of ' + total + ' parts finished</h1><div class="meter big" role="img" aria-label="' + Math.round(done / total * 100) + '% finished"><i style="width:' + (done / total * 100) + '%"></i></div></div></section><div class="wrap sec">' +
        '<div class="callout ' + (saved ? 'ok' : 'warn') + '"><b>' + (saved ? 'Your progress and quiz results are saved on this device.' : c ? 'You chose not to save anything. Your progress and quiz results are kept only until you close this page.' : 'You have not chosen yet. Your progress and quiz results are kept only until you close this page.') + '</b> <button class="link" id="openConsent" type="button">Change my choice</button></div>' +
        '<h2 class="h2">Listening by chapter</h2><div class="grid g3">' + D.chapters.map(function (ch) { var s = S.chapterStats(ch.n, D.parts); return '<a class="stat" href="#/chapter/' + ch.n + '"><b>Ch ' + ch.n + ' · ' + esc(ch.titleDa) + '</b><div class="meter"><i style="width:' + Math.round(s.frac * 100) + '%"></i></div><span class="muted small">' + s.done + ' / ' + s.total + ' finished · ' + Math.round(s.frac * 100) + '%</span></a>'; }).join('') + '</div>' +
        '<h2 class="h2 mt">Quiz progress</h2>' + (qs.answered ? '<p><b>' + qs.answered + '</b> of ' + D.stats.questions + ' questions answered · <b>' + qs.ok + '</b> correct the last time you saw them (' + Math.round(qs.ok / qs.answered * 100) + '%).</p><div class="grid g3">' + D.chapters.map(function (ch) { var x = qs.perCh[ch.n] || { n: 0, ok: 0 }; return '<a class="stat" href="#/quiz"><b>Ch ' + ch.n + ' · ' + esc(ch.titleDa) + '</b><div class="meter"><i style="width:' + (ch.quizCount ? Math.round(x.ok / ch.quizCount * 100) : 0) + '%"></i></div><span class="muted small">' + x.ok + ' correct · ' + x.n + ' / ' + ch.quizCount + ' answered</span></a>'; }).join('') + '</div>' +
          (qs.scopes.length ? '<h3 class="h3 mt-s">Latest scores</h3><ul class="results">' + qs.scopes.slice(0, 12).map(function (x) { return '<li><a href="#/quiz"><b>' + x.s.s + ' / ' + x.s.n + '</b><span>' + esc(scopeLabel(x.k)) + '</span><span class="muted small">' + new Date(x.s.t).toLocaleDateString() + '</span></a></li>'; }).join('') + '</ul>' : '')
          : '<p class="muted">You have not answered any quiz questions yet. <a href="#/quiz">Start the quiz</a>.</p>') +
        '<h2 class="h2 mt">Started parts</h2>' + (started.length ? '<ul class="results">' + started.map(function (p) { var s = S.getPart(p.id); return '<li class="prow"><a href="#/part/' + p.id + '"><b>' + esc(p.title) + '</b><span class="muted small">Ch ' + p.ch + ' · ' + (s.finished ? 'Finished' : fmt(s.pos) + ' / ' + fmt(s.dur || p.dur)) + '</span></a>' + (s.finished ? '<button class="pill sm" data-unfin="' + p.id + '">Mark unfinished</button>' : '') + '<button class="pill sm" data-rm="' + p.id + '">Forget</button></li>'; }).join('') + '</ul>' : '<p class="muted">Nothing yet. Play any part for a few seconds to start.</p>') +
        '<h2 class="h2 mt">Your data</h2><div class="row"><button class="btn ghost" id="resetq" type="button">Reset quiz results</button><button class="btn ghost" id="reset" type="button">Reset all progress</button><button class="btn dark" id="wipe" type="button">Delete all my data</button></div><p class="muted small">“Delete all my data” removes your choice, progress, quiz results and settings from this device. The privacy banner then appears again.</p></div>';
    }, mount: function (root) {
      var oc = root.querySelector('#openConsent'); if (oc) oc.onclick = function () { DCE.openConsent(true); };
      root.querySelector('#resetq').onclick = function () { if (confirm('Reset all quiz results?')) { S.resetQuiz(); toast('Quiz results reset.'); } };
      root.querySelector('#reset').onclick = function () { if (confirm('Reset all progress and quiz results?')) { S.resetProgress(); toast('Progress reset.'); } };
      root.querySelector('#wipe').onclick = function () { if (confirm('Delete everything saved on this device?')) { S.deleteAll(); toast('All your data has been deleted.'); DCE.openConsent(false); } };
      root.addEventListener('click', function (e) { var u = e.target.closest('[data-unfin]'), r = e.target.closest('[data-rm]'); if (u) { S.setPart(u.dataset.unfin, { finished: false, manual: true, noLast: true }); S.emit(); } if (r) S.removePart(r.dataset.rm); });
    } };
  }
  DCE.quizSummary = quizSummary; DCE.scopeLabel = scopeLabel;

  /* ---------- Privacy ---------- */
  function privacy() {
    return { title: 'Privacy and cookies', html: function () {
      var c = S.consent(), k = S.keys;
      return head({ eyebrow: 'Privacy and cookies', h1: 'What this site stores', lede: 'There are no accounts and no tracking. Your progress is saved only on this device, and only if you say yes.' }) + '<div class="wrap sec prose">' +
        '<p><b>Your choice now:</b> ' + (c ? (c.choice === 'declined' ? 'You said no. Only this choice is saved.' : 'Progress is ' + (c.progress ? 'saved' : 'not saved') + ' and settings are ' + (c.prefs ? 'saved' : 'not saved') + ' (chosen on ' + new Date(c.ts).toLocaleDateString('en-GB') + ').') : 'You have not chosen yet. Nothing is saved.') + '</p>' +
        '<div class="row"><button class="btn dark" id="chg" type="button">Change my choice</button><button class="btn ghost" id="wipe" type="button">Delete all my data</button></div>' +
        '<h2 class="h2 mt">Exactly what is saved on your device</h2><div class="tablewrap" tabindex="0" role="region" aria-label="Table of saved items"><table><thead><tr><th scope="col">Item</th><th scope="col">What it is for</th><th scope="col">Do we ask first?</th><th scope="col">How long</th></tr></thead><tbody>' +
        '<tr><td><code>' + k.consent + '</code></td><td>Remembers your choice, so we do not ask again.</td><td>No. We need it to respect your choice.</td><td>12 months, then we ask again</td></tr>' +
        '<tr><td><code>' + k.progress + '</code></td><td>Where you stopped in each part, finished parts, your quiz results, and which questions you answered wrongly (used for the “Your weak spots” list on the Quiz page).</td><td>Yes (“Progress”)</td><td>Deleted after 12 months without use, or when you ask</td></tr>' +
        '<tr><td><code>' + k.prefs + '</code></td><td>Speed, repeat mode, light or dark theme, timeline zoom, quiz language.</td><td>Yes (“Settings”)</td><td>Same as progress</td></tr>' +
        '<tr><td>Cookies</td><td>This site does not use cookies.</td><td>Not needed</td><td>Not applicable</td></tr></tbody></table></div>' +
        '<h2 class="h2">Reporting a mistake</h2><p>“Report a mistake” is only a link. It opens GitHub in a new tab, with the part and the time filled in. This site sends nothing. If you choose to continue, GitHub’s own terms and privacy statement apply, and what you post there is public.</p>' +
        '<h2 class="h2">Other things to know</h2><ul><li>If you say no, everything still works. Your progress is kept only until you close or reload the page.</li><li>The company that hosts this site (for example GitHub Pages) can see your IP address when you open a page. This is normal for any website. We cannot see those records.</li><li>There are no adverts, no analytics, and no fonts or videos from other companies.</li><li>A small script watches for robots that copy the site. It keeps its notes in memory only and saves nothing.</li></ul></div>';
    }, mount: function (root) {
      root.querySelector('#chg').onclick = function () { DCE.openConsent(true); };
      root.querySelector('#wipe').onclick = function () { if (confirm('Delete everything saved on this device?')) { S.deleteAll(); toast('All your data has been deleted.'); DCE.openConsent(false); } };
    } };
  }

  /* ---------- How to use ---------- */
  function howto() {
    return { title: 'How to use IFP Lyd', html: function () {
      return head({ eyebrow: 'Start here', h1: 'How to use IFP Lyd', lede: 'IFP Lyd helps you revise by listening. Here is what it is for and how it works.' }) + '<div class="wrap sec prose">' +
        '<div class="callout"><b>The official learning material is your main source.</b> IFP Lyd is only a supplement. It does not replace the official material.</div>' +
        '<div class="ai-note">' + V.aiNote() + '</div>' +
        '<h2 class="h2">What this site is for</h2><ul><li>Listen on the move. Use travel time, walks and commutes to revise the facts.</li><li>Use the <a href="#/quiz">Quiz</a> tab for a quick check of what you remember.</li><li>Use the <a href="#/timeline">timeline</a> to follow Danish history from the Viking Age to today.</li></ul>' +
        '<h2 class="h2">A tip on practising exam questions</h2><p>For practising exam questions, the quiz exercises on <a href="https://nearlydanish.com" rel="noopener noreferrer" target="_blank">nearlydanish.com</a> are probably the better way to practise. This is the opinion of the site owner. We are not connected to nearlydanish.com.</p>' +
        '<h2 class="h2">How the features work</h2><dl class="feat">' +
        '<dt>Chapters and parts</dt><dd>The material has ' + D.chapters.length + ' chapters. Each chapter is split into episodes, and each episode into short parts of about ten to twenty minutes. The order follows the official book.</dd>' +
        '<dt>The transcript</dt><dd>Every part shows the words as they are spoken. The current sentence is highlighted. Select a sentence to jump to it. Danish quiz questions appear under the English.</dd>' +
        '<dt>Speed</dt><dd>Use the speed button to listen more slowly or faster, from 0.75 to 2 times.</dd>' +
        '<dt>The quiz at the end of each part</dt><dd>Each part ends with real exam questions. The narrator reads the question and the options, pauses, then gives the answer. The written answers stay hidden until they are read out. You can reveal them yourself if you wish.</dd>' +
        '<dt>The Quiz tab</dt><dd>Practise the same questions without audio. Choose a part, or mix a whole chapter. If you get one wrong, you can listen to the part of the podcast that explains it.</dd>' +
        '<dt>Saved progress</dt><dd>If you agree, the site remembers where you stopped, your quiz results, and the questions you got wrong. They are saved only on this device. You can delete them at any time on the <a href="#/progress">My learning</a> page.</dd>' +
        '<dt>Downloads</dt><dd>On the <a href="#/downloads">Downloads</a> page you can save the audio and transcripts to listen offline.</dd>' +
        '<dt>Report a mistake</dt><dd>If you notice a mistake, press <b>Report a mistake</b> in the player, or the <b>Report</b> link beside a transcript line. GitHub opens in a new tab with the part and the time already filled in. You then describe the mistake. You need a free GitHub account. Nothing is sent until you press the green button on GitHub.</dd></dl>' +
        V.editionBox() + '</div>';
    } };
  }

  /* ---------- About and attribution ---------- */
  function about() {
    return { title: 'About and attribution', html: function () {
      var s = D.source, url = (C.SITE_URL || (location.origin + location.pathname)).replace(/index\.html$/, '');
      return head({ eyebrow: 'About and attribution', h1: 'Where this comes from', lede: '<b>This is an unofficial study aid.</b> It is not connected to the Danish authorities (UIM and SIRI). It may contain errors. Always check the official sources.' }) + '<div class="wrap sec prose">' +
        '<div class="ai-note">' + V.aiNote() + '</div>' +
        '<h2 class="h2">What “IFP Lyd” means</h2><p><b>IFP</b> stands for <i lang="da">Indfødsretsprøven</i>, which is the Danish citizenship test. <b lang="da">Lyd</b> is the Danish word for “sound” or “audio”. This site turns the official learning material into English audio lessons. It keeps the Danish words you need for the exam.</p>' +
        '<h2 class="h2">Source material and edition</h2><p>This site is based on <i lang="da">' + esc(s.titleDa) + '</i>' + (s.subtitleDa ? ' (' + esc(s.subtitleDa) + ')' : '') + ', <b>' + esc(s.edition) + ' edition</b>' + (s.editionNote ? ' (' + esc(s.editionNote.charAt(0).toLowerCase() + s.editionNote.slice(1)) + ')' : '') + '. It is published by ' + esc(s.publisher) + '. The ISBN is ' + esc(s.isbn) + (s.pages ? ', and the book has ' + s.pages + ' pages' : '') + '. Lines such as “Based on pp. 5–16” refer to page numbers in that edition.</p>' + V.updateNote() +
        '<div class="callout"><b>In short:</b> the learning material and the past exams are not ours. They are not openly licensed. Only the work we made ourselves is shared openly.</div>' +
        '<h2 class="h2">Ownership, licence and disclaimer</h2><ol class="legal"><li><b>Who owns what.</b> The learning material “<i lang="da">' + esc(s.titleDa) + '</i>” (edition ' + esc(s.edition) + (s.editionNote ? ', ' + esc(s.editionNote.charAt(0).toLowerCase() + s.editionNote.slice(1)) : '') + ') is published by ' + esc(s.publisher) + '. It and the past exam papers belong to their publishers. All rights in them stay with the publishers. The ministry has not reviewed, approved or endorsed this site.</li>' +
        '<li><b>What this site is.</b> It is an unofficial, free, non-commercial study aid. It retells the publicly released material in English as audio. Nothing is sold. There are no adverts and no fees.</li>' +
        '<li><b>What is original.</b> The English narration scripts, audio, transcripts, quiz translations and illustrations were made for this project. The illustrations are original artwork inspired by the book’s pictures. They are not the book’s photographs. We used Claude (Anthropic), Microsoft Edge neural text-to-speech and other open tools. We share our own work as openly as we can, under the licence <b>CC BY 4.0</b>. Please credit “IFP Lyd” and link to the source material. The code is under the <b>MIT</b> licence.</li>' +
        '<li><b>No guarantee.</b> Content made with the help of machines can contain errors, wrong pronunciation or out-of-date facts. Always check the official learning material and the official exam information before you take the test.</li>' +
        '<li><b>Pictures.</b> We do <b>not</b> use the photographs in the original book, because other people own them (for example Ritzau Scanpix and Nationalmuseet). ' + esc(V.ILL_NOTE) + '</li>' +
        '<li><b>Takedown and contact.</b> If you own rights in something here and want it changed or removed, please contact the site owner' + contactHTML() + '. We will deal with it promptly.</li></ol>' +
        '<h2 class="h2">How it was made</h2><ul><li><b>Claude</b> (Anthropic), used through Claude Code with the Claude Opus and Sonnet models, wrote the narration scripts and the site code.</li><li>The voice is the Microsoft neural voice <b>en-US-AvaNeural</b>, made with the <b>edge-tts</b> package. It is a synthetic voice.</li><li>We also used <b>ffmpeg</b> (audio), <b>PyMuPDF</b> (text from the PDF) and <b>Playwright</b> (testing).</li><li>Separate Claude assistants checked every script against the 13 published exams, from June 2020 to June 2026.</li></ul>' +
        '<h2 class="h2">AI-generated content</h2><p>The narration text was written by an AI from the learning material. The audio is synthetic speech. We checked the scripts, but we have not checked every fact. Mistakes are possible. If you notice one, please use “Report a mistake” in the player or the footer. It opens GitHub with the details filled in. You need a free GitHub account. Nothing is sent until you press the green button on GitHub.</p>' +
        '<h2 class="h2">How to cite</h2><p class="cite" id="cite">IFP Lyd (' + new Date((D.manifest.generated || Date.now())).getFullYear() + '). <i>Audio lessons for the Indfødsretsprøven</i>, based on ' + esc(s.titleDa) + ', ' + esc(s.edition) + ' edition (' + esc(s.publisher) + '). AI-generated narration. ' + esc(url) + '</p>' +
        '<h2 class="h2">Picture credits</h2><div id="imgcred"><p class="muted">Loading credits…</p></div>' +
        '<h2 class="h2">Protection against copying</h2><p>This site asks search robots not to copy it. A small script also hides the text from obvious robots. Please be aware that a simple website <b>cannot truly stop copying</b>. The audio, transcript and zip files are public web addresses, and the Downloads page offers them on purpose. These measures only discourage the easiest copying. Right-click and text selection are never blocked. Search robots only read the file <code>robots.txt</code> at the top of a website address (here, <code>dramanuj.github.io/robots.txt</code>). The copy inside this site’s folder is only a hint. We do not claim that it blocks anyone.</p>' +
        '<h2 class="h2" id="a11y">Accessibility statement</h2><p>We want everyone to be able to use IFP Lyd. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2, level AA. What we have done:</p><ul><li>You can use the whole site with a keyboard.</li><li>Text and buttons have strong colour contrast, in light and dark themes.</li><li>Every part has a written transcript. Pictures have text descriptions.</li><li>Animations stop if your device is set to reduce motion. You can also pause the picture animation yourself.</li><li>The pages work with screen readers and can be zoomed to 400%.</li></ul><p><b>Known limits.</b> The audio is synthetic speech and may mispronounce some Danish words. Some pictures are decorative illustrations, and their descriptions are short. We have tested with automatic tools and by hand, but not with every screen reader.</p><p>If you have trouble using the site, please contact the site owner' + contactHTML() + '. We will try to help.</p>' +
        '<h2 class="h2">A note on design</h2><p class="small muted">The look of this site is inspired by the clean style of ted.com. We are not connected to them. The colours and the logo come from the Danish flag, the Dannebrog.</p>' +
        '<p class="muted small">Data created on ' + esc(D.manifest.generated || '') + '. More credits are in the file <code>NOTICE.md</code>.</p></div>';
    }, mount: function (root) {
      var box = root.querySelector('#imgcred');
      Promise.all(D.parts.map(function (p) { return p.images ? D.fetchJSON(p.images).then(function (j) { return (j.images || []).map(function (im) { return { c: im.credit, pg: im.page, p: p.id }; }); }).catch(function () { return []; }) : []; })).then(function (all) {
        var map = {}, n = 0; all.forEach(function (l) { l.forEach(function (x) { n++; var k = /^Original illustration/i.test(x.c || '') ? 'Illustration: IFP Lyd' : (x.c || '(no credit given)'); var o = map[k] = map[k] || { pages: {}, n: 0 }; if (x.pg) o.pages[x.pg] = 1; o.n++; }); });
        var keys = Object.keys(map).sort(function (a, b) { return map[b].n - map[a].n || a.localeCompare(b); });
        box.innerHTML = n ? '<p class="muted small">There are ' + n + ' pictures in total, with ' + keys.length + ' credit lines. Page numbers are pages of the ' + esc(D.edition()) + ' edition that inspired the pictures.</p><div class="tablewrap" tabindex="0" role="region" aria-label="Table of picture credits"><table><thead><tr><th scope="col">Credit</th><th scope="col">Pages</th><th scope="col">Pictures</th></tr></thead><tbody>' + keys.map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + Object.keys(map[k].pages).map(Number).sort(function (a, b) { return a - b; }).join(', ') + '</td><td>' + map[k].n + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No pictures are used.</p>';
      });
    } };
  }
  function contactHTML() { var c = C.ISSUES_URL || C.CONTACT; if (!c) return ''; return '. Open an issue on GitHub: <a href="' + esc(c) + '" rel="noopener noreferrer">' + esc(c) + '</a>'; }
  function trap() { return { html: function () { G.touchHoneypot(); return '<div class="wrap sec"><h1 class="h2">Nothing here</h1><p class="muted">This page exists only as a honeypot for automated crawlers.</p><a class="btn dark" href="#/">Back home</a></div>'; } }; }
  function notfound() { return { title: 'Not found', html: function () { return '<div class="wrap sec"><h1 class="h1">Page not found</h1><p class="muted">That address does not exist.</p><a class="btn dark" href="#/">Home</a></div>'; } }; }
  DCE.views.howto = howto; DCE.views.downloads = downloads; DCE.views.search = search; DCE.views.progress = progress; DCE.views.privacy = privacy; DCE.views.about = about; DCE.views.trap = trap; DCE.views.notfound = notfound;
})();
