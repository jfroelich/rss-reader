// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: this only deals with images, no need to be more abstract, rename
// to filterTracerImages

// Removes images that do not have a source url or that appear to be tracers.
// A tracer image is a tracking technique where some websites embed a small,
// hidden image into a document and then track the requests for that image
// using a traditional web request log analytics tool. This function considers
// width and height independently, resulting in removal of images that appear
// like horizontal rule elements or vertical bars, which is also desired.

// NOTE: this assumes that images without explicit dimensions were pre-analyzed
// by setImageDimensions. If there is a simple way to check if an image's
// dimensions are not set, maybe this disambiguates what image.width=0 means.

function filterTracerElements(document) {
  'use strict';
  const images = document.querySelectorAll('img');
  const imagesLength = images.length;

  for(let i = 0, image; i < imagesLength; i++) {
    image = images[i];
    if(image.width < 2 || image.height < 2) {
      image.remove();
    }
  }
}
