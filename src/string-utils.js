// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const StringUtils = {};

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
StringUtils.replaceHTML = function(inputString, replacementString) {
  let outputString = null;

  const doc = document.implementation.createHTMLDocument();
  const bodyElement = doc.body;
  bodyElement.innerHTML = inputString;

  if(replacementString) {
    const it = doc.createNodeIterator(bodyElement, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    const nodeValueBuffer = [];
    while(node) {
      nodeValueBuffer.push(node.nodeValue);
      node = it.nextNode();
    }

    outputString = nodeValueBuffer.join(replacementString);
  } else {
    outputString = bodyElement.textContent;
  }

  return outputString;
};

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity. The transformation is lossy as some
// entities are not re-encoded (e.g. &#32;).
//
// The input string should be encoded, meaning that it should contain character
// entity codes. The extension string should be decoded, meaning that it should
// not contain character entries.
StringUtils.truncateHTML = function(inputString, position,
  optionalDecodedExtensionString) {

  console.assert(inputString, 'inputString should be defined');
  console.assert(position >= 0, 'position should be defined positive int');

  const ELLIPSIS = '\u2026';
  const extension = optionalDecodedExtensionString || ELLIPSIS;

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
};

// Truncates a string at the given position, and then appends the extension
// string.
// If the extension is null or undefined or not a string, then an ellipsis
// is appended.
// If the extension is an empty string, then nothing is appended.
// If the extension is a non-empty string, then the extension is appended.
StringUtils.truncateString = function(string, position, optionalExtension) {

  console.assert(!isNaN(position), 'invalid position %s', position);

  const ELLIPSIS_CHARACTER = '\u2026';
  if(string && string.length > position) {
    let extensionString = null;

    if(typeof optionalExtension === 'string') {
      extensionString = optionalExtension;
    } else {
      extensionString = ELLIPSIS_CHARACTER;
    }

    if(extensionString) {
      return string.substr(0, position) + extensionString;
    } else {
      return string.substr(0, position);
    }
  }
  return string;
};
