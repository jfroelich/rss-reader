// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.deriveSiblingFeatures = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  lucu.element.forEach(elements,
    lucu.calamine.deriveElementSiblingFeatures);
};

// Cache a count of siblings and a count of prior siblings
lucu.calamine.deriveElementSiblingFeatures = function(element) {

  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;

  if(!element.siblingCount) {
    return;
  }

  // TODO: this could actually be improved by recognizing that
  // this function is called in document order over the elements at the
  // same level. Therefore we could easily just check if there
  // a previous sibling. If there is not, then we know the
  // previous sibling count is 0. If there is, then we know the
  // previousSiblingCount is just 1 + the previous
  // previousSiblingCount
  // One less inner loop would be nice.
  // It also makes the call more 'online' in that the back-history
  // buffer of recently processed elements could be 'smaller'
  // (of course, the entire doc is in mem so splitting hairs)

  var sibling = element.previousElementSibling;
  while(sibling) {
    element.previousSiblingCount++;
    sibling = sibling.previousElementSibling;
  }
};
