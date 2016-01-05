// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Dependency: moveElementsBySelector

function filterBlacklistedElements(document) {
  'use strict';

  const blacklist = [
    'applet',
    'object',
    'embed',
    'param',
    'video',
    'audio',
    'bgsound',
    'head',
    'meta',
    'title',
    'datalist',
    'dialog',
    'fieldset',
    'isindex',
    'math',
    'output',
    'optgroup',
    'progress',
    'spacer',
    'xmp',
    'style',
    'link',
    'basefont',
    'select',
    'option',
    'textarea',
    'input',
    'button',
    'command'
  ];

  const blacklistSelector = blacklist.join(',');
  moveElementsBySelector(document, null, blacklistSelector);
}
