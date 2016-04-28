// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for removing blacklisted elements. This fulfills multiple purposes.
// Certain blacklisted elements are unwrapped instead of removed and that
// is handled by other sanity functionality.

const SANITY_BLACKLISTED_ELEMENTS = [
  'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
  'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
  'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
  'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
  'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
  'VIDEO', 'XMP'
];

const SANITY_BLACKLIST_SELECTOR = SANITY_BLACKLISTED_ELEMENTS.join(',');

// Removes blacklisted elements from the document.
// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
function sanity_filter_blacklisted_elements(document) {
  const docElement = document.documentElement;
  const elements = document.querySelectorAll(SANITY_BLACKLIST_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}
