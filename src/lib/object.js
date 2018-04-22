const has_own = Object.prototype.hasOwnProperty;

export function filter_empty_properties(object) {
  const output = {};
  let undef;
  if (typeof object === 'object' && object !== null) {
    for (const key in object) {
      if (has_own.call(object, key)) {
        const value = object[key];
        if (value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}
