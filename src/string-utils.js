// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const StringUtils = {};

{ // BEGIN LEXICAL SCOPE

// Removes HTML elements from a string
function removeTags(string, replacement) {

  if(!string)
    return;

  const document = createHTMLDocument();
  document.body.innerHTML = string;
  
  if(!replacement) {
    return document.body.textContent;
  }

  const values = [];
  const iterator = document.createNodeIterator(
    document.body, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    values.push(node.nodeValue);
    node = iterator.nextNode();
  }
  return values.join(replacement);
}

StringUtils.removeTags = removeTags;

// Private helper for removeTags
function createHTMLDocument() {
  return document.implementation.createHTMLDocument();
}

// TODO: research the proper pattern
// /[^\x20-\x7E]+/g;
const RE_CONTROL_CHARACTER = /[\t\r\n]/g;

// TODO: rename to removeControlCharacters
function stripControlCharacters(string) {
  if(string) {
    return string.replace(RE_CONTROL_CHARACTER,'');
  }
}

StringUtils.stripControlCharacters = stripControlCharacters;

const ELLIPSIS = '\u2026';

// Truncates a string at the given position, and then appends
// the extension string. An ellipsis is appended if an 
// extension was not specified.
function truncate(string, position, extension) {
  if(string && string.length > position) {
    extension = extension || ELLIPSIS;
    return string.substr(0, position) + extension;
  }
  return string;
}

StringUtils.truncate = truncate;

} // END LEXICAL SCOPE
