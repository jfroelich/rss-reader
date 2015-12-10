// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: rename to extractImageParentBias

// Bias image containers
function analyzeImages(document) {

  const scores = new Map();

  const images = document.getElementsByTagName('img');
  const numImages = images.length;
  let image = null;
  let parent = null;
  let area = 0;
  let caption = null;
  let children = null;
  let numChildren = 0;
  let node = null;
  let bias = 0.0;
  let j = 0;

  for(let i = 0; i < numImages; i++) {
    image = images[i];
    parent = image.parentElement;

    if(!parent) {
      continue;
    }

    bias = 0.0;

    // Dimension bias
    if(image.width && image.height) {
      area = image.width * image.height;
      bias += 0.0015 * Math.min(100000, area);
    }

    // Description bias
    // TODO: check data-alt and data-title?
    if(image.getAttribute('alt')) {
      bias += 20.0;
    }

    if(image.getAttribute('title')) {
      bias += 30.0;
    }

    caption = DOMUtils.findCaption(image);
    if(caption) {
      bias += 50.0;
    }

    // Carousel bias
    children = parent.childNodes;
    numChildren = children.length;
    for(j = 0; j < numChildren; j++) {
      node = children[j];
      if(node !== image && node.localName === 'img') {
        bias = bias - 50.0;
      }
    }

    if(bias) {
      scores.set(parent, (scores.get(parent) || 0.0) + bias);
    }
  }

  return scores;
}

this.analyzeImages = analyzeImages;

} // END ANONYMOUS NAMESPACE
