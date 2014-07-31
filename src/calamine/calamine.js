// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// Functions for sanitizing, removing boilerplate

// Returns a DocumentFragment
lucu.calamine.transformDocument = function(doc, options) {

  // Expects this instanceof lucu.calamine

  options = options || {};
  this.preprocess(doc);
  this.extractFeatures(doc);
  this.score(doc);
  this.filterAttributes(doc, options);
  var bestElement = lucu.calamine.findBestElement(doc);
  this.unwrapElements(doc, bestElement, options);
  this.markupOutput(doc, bestElement, options);

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
