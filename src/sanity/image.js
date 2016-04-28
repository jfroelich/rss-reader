// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Currently this only removes img elements without a source.
// Images may be removed by other components like in notrack.js
function sanity_filter_images(document) {
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const imageNodeList = bodyElement.querySelectorAll('IMG');
  const listLength = imageNodeList.length;
  for(let i = 0, imageElement; i < listLength; i++) {
    imageElement = imageNodeList[i];
    if(!imageElement.hasAttribute('src') &&
      !imageElement.hasAttribute('srcset')) {
      imageElement.remove();
    }
  }
}
