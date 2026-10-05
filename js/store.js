/* Consent + progress store.
   RULES: (1) Before a choice, and after a refusal, nothing is written except the consent record itself
              (needed to honour the choice); progress and quiz results live in memory for the tab only.
          (2) 'progress' category -> localStorage ifp.progress.v1 (listening positions AND quiz results);
              'prefs' -> ifp.prefs.v1.
          (3) No cookies. Progress expires 12 months after last activity; consent is re-asked after 12 months. */
(function () {
  'use strict';
  var KEY_C = 'ifp.consent.v1', KEY_P = 'ifp.progress.v1', KEY_S = 'ifp.prefs.v1';
  var YEAR = 365 * 864e5;
  function blank() { return { v: 1, parts: {}, last: null, active: Date.now(), quiz: { q: {}, s: {} } }; }
  var mem = { progress: blank(), prefs: {} };
  var consent = null, listeners = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }

  function init() {
    var raw = lsGet(KEY_C);
    if (raw) {
      try { consent = JSON.parse(raw); } catch (e) { consent = null; }
      if (consent && Date.now() - consent.ts > YEAR) { consent = null; lsDel(KEY_C); }
    }
    if (consent && consent.progress) {
      try {
        var p = JSON.parse(lsGet(KEY_P) || 'null');
        if (p && p.v === 1) {
          if (Date.now() - (p.active || 0) > YEAR) lsDel(KEY_P);
          else { if (!p.quiz) p.quiz = { q: {}, s: {} }; mem.progress = p; }
        }
      } catch (e) {}
    }
    if (consent && consent.prefs) { try { mem.prefs = JSON.parse(lsGet(KEY_S) || '{}') || {}; } catch (e) {} }
  }
  function flush() {
    if (consent && consent.progress) { mem.progress.active = Date.now(); lsSet(KEY_P, JSON.stringify(mem.progress)); }
    if (consent && consent.prefs) lsSet(KEY_S, JSON.stringify(mem.prefs));
  }
  function setConsent(c) {
    consent = { choice: c.choice, progress: !!c.progress, prefs: !!c.prefs, ts: Date.now() };
    lsSet(KEY_C, JSON.stringify(consent));
    if (!consent.progress) lsDel(KEY_P);
    if (!consent.prefs) lsDel(KEY_S);
    flush(); emit();
  }
  function deleteAll() { lsDel(KEY_C); lsDel(KEY_P); lsDel(KEY_S); consent = null; mem = { progress: blank(), prefs: {} }; emit(); }
  function resetProgress() { mem.progress = blank(); flush(); emit(); }
  function resetQuiz() { mem.progress.quiz = { q: {}, s: {} }; flush(); emit(); }

  function getPart(id) { return mem.progress.parts[id] || null; }
  function setPart(id, patch) {
    var o = mem.progress.parts[id] || { pos: 0, dur: 0, finished: false, manual: false, updated: 0 };
    for (var k in patch) o[k] = patch[k];
    o.updated = Date.now(); mem.progress.parts[id] = o;
    if (!patch.noLast) mem.progress.last = id;
    flush();
  }
  function removePart(id) { delete mem.progress.parts[id]; flush(); emit(); }
  function pref(k, v) { if (v === undefined) return mem.prefs[k]; mem.prefs[k] = v; flush(); }
  function chapterStats(ch, parts) {
    var list = parts.filter(function (p) { return p.ch === ch; }), done = 0, frac = 0;
    list.forEach(function (p) {
      var s = getPart(p.id);
      if (s && s.finished) { done++; frac += 1; } else if (s && s.dur) frac += Math.min(1, s.pos / s.dur);
    });
    return { done: done, total: list.length, frac: list.length ? frac / list.length : 0 };
  }

  /* ---- quiz results: q[qid] = {last:bool, att, ok, t}; s[scopeKey] = {s:score, n:total, t:ts} ---- */
  function quizRecord(qid, correct) {
    var q = mem.progress.quiz.q, o = q[qid] || { last: false, att: 0, ok: 0, t: 0 };
    o.last = !!correct; o.att++; if (correct) o.ok++; o.t = Date.now(); q[qid] = o; flush();
  }
  function quizGet(qid) { return mem.progress.quiz.q[qid] || null; }
  function quizScore(key, s, n) { mem.progress.quiz.s[key] = { s: s, n: n, t: Date.now() }; flush(); emit(); }
  function quizGetScore(key) { return mem.progress.quiz.s[key] || null; }
  function quizAll() { return mem.progress.quiz; }
  /* Weak spots: questions answered wrongly more often than rightly. Most wrong answers first, then the most recent. */
  function quizWeak() {
    var q = mem.progress.quiz.q, out = [];
    Object.keys(q).forEach(function (id) {
      var o = q[id], wrong = (o.att || 0) - (o.ok || 0);
      if (wrong > 0 && (o.ok || 0) <= wrong) out.push({ id: id, wrong: wrong, att: o.att, ok: o.ok || 0, last: !!o.last, t: o.t || 0 });
    });
    out.sort(function (a, b) { return (b.wrong - a.wrong) || ((a.last ? 1 : 0) - (b.last ? 1 : 0)) || (b.t - a.t); });
    return out;
  }

  DCE.store = {
    init: init, setConsent: setConsent, deleteAll: deleteAll, resetProgress: resetProgress, resetQuiz: resetQuiz,
    getPart: getPart, setPart: setPart, removePart: removePart, pref: pref, chapterStats: chapterStats,
    quizRecord: quizRecord, quizGet: quizGet, quizScore: quizScore, quizGetScore: quizGetScore, quizAll: quizAll, quizWeak: quizWeak,
    consent: function () { return consent; },
    canSaveProgress: function () { return !!(consent && consent.progress); },
    last: function () { return mem.progress.last; },
    onChange: function (f) { listeners.push(f); }, emit: emit,
    keys: { consent: KEY_C, progress: KEY_P, prefs: KEY_S }
  };
})();
