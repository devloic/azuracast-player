/**
 * Common utils
 */
export default {

  // get search results off a list for an obj key
  search(list, key, search) {
    // Escape before compiling: a bare "(" threw SyntaxError and killed the filter,
    // and nested quantifiers made it a ReDoS.
    const escaped = String(search ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regxp = new RegExp('^(' + escaped + ')', 'i');
    return list.filter(item => regxp.test(item[key]));
  },

  // sort objects in an array by a key
  sort(list, key, order, ignore) {
    return list.sort((a, b) => {
      if (a.hasOwnProperty(key)) {

        let _a = a[key];
        let _b = b[key];

        if (ignore) { // sort strings using same case
          _a = (typeof _a === 'string') ? _a.toUpperCase() : _a;
          _b = (typeof _b === 'string') ? _b.toUpperCase() : _b;
        }
        if (order === 'asc') {
          if (_a < _b) return -1;
          if (_a > _b) return 1;
        }
        if (order === 'desc') {
          if (_a > _b) return -1;
          if (_a < _b) return 1;
        }
      }
      return 0;
    });
  },

}
