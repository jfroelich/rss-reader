// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.createFragment = function(doc, bestElement) {
  // Build and return the results
  var results = doc.createDocumentFragment();
  if(bestElement == doc.body) {

    // TODO: bind Node.prototype.appendChild instead here
    var forEach = Array.prototype.forEach;
    forEach.call(doc.body.childNodes, function(element) {
      results.appendChild(element);
    });
  } else {
    results.appendChild(bestElement);
  }

  return results;
};
