// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};



/**
 * Removes leading and trailing whitespace nodes from an HTMLDocument
 * The doc object itself is modified in place, no return value.
 * Note: we only traverse the first level of the DOM hiearchy
 */
lucu.trimDocument = function(doc) {

  var rootElement = doc.body;

  // Trim leading
  var node = rootElement.firstChild, sibling;
  while(node && lucu.isTrimmableNode(node)) {
    sibling = node.nextSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }

  // Trim trailing
  node = rootElement.lastChild;
  while(node && lucu.isTrimmableNode(node)) {
    sibling = node.previousSibling;
    node.parentNode.removeChild(node);
    node = sibling;
  }
};

/**
 * Returns true if the node is trimmable. Note
 * side effect it will trim text nodes (not quite right)
 */
lucu.isTrimmableNode = function(node) {

  // Trim comments
  if(node.nodeType == Node.COMMENT_NODE) {
    return true;
  }

  // Trim empty text nodes.
  if(node.nodeType == Node.TEXT_NODE) {
    node.textContent = node.textContent.trim();
    if(node.textContent.length == 0) {
      return true;
    }
  }

  if(node.matches && node.matches('br')) {
    return true;
  }

  // Trim empty paragraphs.
  if(node.matches && node.matches('p')) {
    // This works for several cases. For it to be really accurate we would have
    // to something like a DFS that trims while backtracking over a set of allowed
    // child tags. Those situations are probably more rare and it is for only a small
    // benefit so this is probably sufficient.

    // TODO: consider &nbsp; and other whitespace entities. We are not at this
    // point sanitizing those. <p>&nbsp;</p> is a thing.

    // Note: consider childElementCount instead of childNodes.length. Although it might
    // be different here? Need to test the differences.

    if(node.childNodes.length == 0) {
      // <p></p>
      return true;
    } else if(node.childNodes.length == 1 && node.firstChild.nodeType == Node.TEXT_NODE &&
      node.firstChild.textContent.trim().length == 0) {
      // <p>whitespace</p>
      return true;
    }
  }
};
