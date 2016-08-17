// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function filter_sourceless_images(document) {
  for(let image of document.querySelectorAll('img')) {
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      image.remove();
    }
  }
}
