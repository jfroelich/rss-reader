// Javascript object utilities

'use strict';

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function object_filter_empty_props(object) {
  if(typeof object === 'undefined') {
    return {};
  }

  const output_object = {};
  const has_own_prop = Object.prototype.hasOwnProperty;

  for(const key in object) {
    if(has_own_prop.call(object, key)) {
      const value = object[key];
      if(value !== undefined && value !== null && value !== '')
        output_object[key] = value;
    }
  }

  return output_object;
}
