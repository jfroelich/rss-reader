// TODO: if this module is only in use by one other module, this should be
// just a helper file located within that module, or even just a function
// embedded within that other module's file

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
