// See license.md
'use strict';

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function filter_empty_props(object) {
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

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from these stack overflow answers:
//  http://stackoverflow.com/questions/4324790
//  http://stackoverflow.com/questions/21284228
//  http://stackoverflow.com/questions/24229262
function filter_control_chars(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
