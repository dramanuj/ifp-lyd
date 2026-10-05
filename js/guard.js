/* Best-effort anti-scraping deterrent ("option B" in the design brief).
   It CANNOT stop a determined scraper on a static host: audio, VTT, quiz JSON and zip files are public URLs.
   It only removes the cheapest attacks and states intent. It never disables right-click, selection or copy
   (accessibility) and never calls a third party. Controlled by DCE.config.PROTECT.
   Signals -> score; score >= 100 => transcript/quiz text are withheld until the visitor clicks "I am a person". */
(function () {
  'use strict';
  var UA_BLOCK = /(curl|wget|python-requests|python-urllib|scrapy|httpclient|libwww|aiohttp|go-http|okhttp|java\/|\bbot\b|bot\/|spider|crawl|httrack|scraper)/i;
  var sim = { ua: false, honeypot: false, rate: false, unlocked: false };
  var hits = { vtt: [], quiz: [] }, humanSeen = false, loadedAt = Date.now(), honeypotTouched = false;
  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'].forEach(function (ev) {
    addEventListener(ev, function () { humanSeen = true; }, { passive: true, once: true });
  });
  function recent(a, ms) { var n = Date.now(); return a.filter(function (t) { return n - t < ms; }).length; }
  function signals() {
    var ua = navigator.userAgent || '';
    return [
      { id: 'ua', label: 'User-agent matches blocklist', pts: 100, on: UA_BLOCK.test(ua) || sim.ua },
      { id: 'hp', label: 'Honeypot link was followed', pts: 100, on: honeypotTouched || sim.honeypot },
      { id: 'rate', label: 'More than 6 transcript requests (or 40 quiz requests) in 10 s', pts: 100, on: sim.rate || recent(hits.vtt, 1e4) > 6 || recent(hits.quiz, 1e4) > 40 },
      { id: 'wd', label: 'navigator.webdriver is set (automation; many assistive/test tools set it, so it never blocks alone)', pts: 40, on: !!navigator.webdriver },
      { id: 'nohuman', label: 'No human input within 8 s of load', pts: 30, on: !humanSeen && Date.now() - loadedAt > 8000 }
    ];
  }
  function score() { return signals().reduce(function (a, s) { return a + (s.on ? s.pts : 0); }, 0); }
  function blocked() { return !!(DCE.config.PROTECT && !sim.unlocked && score() >= 100); }
  DCE.guard = {
    sim: sim, signals: signals, score: score, blocked: blocked,
    noteRequest: function (kind) { (hits[kind] || hits.vtt).push(Date.now()); },
    touchHoneypot: function () { honeypotTouched = true; },
    unlock: function () { sim.unlocked = true; },
    reset: function () { sim.ua = sim.honeypot = sim.rate = false; hits = { vtt: [], quiz: [] }; honeypotTouched = false; sim.unlocked = false; }
  };
})();
