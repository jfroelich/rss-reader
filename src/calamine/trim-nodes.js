// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// TODO: maybe rename this to something like transformWhitespace
// or filterWhitespace

lucu.calamine.trimNodes = function(doc) {

  // Marks code/pre elements as whitespaceImportant and then marks all direct and indirect
  // descendant elements as whiteSpaceImportant. Propagating this property from the top
  // down (cascading) enables the trimNode function to quickly determine whether its
  // nodeValue is trimmable, as opposed to having the trimNode function search each text
  // node's axis (path from root) for the presence of a pre/code element.

  var elements = doc.body.querySelectorAll('code, pre');

  lucu.element.forEach(elements, lucu.calamine.cascadeWhitespaceImportant);

  // TODO: replace &nbsp; with space

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  // Trim text nodes. If the text node is between two inline elements, it is not
  // trimmed. If the text node follows an inline element, it is right trimmed. If
  // the text node precedes an ineline element, it is left trimmed. Otherwise the
  // nodeValue is fully trimmed. Then, if the nodeValue is empty, remove the node.
  lucu.node.forEach(doc.body, NodeFilter.SHOW_TEXT, lucu.calamine.trimNode);

  // TODO: cleanup the whitespaceImportant expando?
};


lucu.calamine.cascadeWhitespaceImportant = function(element) {
  // Obviously, do not forget to mark the element itself
  lucu.calamine.setWhitespaceImportant(element);
  var descendants = element.getElementsByTagName('*');
  lucu.element.forEach(descendants, lucu.calamine.setWhitespaceImportant);
}

lucu.calamine.setWhitespaceImportant = function(element) {
  element.whitespaceImportant = 1;
};

lucu.calamine.trimNode = function(node) {

  // If whitespace is important then we do nothing
  if(node.parentElement.whitespaceImportant) {
    return;
  }

  // A node is either sandwiched between inline elements
  // or just preceding one or just trailing one

  if(lucu.element.isInline(node.previousSibling)) {
    if(!lucu.element.isInline(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimRight();
    }
  } else if(lucu.element.isInline(node.nextSibling)) {
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    node.nodeValue = node.nodeValue.trim();
  }

  // NOTE: the name of this function is misleading. There
  // is a blatant non-obvious side effect here. This also
  // removes text nodes that after trimming do not have
  // a value
  // TODO: think of a way to move this out of here or
  // make the side effect more explict.
  // This is a bit difficult since lucu.node just provides
  // lucu.node.forEach, meaning that we would have to
  // reiterate.  Maybe something with map/filter would
  // work?
  // I just don't like the idea of having to do a
  // second pass.

  if(!node.nodeValue) {
    node.remove();
  }
};
