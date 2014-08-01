// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.calamine = lucu.calamine || {};

// Extract text features for text nodes and then propagate those properties
// upward in the dom (up to root)
// NOTE: think more about the situation <body>text</body> because right now
// it gets ignored
lucu.calamine.deriveTextFeatures = function(doc) {

  lucu.node.forEach(doc.body, NodeFilter.SHOW_TEXT,
    lucu.calamine.deriveTextFeaturesForNode);

};

lucu.calamine.deriveTextFeaturesForNode = function(node) {
  var doc = node.ownerDocument;
  var body = doc.body;
  var parent = node.parentElement;
  var value = node.nodeValue;

  // TODO: this should be using the copyright character itself as well
  // TODO: this should be acting upon text that normalized the variants
  // TODO: this should be discrete not continuous
  parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(
    value) ? 1 : 0;

  // TODO: this should also be looking for the dot character itself
  parent.dotCount = lucu.string.countChar(value,'\u2022');

  // TODO: this should also be looking at other expressions of pipes
  parent.pipeCount = lucu.string.countChar(value,'|');

  // NOTE: we don't care about setting the count in the node itself
  // just in the parent element path to body

  var charCount = value.length - value.split(/[\s\.]/g).length + 1;

  while(parent != body) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
};