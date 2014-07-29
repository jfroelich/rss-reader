// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

lucu.hash = {};

// Generate a simple hashcode from an array of strings
lucu.hash.generate = function(array) {
  if(array) {
    return array.reduce(lucu.hash.reduceChar, 0);
  }
};

lucu.hash.reduceChar = function(previousValue, currentValue) {
  //return (previousValue * 31 + currentValue.charCodeAt(0)) % 4294967296;

  var firstCharCode = currentValue.charCodeAt(0);
  var sum = previousValue * 31 + firstCharCode;
  return sum % 4294967296;
};
