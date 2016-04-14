// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/string.js

// TODO: test malformed html
// TODO: fix entity handling (don't forget that the firstCarotPosition
// early escape thing also needs to consider entities)

// Regarding entities, the initial naive idea i have to simply encode entities
// then trim then decode.

// NOTE: if passing in a string containing a document element and
// a body element, the text outside of the body counts towards length (???)
// but is ignored in the output. Also if this type of input, this  still only
// returns text from within the body (not sure if that is an issue)
// NOTE: hidden elements irrevelant. This examines all text nodes in
// the body.
function html_truncate(inputString, position, extensionString) {
  'use strict';

  // Before dealing with html, check if we have input that may not contain
  // any html (of interest). If not, truncate using the faster and simpler
  // string_truncate method.
  const firstCarotPosition = inputString.indexOf('<');
  if(firstCarotPosition === -1) {
    return string_truncate(inputString, position, extensionString);
  }

  const doc = document.implementation.createHTMLDocument('dummy title');
  const docElement = doc.documentElement;
  docElement.innerHTML = inputString;
  // This must occur AFTER innerHTML is set
  const bodyElement = doc.body;

  const textNodeIterator = doc.createNodeIterator(bodyElement,
    NodeFilter.SHOW_TEXT);

  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let value = null;
  let valueLength = null;
  let node = textNodeIterator.nextNode();

  while(node) {

    if(!acceptingAdditionalTextNodes) {
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    value = node.nodeValue;
    valueLength = value.length;

    if(accumulatedLength + valueLength > position) {
      acceptingAdditionalTextNodes = false;
      node.nodeValue = string_truncate(value, position - accumulatedLength,
        extensionString);
    } else {
      accumulatedLength = accumulatedLength + valueLength;
    }

    node = textNodeIterator.nextNode();
  }

  // Return the truncated output html (from within body only!)
  return bodyElement.innerHTML;
}
