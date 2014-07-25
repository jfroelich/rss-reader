// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// TODO: consider renaming this to just lucu.object

'use strict';

var lucu = lucu || {};
lucu.objectUtils = {};

// Retrieves the value of the key property from object. I cannot find a more elegant
// manner to undo the syntactic sugar
lucu.objectUtils.valueAt = function(object, key) {
  return object[key];
};

// Gets the values of the properties of an object as an array
lucu.objectUtils.values = function(object) {

  // TODO: consider some type of convolutional approach that avoids using
  // intermediate arrays but also avoids an explicit loop

  var keys = Object.keys(object);

  // TODO: does the native keys function already restrict. In other words, is
  // filtering by hasOwnProperty already done for us?

  // NOTE: this is binding object to 'this', not as the first argument. I am
  // not certain that is correct
  var boundHasOwn = Object.prototype.hasOwnProperty.bind(object);
  var ownKeys = keys.filter(boundHasOwn);

  var boundValueAt = this.valueAt.bind(null,object);
  var vals = ownKeys.map(boundValueAt);

  return vals;
};
