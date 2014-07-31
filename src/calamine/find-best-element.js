// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.findBestElement = function(doc) {

  var elements = doc.body.getElementsByTagName('*');
  var reduce = Array.prototype.reduce;
  var getHigher = lucu.calamine.getHigherScoringElement;

  return reduce.call(elements, getHigher, doc.body);
};

lucu.calamine.getHigherScoringElement = function(previous, current) {

  // TODO: do we need to check the presence of the score property?
  // are we comparing undefineds sometimes? Review how > works
  // with undefined.

  // Favor previous, so use > not >=
  return current.score > previous.score ? current : previous;
};
