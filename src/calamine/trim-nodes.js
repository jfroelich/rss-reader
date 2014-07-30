// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function calamineTrimNodes(doc) {
  // Marks code/pre elements as whitespaceImportant and then marks all direct and indirect
  // descendant elements as whiteSpaceImportant. Propagating this property from the top
  // down (cascading) enables the trimNode function to quickly determine whether its
  // nodeValue is trimmable, as opposed to having the trimNode function search each text
  // node's axis (path from root) for the presence of a pre/code element.
  lucu.element.forEach(doc.body.querySelectorAll('code, pre'), function(element) {
    element.whitespaceImportant = 1;
    lucu.element.forEach(element.getElementsByTagName('*'), function(descendantElement) {
      descendantElement.whitespaceImportant = 1;
    });
  });

  // TODO: replace &nbsp; with space

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  // Trim text nodes. If the text node is between two inline elements, it is not
  // trimmed. If the text node follows an inline element, it is right trimmed. If
  // the text node precedes an ineline element, it is left trimmed. Otherwise the
  // nodeValue is fully trimmed. Then, if the nodeValue is empty, remove the node.
  lucu.node.forEach(doc.body, NodeFilter.SHOW_TEXT, function(node) {
    if(!node.parentElement.whitespaceImportant) {
      if(lucu.element.isInline(node.previousSibling)) {
        if(!lucu.element.isInline(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimRight();
        }
      } else if(lucu.element.isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimLeft();
      } else {
        node.nodeValue = node.nodeValue.trim();
      }

      if(!node.nodeValue) {
        node.remove();
      }
    }
  });



  // TODO: cleanup the whitespaceImportant expando?
}