// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity. The transformation is lossy as some
// entities are not re-encoded (e.g. &#32;).
//
// The input string should be encoded, meaning that it should contain character
// entity codes. The extension string should be decoded, meaning that it should
// not contain character entries.
function truncate_html(inputString, position, inputExtension) {
  console.assert(inputString, 'inputString is required');
  console.assert(position >= 0, 'position should be defined positive int');

  const ELLIPSIS = '\u2026';
  const extension = inputExtension || ELLIPSIS;

  const inertDocument = document.implementation.createHTMLDocument();
  inertDocument.documentElement.innerHTML = inputString;

  const iterator = inertDocument.createNodeIterator(inertDocument.body,
    NodeFilter.SHOW_TEXT);
  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;

  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    if(!acceptingAdditionalTextNodes) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    let value = node.nodeValue;
    let valueLength = value.length;
    if(accumulatedLength + valueLength >= position) {
      acceptingAdditionalTextNodes = false;

      let remaining = position - accumulatedLength;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      accumulatedLength = accumulatedLength + valueLength;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  const hasHTMLTag = /<html/i.test(inputString);
  if(hasHTMLTag) {
    return inertDocument.documentElement.outerHTML;
  } else {
    return inertDocument.body.innerHTML;
  }
}
