// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filterSourcelessImages(document) {
  const images = document.querySelectorAll('img');
  for(let image of images) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    }
  }
}
