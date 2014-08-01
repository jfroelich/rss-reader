// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// Returns a DocumentFragment with some boilerplate removed
lucu.calamine.transformDocument = function(doc, options) {

  // Expects this instanceof lucu.calamine

  options = options || {};

  // This function works by treating the DOM of the input
  // document like a dataset that is the source of a stream,
  // or 'data pipeline'. Each of the following functions are
  // basically pipes in the pipeline, passing along the
  // modified document.
  // Side note: I suppose we could 'compose' the steps
  // like a giant reduce operation


  // Preprocessing operations
  this.filterComments(doc);
  this.filterElementsByName(doc);
  this.filterImages(doc);
  this.transformNoscripts(doc);
  this.filterInvisibleElements(doc);
  this.transformBreaks(doc);
  this.trimNodes(doc);
  this.filterEmptyElements(doc);

  // Feature extraction operations
  this.extractFeatures(doc);

  this.score(doc);
  this.filterAttributes(doc, options);
  var bestElement = lucu.calamine.findBestElement(doc);
  this.unwrapElements(doc, bestElement, options);
  this.markupOutput(doc, bestElement, options);

  var fragment = this.createFragment(doc, bestElement);

  // TODO: consider cleaning up the expando properties
  // before returning the fragment?

  return fragment;
};
