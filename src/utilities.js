// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// No operation singleton
function noop() {
}

// Retrieves the value of the key property from obj
function valueAt(obj, key) {

  // I cannot find a way to undo the syntactic sugar :(

  return obj[key];
}

// Gets the values of the properties of an array-like object
function objectValues(obj) {

  // It would be nice if we could use some type of 'convoluted' approach.
  // It would be nice if Object.keys had a 'restrictToOwnProps' parameter

  var keys = Object.keys(obj);
  var boundHasOwn = Object.prototype.hasOwnProperty.bind(obj);
  var ownKeys = keys.filter(boundHasOwn);
  var boundValueAt = valueAt.bind(null,obj);
  var values = ownKeys.map(boundValueAt);
  return values;
}
