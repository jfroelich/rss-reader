// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// No operation 'singleton'
function noop() {
}

// Retrieves the value of the key property from obj
function valueAt(obj, key) {
  return obj[key];
}

// Uses Object.prototype.hasOwnProperty to avoid using possibly
// overwritten object.hasOwnProperty
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

// Gets the values of the properties of an array-like object
function objectValues(obj) {
  return Object.keys(obj).filter(hasOwn.bind(null,obj)).map(valueAt.bind(null,obj));
}
