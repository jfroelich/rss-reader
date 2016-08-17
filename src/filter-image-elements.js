// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filter_image_elements(document) {
  const images = document.querySelectorAll('img');

  for(let i = 0, len = images.length; i < len; i++) {
    let imageElement = images[i];
    if(!imageElement.hasAttribute('src') &&
      !imageElement.hasAttribute('srcset')) {
      imageElement.remove();
    } else if(imageElement.width < 2 || imageElement.height < 2) {
      imageElement.remove();
    }
  }
}
