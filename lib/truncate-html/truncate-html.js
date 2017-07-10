// See license.md

'use strict';

// TODO: use tokenizeHTML once implemented

// Truncates a string containing some html, taking special care not to
// truncate in the midst of a tag or an html entity. The transformation is
// lossy as some entities are not re-encoded (e.g. &#32;).
// The input string should be encoded, meaning that it should contain
// character entity codes. The extension string should be decoded, meaning
// that it should not contain character entries.
// NOTE: Using var due to deopt warning "unsupported phi use of const", c55

function truncateHTML(inputString, position, extensionString) {

  if(!Number.isInteger(position) || position < 0) {
    throw new TypeError();
  }

  var ellipsis = '\u2026';
  var extension = extensionString || ellipsis;
  var documentObject = document.implementation.createHTMLDocument();
  documentObject.documentElement.innerHTML = inputString;
  var nodeIterator = documentObject.createNodeIterator(
    documentObject.body, NodeFilter.SHOW_TEXT);
  var acceptingText = true;
  var totalLength = 0;

  for(var node = nodeIterator.nextNode(); node;
    node = nodeIterator.nextNode()) {
    if(!acceptingText) {
      node.remove();
      continue;
    }

    // Accessing nodeValue yields a decoded string
    var value = node.nodeValue;
    var valueLength = value.length;
    if(totalLength + valueLength >= position) {
      acceptingText = false;
      var remaining = position - totalLength;
      // Setting nodeValue will implicitly encode the string
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      totalLength = totalLength + valueLength;
    }
  }

  // If the document was an html fragment then exclude the tags implicitly
  // inserted when setting innerHTML
  var outputString;
  if(/<html/i.test(inputString)) {
    outputString = documentObject.documentElement.outerHTML;
  } else {
    outputString = documentObject.body.innerHTML;
  }

  return outputString;
}
