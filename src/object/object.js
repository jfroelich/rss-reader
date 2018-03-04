const has_own = Object.prototype.hasOwnProperty;

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference and
// therefore impure.
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
