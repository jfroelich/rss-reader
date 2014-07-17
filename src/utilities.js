// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// No operation 'singleton'
function noop() {
}

// Retrieves the value of the key property from obj
function valueAt(obj, key) {

  // Ugh....
  // var descriptor = Object.getOwnPropertyDescriptor(obj, key);
  // return descriptor.value;
  // return String.prototype.charAt.call(obj, key);
  // return CSSStyleDeclaration.prototype.getPropertyValue.call(obj,key);

  return obj[key];
}

// Gets the values of the properties of an array-like object
function objectValues(obj) {
  return Object.keys(obj).
      filter(Object.prototype.hasOwnProperty.bind(obj)).
      map(valueAt.bind(null,obj));
}
