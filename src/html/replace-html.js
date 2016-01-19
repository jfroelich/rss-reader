// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /html/parse-html.js

'use strict';

{ // BEGIN FILE SCOPE

// Returns a new string where html elements were replaced with the replacement
// string. The replacement is optional.
function replaceHTML(inputString, replacement) {
  let outputString = null;
  if(inputString) {
    const document = parseHTML(inputString);
    if(replacement) {
      const nodes = selectTextNodes(document);
      const values = nodes.map(getNodeValue);
      outputString = values.join(replacement);
    } else {
      outputString = document.documentElement.textContent;
    }
  }

  return outputString;
}

this.replaceHTML = replaceHTML;

function selectTextNodes(document) {
  const nodes = [];
  const iterator = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    nodes.push(node);
    node = iterator.nextNode();
  }
  return nodes;
}

function getNodeValue(node) {
  return node.nodeValue;
}

} // END FILE SCOPE
