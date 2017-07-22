// See license.md

'use strict';

function truncateHTML(inputString, position, extensionString) {
  if(!Number.isInteger(position) || position < 0) {
    throw new TypeError('Invalid position ' + position);
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

    var value = node.nodeValue;
    var valueLength = value.length;
    if(totalLength + valueLength >= position) {
      acceptingText = false;
      var remaining = position - totalLength;
      node.nodeValue = value.substr(0, remaining) + extension;
    } else {
      totalLength = totalLength + valueLength;
    }
  }

  var outputString;
  if(/<html/i.test(inputString)) {
    outputString = documentObject.documentElement.outerHTML;
  } else {
    outputString = documentObject.body.innerHTML;
  }

  return outputString;
}
