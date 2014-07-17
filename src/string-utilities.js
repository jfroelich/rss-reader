// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// TODO: maybe name this something like string-select.js?
// I basically have a bunch of 'strip' functions and a count
// Even truncate is just a length based sql-like SELECT.

'use strict';

/**
 * Scrubs html from a string by parsing into HTML and then
 * back into text without element tags. Specifying a replacement is
 * slower because of non-native iteration.
 *
 * NOTE: depends on parseHTML
 */
function stripTags(str, replacement) {
  if(!str) {
    return;
  }

  var htmlDocumentBody = parseHTML(str);

  if(replacement) {

    var ownerDocument = htmlDocumentBody.ownerDocument;
    var textNodeIterator = ownerDocument.createNodeIterator(
      htmlDocumentBody, NodeFilter.SHOW_TEXT);
    var textNode;
    var textNodes = [];

    while(textNode = textNodeIterator.nextNode()) {
      textNodes.push(textNode);
    }

    return textNodes.map(getNodeValue).join(replacement);
  }

  return htmlDocumentBody.textContent;
}

// TODO: is there a native functional way to accomplish what this does?
function getNodeValue(node) {
  return node.nodeValue;
}

// Naive <br> removal
function stripBRs(str) {
  if(str) {
    return str.replace(/<br>/gi,'');
  }
}

/**
 * Returns a string without control-like characters
 *
 * TODO: this needs a better name
 * TODO: this doesn't actually strip all binaries
 * TODO: \t\r\n is approximately \s, and could just be \s ?
 * TODO: what's the diff between \s/g and \s+/g  ?
 */
function stripControls(string) {
  return string && string.replace(/[\t\r\n]/g,'');
}

/**
 * Returns a string that has been shortened
 * NOTE: rename to elide?
 * NOTE: Array.prototype.slice ?
 */
function truncate(str, position, extension) {
  return str && (str.length > position) ?
    str.substr(0,position) + (extension || '...') :
    str;
}

/**
 * Returns the frequency of ch in str.
 *
 * See http://jsperf.com/count-the-number-of-characters-in-a-string
 * I assume this is a hot spot so not using reduce or the
 * split.length-1 approach.
 */
function countChar(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }
  return count;
}