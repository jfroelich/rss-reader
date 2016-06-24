// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Current based on the following post:
// https://blog.fastmail.com/2016/06/20/everything-you-could-ever-want-to-know-
// and-more-about-controlling-the-referer-header/
// http://w3c.github.io/html/links.html#link-type-noreferrer
function addNoReferrer(document) {
  const anchors = document.querySelectorAll('a');
  for(let anchor of anchors) {
    anchor.setAttribute('rel', 'noreferrer');
  }
}
