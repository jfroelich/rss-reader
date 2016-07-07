// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes blacklisted elements from the document.
// This uses a blacklist approach instead of a whitelist because of issues
// with custom html elements. If I used a whitelist approach, any element
// not in the whitelist would be removed. The problem is that custom elements
// wouldn't be in the whitelist, but they easily contain valuable content.
function filterBlacklistedElements(document) {

  const ELEMENTS = [
    'APPLET', 'AUDIO', 'BASE', 'BASEFONT', 'BGSOUND', 'BUTTON', 'COMMAND',
    'DATALIST', 'DIALOG', 'EMBED', 'FIELDSET', 'FRAME', 'FRAMESET', 'HEAD',
    'IFRAME', 'INPUT', 'ISINDEX', 'LINK', 'MATH', 'META',
    'OBJECT', 'OUTPUT', 'OPTGROUP', 'OPTION', 'PARAM', 'PATH', 'PROGRESS',
    'SCRIPT', 'SELECT', 'SPACER', 'STYLE', 'SVG', 'TEXTAREA', 'TITLE',
    'VIDEO', 'XMP'
  ];
  const SELECTOR = ELEMENTS.join(',');

  // This checks for contains to try and reduce the number of remove calls

  const docElement = document.documentElement;
  const elements = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element)) {
      element.remove();
    }
  }
}
