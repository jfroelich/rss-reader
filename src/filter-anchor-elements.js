// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Transform anchors that contain inline script or only serve a formatting role
// An anchor is a formatting anchor when it serves no other role than being a
// container. In this context, where formatting information is ignored, it is
// useless.
function filterAnchorElements(document) {
  const anchors = document.querySelectorAll('a');
  for(let i = 0, len = anchors.length; i < len; i++) {
    let anchor = anchors[i];

    if(!anchorElement.hasAttribute('href') &&
      !anchorElement.hasAttribute('name')) {
      unwrapElement(anchor);
    } else {
      const href = anchor.getAttribute('href');
      if(href && href.length > 11 && /^\s*javascript:/i.test(href)) {
        unwrapElement(anchor);
      }
    }
  }
}
