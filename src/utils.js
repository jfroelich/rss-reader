// See license.md

'use strict';

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function filterEmptyProperties(object) {
  const outputObject = {};
  const hasOwnProperty = Object.prototype.hasOwnProperty;

  for(let prop in object) {
    if(hasOwnProperty.call(object, prop)) {
      const value = object[prop];
      if(value !== undefined && value !== null && value !== '') {
        outputObject[prop] = value;
      }
    }
  }

  return outputObject;
}

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from these stack overflow answers:
//  http://stackoverflow.com/questions/4324790
//  http://stackoverflow.com/questions/21284228
//  http://stackoverflow.com/questions/24229262
function filterControlCharacters(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}
