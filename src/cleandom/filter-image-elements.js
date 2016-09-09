// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: break apart into two functions that declare exactly what they do
// - note that filter-sourceless-images already exists
// TODO: rename to filterImages
function filterImageElements(document) {
  const images = document.querySelectorAll('img');
  for(let i = 0, len = images.length; i < len; i++) {
    let img = images[i];

    // Note the difference between an image without a certain attribute and an
    // image with the attribute but its value is empty or only whitespace. I am
    // sacrificing some accuracy in return for better speed.

    if(!img.hasAttribute('src') && !img.hasAttribute('srcset')) {
      img.remove();
    } else if(img.width < 2 || img.height < 2) {
      img.remove();
    }
  }
}
