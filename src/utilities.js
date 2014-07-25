// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.objectUtils = {};


// Retrieves the value of the key property from obj. I cannot find a more elegant
// manner to undo the syntactic sugar
lucu.objectUtils.valueAt = function(object, key) {
  return object[key];
};


// Gets the values of the properties of an array-like object
function objectValues(obj) {

  // It would be nice if we could use some type of 'convoluted' approach.
  // It would be nice if Object.keys had a 'restrictToOwnProps' parameter

  var keys = Object.keys(obj);

  // NOTE: this is binding obj to 'this', not as the first argument. I am
  // not certain that is correct
  var boundHasOwn = Object.prototype.hasOwnProperty.bind(obj);
  var ownKeys = keys.filter(boundHasOwn);

  var boundValueAt = this.valueAt.bind(null,obj);
  var values = ownKeys.map(boundValueAt);

  return values;
}
