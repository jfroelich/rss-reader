// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: modularize, split up functions

function calamineExtractFeaturesInDocument(doc) {

  var body = doc.body;
  var forEach = Array.prototype.forEach;

  // Extract text features for text nodes and then propagate those properties
  // upward in the dom (up to root)
  lucu.node.forEach(body, NodeFilter.SHOW_TEXT, function deriveTextFeatures(textNode) {
    var parent = textNode.parentElement;

    // TODO: this should be discrete not continuous
    parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(textNode.nodeValue) ? 1 : 0;
    parent.dotCount = lucu.string.countChar(textNode.nodeValue,'\u2022');
    parent.pipeCount = lucu.string.countChar(textNode.nodeValue,'|');

    var charCount = textNode.nodeValue.length - textNode.nodeValue.split(/[\s\.]/g).length + 1;

    while(parent != body) {
      parent.charCount = (parent.charCount || 0) + charCount;
      parent = parent.parentElement;
    }
  });

  // Extract anchor features. Based on charCount from text features
  lucu.element.forEach(body.getElementsByTagName('a'), function deriveAnchorFeatures(anchor) {
    var parent = anchor.parentElement;

    if(anchor.charCount && anchor.hasAttribute('href')) {
      anchor.anchorCharCount = anchor.charCount;

      while(parent != body) {
        parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
        parent = parent.parentElement;
      }
    }
  });

  // Store id and class attribute values before attributes are removed
  lucu.element.forEach(body.getElementsByTagName('*'), function (element) {
    var text = ((element.getAttribute('id') || '') + ' ' +
      (element.getAttribute('class') || '')).trim().toLowerCase();

    if(text) {
      element.attributeText = text;
    }
  });

  // Cache a count of siblings and a count of prior siblings
  lucu.element.forEach(body.getElementsByTagName('*'), function(element) {
    element.siblingCount = element.parentElement.childElementCount - 1;
    element.previousSiblingCount = 0;
    if(element.siblingCount) {
      var sibling = element.previousElementSibling;
      while(sibling) {
        element.previousSiblingCount++;
        sibling = sibling.previousElementSibling;
      }
    }
  });
}
