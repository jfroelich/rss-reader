// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Transform anchors that contain inline script or only serve a formatting role
// An anchor is a formatting anchor when it serves no other role than being a
// container. In this context, where formatting information is ignored, it is
// useless.
function filter_anchor_elements(document) {
  const anchors = document.querySelectorAll('a');
  for(let i = 0, len = anchors.length; i < len; i++) {
    const anchor = anchors[i];
    const href = anchor.getAttribute('href');

    if(!href && !anchor.hasAttribute('name')) {
      unwrap_element(anchor);
    } else if(href && href.length > 11 && /^\s*javascript:/i.test(href)) {
      unwrap_element(anchor);
    }
  }
}
