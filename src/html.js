// See license.md

'use strict';

// Returns a new string where html elements were replaced with the optional
// replacement string. HTML entities remain (except some will be
// replaced, like &#32; with space).
// TODO: maybe accept a whitelist of tags to keep
function replaceTags(inputString, repString) {

  if(typeof inputString !== 'string') {
    throw new TypeError('inputString not a string');
  }

  let outputString = null;
  const doc = document.implementation.createHTMLDocument();
  const bodyElement = doc.body;
  bodyElement.innerHTML = inputString;

  if(repString) {
    const it = doc.createNodeIterator(bodyElement, NodeFilter.SHOW_TEXT);
    let node = it.nextNode();
    const buffer = [];
    while(node) {
      buffer.push(node.nodeValue);
      node = it.nextNode();
    }

    outputString = buffer.join(repString);
  } else {
    outputString = bodyElement.textContent;
  }

  return outputString;
}

// Truncates a string containing some html, taking special care not to truncate
// in the midst of a tag or an html entity. The transformation is lossy as some
// entities are not re-encoded (e.g. &#32;).
// The input string should be encoded, meaning that it should contain character
// entity codes. The extension string should be decoded, meaning that it should
// not contain character entries.
function truncateHTML(inputString, position, inputExtension) {

  if(typeof inputString !== 'string') {
    throw new TypeError('inputString not a string');
  }

  if(!Number.isInteger(position) || position < 0) {
    throw new TypeError(`invalid position: ${position}`);
  }

  const ellipsis = '\u2026';
  const extension = inputExtension || ellipsis;

  const inertDoc = document.implementation.createHTMLDocument();
  inertDoc.documentElement.innerHTML = inputString;

  const it = inertDoc.createNodeIterator(inertDoc.body, NodeFilter.SHOW_TEXT);
  let acceptingText = true;
  let totalLength = 0;

  for(let node = it.nextNode(); node; node = it.nextNode()) {
    if(!acceptingText) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    const value = node.nodeValue;
    const valueLength = value.length;
    if(totalLength + valueLength >= position) {
      acceptingText = false;
      const remaining = position - totalLength;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      totalLength = totalLength + valueLength;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  if(/<html/i.test(inputString)) {
    return inertDoc.documentElement.outerHTML;
  } else {
    return inertDoc.body.innerHTML;
  }
}
