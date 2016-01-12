// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

// Finds the associated caption for an image element
// TODO: this could obviously be more efficient, maybe consider optimizing
function findImageCaption(image) {
  const parents = getNodeAncestors(image);
  const figure = parents.find(isFigureElement);
  if(figure) {
    return figure.querySelector('figcaption');
  }
}

// Export a global
this.findImageCaption = findImageCaption;

function isFigureElement(element) {
  // TODO: look into the canonical way of doing this.
  // e.g. is it more standard to use tagName?
  // return element instanceof HTMLFigureElement;
  return element.localName === 'figure';
}

}
