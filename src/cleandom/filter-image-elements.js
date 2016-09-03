// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: break apart into two functions that declare exactly what they do
// - note that filter-sourceless-images already exists

function filter_image_elements(document) {
  const images = document.querySelectorAll('img');
  for(let i = 0, len = images.length; i < len; i++) {
    let img = images[i];
    if(!img.hasAttribute('src') &&
      !img.hasAttribute('srcset')) {
      img.remove();
    } else if(img.width < 2 || img.height < 2) {
      img.remove();
    }
  }
}
