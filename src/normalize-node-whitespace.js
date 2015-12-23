// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Normalizes the values of all text nodes in a document
// NOTE: this should not be confused with Node.prototype.normalize
// TODO: condense consecutive whitespace?
// TODO: this would have to only occur in non-whitespace sensitive context
//value = value.replace(/[ ]{2,}/g, ' ');
function normalizeNodeWhitespace(document) {
  'use strict';

  const TRIVIAL_VALUES = new Set([
    '\n', '\n\t', '\n\t\t'
  ]);

  const NBSP_PATTERN = /&nbsp;/g;

  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    let value = node.nodeValue;
    if(!TRIVIAL_VALUES.has(value)) {
      value = value.replace(NBSP_PATTERN, ' ');
      node.nodeValue = value;
    }
    node = iterator.nextNode();
  }
}
