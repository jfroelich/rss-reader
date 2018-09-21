// TODO: look into getOwnProperties or whatever it is called
// NOTE: value is returned to keep some legacy compat, but now this filters in
// place, there is no need to use ret val
// TODO: this no longer clones! double check caller

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
