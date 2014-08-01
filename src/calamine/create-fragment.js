// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// TODO: think of a better name here. createFragment is maybe
// too specific to the type of result to return, in the event this
// is changed in the future.

lucu.calamine.createFragment = function(doc, bestElement) {

  var results = doc.createDocumentFragment();
  var forEach = Array.prototype.forEach;
  var append = Node.prototype.appendChild.bind(results);

  if(bestElement == doc.body) {
    forEach.call(doc.body.childNodes, append);
  } else {
    results.appendChild(bestElement);
  }

  return results;
};
