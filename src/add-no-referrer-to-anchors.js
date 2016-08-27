// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Walks the document and appends a no referrer attribute to anchors.
// TODO: document the effect of doing this
function add_no_referrer_to_anchors(document) {
  const anchors = document.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}
