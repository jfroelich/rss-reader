// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: this only sanitizes text nodes within the body element.
// TODO: delete all text nodes outside of the body?
function sanity_condense_whitespace(document) {
  'use strict';


  // NOTE: node.nodeValue yields a decoded value without entities, not the
  // raw encoded value that contains entities.
  // NOTE: node.nodeValue is guaranteed defined, otherwises the text node
  // would not exist.

  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // The whitespace of text nodes within these elements is important.
  const SENSITIVE_ELEMENTS = ['CODE', 'PRE', 'RUBY', 'TEXTAREA', 'XMP'];
  const SENSITIVE_SELECTOR = SENSITIVE_ELEMENTS.join(',');

  const iterator = document.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);
  for(let node = iterator.nextNode(), value, condensedValue; node;
    node = iterator.nextNode()) {
    value = node.nodeValue;

    // The length check minimizes the number of calls to closest and the
    // regexp, which are costly.
    if(value.length > 3) {
      // Check if the current text node is a descendant of a whitespace
      // sensitive element.
      if(!node.parentNode.closest(SENSITIVE_SELECTOR)) {
        // Condense consecutive spaces
        condensedValue = value.replace(/\s{2,}/g, ' ');

        // We only bother to set nodeValue if we changed it. Setting nodeValue
        // is actually a pretty costly operation that involves parsing entities
        // and such, so avoid it if possible.
        if(condensedValue !== value) {
          // NOTE: the value will be re-encoded automatically for us.
          node.nodeValue = condensedValue;
        }
      }
    }
  }
}
