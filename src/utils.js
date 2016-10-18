// See license.md

'use strict';

function condense_whitespace(str) {
  return str.replace(/\s{2,}/g, ' ');
}

// Returns a new string where Unicode Cc-class characters have been removed
// Adapted from http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function filter_control_chars(str) {
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it s null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Impure.
function filter_empty_props(obj) {
  const copy = {};
  const has_own = Object.prototype.hasOwnProperty;
  const undef = void(0);
  for(let prop in obj) {
    if(has_own.call(obj, prop)) {
      const value = obj[prop];
      if(value !== undef && value !== null && value !== '') {
        copy[prop] = value;
      }
    }
  }
  return copy;
}

// Formats a date object.
function format_date(date, delimiter) {
  const parts = [];
  if(date) {
    // getMonth is a zero based index
    parts.push(date.getMonth() + 1);
    parts.push(date.getDate());
    parts.push(date.getFullYear());
  }
  return parts.join(delimiter || '/');
}
