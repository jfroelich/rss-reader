'use strict';

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function objectFilterEmptyProps(object) {
  const output = {};

  if(typeof object !== 'object') {
    return output;
  }

  const hasOwnProp = Object.prototype.hasOwnProperty;

  for(const key in object) {
    if(hasOwnProp.call(object, key)) {
      const value = object[key];
      if(value !== undefined && value !== null && value !== '') {
        output[key] = value;
      }
    }
  }

  return output;
}
