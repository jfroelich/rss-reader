// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity.
//
// The input string should be encoded, meaning that it should contain
// character entities.
//
// Because entities are decoded then only some are re-encoded, not all entities
// will remain. For example, &#32; is not re-encoded.
//
// NOTE: this accepts full document html and partial fragments of html.
// However, due to some issues with using the built in dom parsing
// functionality, this may behave strangely when encountering "<html" within a
// string literal
// in a javascript string in a script tag, or in a comment, or in an attribute
// value. In such cases the output may be wrapped in <html><body></body></html>
// even though the input string did not contain those tags.
// NOTE: when truncating an input string representing the full contents of a
// document (e.g. contains <html><body>), this only examines text nodes
// within the body. text nodes outside of the body are ignored. Also, text
// nodes outside of the body do not affect position.
// NOTE: optionalExtensionString should not contain entities
// NOTE: createHTMLDocument creates an inert document, meaning that images
// are not pre-fetched, scripts are not evaluated, styles are not computed,
// etc.
// NOTE: using DOMParser is equivalent to createHTMLDocument
// NOTE: I cannot use template, doc frag, insertAdjacentHTML, or any other
// techniques, because of behavior when encountering input containing
// out of body elements like <html><body>.
// TODO: this feels like it could be optimized. Right now it is doing
// multiple passes over the input: parsing into document, walking the doc,
// and testing if fragment. I would prefer using a one-pass algorithm. The
// problem is that the alternative of manual string manipulation is slow and
// unsafe.
// TODO: what if i add a dummy element to head before setting innerHTML, then
// check if it was moved to body after setting docEl.innerHTML?
// Would that differentiate between the two situations? Also I would have to
// make sure to remove the dummy prior to traversal because it would be
// in the body.
function truncateHTMLString(inputString, position, optionalExtensionString) {
  const ELLIPSIS = '\u2026';
  const extensionString = optionalExtensionString || ELLIPSIS;

  const inertDocument = document.implementation.createHTMLDocument();
  inertDocument.documentElement.innerHTML = inputString;

  const textNodeIterator = inertDocument.createNodeIterator(
    inertDocument.body, NodeFilter.SHOW_TEXT);
  let acceptingAdditionalTextNodes = true;
  let accumulatedLength = 0;
  let value = null;
  let valueLength = 0;
  let remaining = 0;
  let node = textNodeIterator.nextNode();

  while(node) {
    if(!acceptingAdditionalTextNodes) {
      node.remove();
      node = textNodeIterator.nextNode();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    value = node.nodeValue;
    valueLength = value.length;

    if(accumulatedLength + valueLength >= position) {
      acceptingAdditionalTextNodes = false;
      // Calculate the distance into the current text node's value that should
      // be kept. It is the amount of room remaining based on how many
      // characters we have seen so far and the total amount of characters
      // allowed in the output (excluding tags and using decoded entities).
      remaining = position - accumulatedLength;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extensionString;
    } else {
      accumulatedLength = accumulatedLength + valueLength;
    }

    node = textNodeIterator.nextNode();
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
