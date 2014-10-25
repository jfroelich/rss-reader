// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * String utilities
 */
(function(exports) {
'use strict';

/**
 * Scrubs html from a string by parsing into HTML and then
 * back into text without element tags.
 */
exports.stripTags = function(string, replacement) {
  if(!string) return;
  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = string;
  if(!replacement) return doc.body.textContent;
  var iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var textNode;
  var textNodes = [];
  while(textNode = iterator.nextNode()) {
    textNodes.push(textNode);
  }
  var nodeValues = textNodes.map(function (node) {
    return node.nodeValue;
  });
  return nodeValues.join(replacement);
};

/**
 * Returns a string without control-like characters
 * NOTE: this only affects certain control chars, not all
 */
exports.stripControls = function(string) {
  return string && string.replace(/[\t\r\n]/g,'');
};

/**
 * Returns a string that has been shortened
 */
exports.truncate = function(str, position, extension) {
  return str && (str.length > position) ?
    str.substr(0,position) + (extension || '...') :
    str;
};

}(lucu));