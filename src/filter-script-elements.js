// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: misc event handler attributes for all elements are handled by
// filterAttributes, which uses a whitelist approach

// NOTE: Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com. I was originally unwrapping noscripts but it was
// leading to lots of garbage content. For now I am just removing until
// I give this more thought.

function filterScriptElements(document) {
  'use strict';

  DOMUtils.removeElementsBySelector(document, 'script, noscript');

  // Disable anchors that use javascript protocol. Keep the href
  // around for boilerplate analysis. Note this selects only
  // anchors with a href attribute to reduce the number of anchors
  // iterated.
  const anchors = document.querySelectorAll('a[href]');
  for(let i = 0, len = anchors.length, anchor; i < len; i++) {
    anchor = anchors[i];
    if(anchor.protocol === 'javascript:') {
      anchor.setAttribute('href', '');
    }
  }
}
