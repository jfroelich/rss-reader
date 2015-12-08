// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Removes hidden elements from a document.
function filterHiddenElements(document) {
  'use strict';

  // NOTE: this originally iterated over all elements and tested against
  // each element's style property. Performance analysis showed this was
  // very slow. So we sacrifice accuracy to move most of the traveral
  // operations to a native querySelectorAll call. The selectors here do
  // not match ALL hidden elements. I think this is ok. First, we
  // are only looking at inline styles and not considering the other
  // relevant CSS, so we are already simplifying the problem and allowing
  // for hidden elements. Second, hidden elements do not show up in the
  // output. This is really only a component of compression, which isn't
  // the primary purpose of the overall application. It may have some
  // impact on boilerplate analysis, but I haven't given that too much
  // consideration.

  const substrings = [
    'display:none',
		'display: none',
		'visibility:hidden',
		'visibility: hidden',
		'opacity:0.0',
		'opacity: 0.0',
		'opacity:0'
  ];

  const selector = substrings.map(function wrapSubstring(string) {
    return '[style*="' + string + '"]';
  }).join(',');

  // NOTE: we could consider using moveElementsBySelector here, but
  // I don't think there is much of a benefit, because HTML authors rarely
  // nest inline-styled hidden elements within other inline-styled hidden
  // elements. It would probably be worse.

  DOMUtils.removeElementsBySelector(document, selector);
}
