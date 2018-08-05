const has_own = Object.prototype.hasOwnProperty;

export function filter_empty_properties(value) {
  if (value && typeof value === 'object') {
    for (const key in value) {
      if (has_own.call(value, key)) {
        const pv = value[key];
        if (pv === null || pv === '' || pv === undefined) {
          delete value[key];
        }
      }
    }
  }

  return value;
}
