/**
 * Basic localStorage wrapper
 */
export default {

  // save data
  set(key, data, ttl) {
    if (!this._isStr(key)) return;
    const time = Date.now();
    const expire = Number(ttl) || 0;
    const json = JSON.stringify({ time, expire, data });
    window.localStorage.setItem(key, json);
  },

  // get saved data
  get(key) {
    if (!this._isStr(key)) return;
    const json = window.localStorage.getItem(key) || '{}';
    // One malformed entry used to throw on every get() and leave the app broken
    // until the user cleared site data. Drop the bad key and carry on.
    let parsed = {};
    try {
      parsed = JSON.parse(json) || {};
    } catch (e) {
      this.delete(key);
      return undefined;
    }
    const { time, expire, data } = parsed;
    if (this._isExpired(time, expire)) this.delete(key);
    return data;
  },

  // remove saved data
  delete(key) {
    if (!this._isStr(key)) return;
    window.localStorage.removeItem(key);
  },

  // check valid string
  _isStr(str) {
    return (str && typeof str === 'string');
  },

  // check if data saved has expired
  _isExpired(time, expire) {
    if (!time || !expire) return false;
    const now = Date.now();
    const secs = (now - time) / 1000;
    return (secs >= expire) ? true : false;
  }
}
