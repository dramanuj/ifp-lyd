/* Site configuration. Edit this file when you publish (see HOSTING.md). */
window.DCE = window.DCE || {};
DCE.config = {
  SITE_NAME: 'IFP Lyd',
  /* Where data/, audio/, transcripts/ and images/ live, relative to index.html ('' = same folder).
     Tests may point at a fixture with ?data=../site-dev-fixture/ (honoured on localhost only). */
  DATA_BASE: '',
  /* Where the zip files are hosted (GitHub Release assets). See HOSTING.md. */
  RELEASE_BASE_URL: 'https://github.com/dramanuj/ifp-lyd/releases/latest/download/',
  /* Light anti-scraping deterrent (js/guard.js). false = switch everything off. */
  PROTECT: true,
  /* Public address of the site (optional, only used for the "how to cite" text). */
  SITE_URL: 'https://dramanuj.github.io/ifp-lyd/',
  ISSUES_URL: 'https://github.com/dramanuj/ifp-lyd/issues',
  /* Contact for rights holders: the GitHub issues page (no e-mail address is needed). */
  CONTACT: '',
  /* PARKED extension point: crowd-checked flags (js/flags.js). Everything below is ignored while FLAGS_ENABLED is false. */
  FLAGS_ENABLED: false,  /* parked feature: keep false (see README, Future work) */
  FIREBASE: { apiKey: '', authDomain: '', databaseURL: '', projectId: '' },
  FLAG_CONFIRM_MIN: 10,  /* confirmations needed before a moment is shown in red */
  FLAG_REJECT_MIN: 5     /* "it is fine" votes needed to mark a flag as a false alarm */
};
(function () {
  try {
    var m = /[?&]data=([^&#]*)/.exec(location.search), h = location.hostname, local = (h === 'localhost' || h === '127.0.0.1');
    if (m && local) {
      var b = decodeURIComponent(m[1]); DCE.config.DATA_BASE = b && b.slice(-1) !== '/' ? b + '/' : b;
      try { sessionStorage.setItem('ifp.databse', DCE.config.DATA_BASE); } catch (e) {}
    } else if (local) {
      var s = null; try { s = sessionStorage.getItem('ifp.databse'); } catch (e) {}
      if (s) DCE.config.DATA_BASE = s;
    }
  } catch (e) {}
})();
