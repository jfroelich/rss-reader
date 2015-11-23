// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const TrackingFilter = {};

// Removes images that do not have a source url or that appear to be tracers. 
// A tracer image is a tracking technique where some websites embed a small, 
// hidden image into a document and then track the requests for that image 
// using a traditional web request log analytics tool. This function considers
// width and height independently, resulting in removal of images that appear
// like horizontal rule elements or vertical bars, which is also desired.

// NOTE: this assumes that images without explicit dimensions were pre-analyzed
// by DocumentUtils.setImageDimensions

{ // BEGIN ANONYMOUS NAMESPACE

TrackingFilter.transform = function TrackingFilter$Transform(document) {
  const images = document.querySelectorAll('img');
  const length = images.length;
  for(let i = 0; i < length; i++) {
    const image = images[i];
    const source = (image.src || '').trim();
    if(!source || image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
};

} // END ANONYMOUS NAMESPACE
