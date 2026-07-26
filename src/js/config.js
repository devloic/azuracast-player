export default {
  // Empty means "same origin as the page" — see api.js getAzuracastHostname().
  // The player is served by AzuraCast itself at /static/player/, so its API is
  // always on the origin it was loaded from. Hardcoding a host here was why the
  // station list came up empty: it pointed at a dev box (azuracast.local:81).
  apiBaseUrl: '',
}
