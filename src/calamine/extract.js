// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

lucu.calamine.extractFeatures = function(doc) {

  // Expects this instanceof lucu.calamine

  lucu.node.forEach(doc.body, NodeFilter.SHOW_TEXT,
    this.deriveTextFeatures);

  var efe = lucu.element.forEach;
  // NOTE: this must be called after deriveTextFeatures because it
  // depends on charCount being set
  var anchors = doc.body.getElementsByTagName('a');
  efe(anchors, this.deriveAnchorFeatures);

  var elements = doc.body.getElementsByTagName('*');
  efe(elements, this.deriveAttributeFeatures);

  // TODO: why repeatedly query all elements??? can i just re-iterate
  // over the same node list (e.g. if I used querySelectorAll?)

  elements = doc.body.getElementsByTagName('*');
  efe(elements, this.deriveSiblingFeatures);
};


// Extract text features for text nodes and then propagate those properties
// upward in the dom (up to root)
// NOTE: think more about the situation <body>text</body> because right now
// it gets ignored
lucu.calamine.deriveTextFeatures = function(node) {

  var doc = node.ownerDocument;
  var body = doc.body;
  var parent = node.parentElement;
  var value = node.nodeValue;

  // TODO: this should be discrete not continuous
  parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(
    value) ? 1 : 0;

  parent.dotCount = lucu.string.countChar(value,'\u2022');

  parent.pipeCount = lucu.string.countChar(value,'|');

  // NOTE: we don't care about setting the count in the node itself
  // just in the parent element path to body

  var charCount = value.length - value.split(/[\s\.]/g).length + 1;

  while(parent != body) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
};

// Extract anchor features. Based on charCount from text features
lucu.calamine.deriveAnchorFeatures = function(anchor) {
  var doc = anchor.ownerDocument;
  var parent = anchor.parentElement;

  if(anchor.charCount && anchor.hasAttribute('href')) {
    anchor.anchorCharCount = anchor.charCount;

    while(parent != doc.body) {
      parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
      parent = parent.parentElement;
    }
  }
};

// Store id and class attribute values before attributes are removed
lucu.calamine.deriveAttributeFeatures = function(element) {
  var text = ((element.getAttribute('id') || '') + ' ' +
    (element.getAttribute('class') || '')).trim().toLowerCase();

  if(text) {
    element.attributeText = text;
  }
};

// Cache a count of siblings and a count of prior siblings
lucu.calamine.deriveSiblingFeatures = function(element) {

  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;

  if(!element.siblingCount) {
    return;
  }

  // TODO: this could actually be improved by recognizing that
  // this function is called in order over the elements at the
  // same level. Therefore we could easily just check if there
  // a previous sibling. If there is not, then we know the
  // previous sibling count is 0. If there is, then we know the
  // previousSiblingCount is just 1 + the previous
  // previousSiblingCount

  // One less inner loop would be nice.

  var sibling = element.previousElementSibling;
  while(sibling) {
    element.previousSiblingCount++;
    sibling = sibling.previousElementSibling;
  }
};
