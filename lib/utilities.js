'use strict';

// No operation 'singleton'
function noop() {
}

// Retrieves the value of the key property from obj
// Useful for late binding a callback to array iterator functions
function at(obj, key) {
  return obj[key];
}

// Uses Object.prototype.hasOwnProperty to avoid using possibly
// overwritten object.hasOwnProperty
function hasOwnProperty(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Gets the values of the properties of an array-like object
function objectValues(obj) {
  return Object.keys(obj).filter(hasOwnProperty.bind(null,obj)).map(at.bind(null,obj));
}
