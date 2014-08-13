// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.string = {};

/**
 * Scrubs html from a string by parsing into HTML and then
 * back into text without element tags.
 *
 * NOTE: requires lucu.html.parse
 */
lucu.string.stripTags = function(string, replacement) {
  if(!string) {
    return;
  }

  var htmlDocumentBody = lucu.html.parse(string);

  if(!replacement) {
    return htmlDocumentBody.textContent;
  }

  var ownerDocument = htmlDocumentBody.ownerDocument;
  var textNodeIterator = ownerDocument.createNodeIterator(
    htmlDocumentBody, NodeFilter.SHOW_TEXT);
  var textNode;
  var textNodes = [];

  while(textNode = textNodeIterator.nextNode()) {
    textNodes.push(textNode);
  }

  return textNodes.map(lucu.string.getNodeValue_).join(replacement);
};

// priate helper for above
lucu.string.getNodeValue_ = function(node) {
  return node.nodeValue;
}

// Naive <br> removal
lucu.string.stripBRs = function(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
};

/**
 * Returns a string without control-like characters
 *
 * TODO: this needs a better name
 * TODO: this doesn't actually strip all binary control characters, I need to
 * review those
 * TODO: \t\r\n is approximately \s, and could just be \s ?
 * TODO: what's the diff between \s/g and \s+/g  ?
 */
lucu.string.stripControls = function(string) {
  return string && string.replace(/[\t\r\n]/g,'');
};

/**
 * Returns a string that has been shortened
 * NOTE: rename to elide?
 * NOTE: Array.prototype.slice ?
 */
lucu.string.truncate = function(str, position, extension) {
  return str && (str.length > position) ?
    str.substr(0,position) + (extension || '...') :
    str;
};
