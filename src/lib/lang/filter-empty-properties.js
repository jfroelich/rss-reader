const has_own = Object.prototype.hasOwnProperty;

// TODO: look into getOwnProperties or whatever it is called

// NOTE: value is returned to keep some legacy compat, but now this filters in
// place, there is no need to use ret val
// TODO: this no longer clones! double check caller

export function filter_empty_properties(value) {
  if (value && typeof value === 'object') {
    for (const key in value) {
      if (has_own.call(value, key)) {
        const pv = value[key];

        // Most properties have values. This leads to fewer operations on
        // average. I think.
        if (pv) {
          continue;
        }

        if (pv === null || pv === '' || typeof pv === 'undefined') {
          delete value[key];
        }
      }
    }
  }

  return value;
}
