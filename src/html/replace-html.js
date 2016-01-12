// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Replaces html elements within a string
// Dependency: parseHTML from parse-html.js
function replaceHTML(string, replacement) {
  'use strict';

  if(!string) {
    return string;
  }

  // NOTE: Rather than use some type of custom lexical analysis, I think it
  // makes more sense to use the heavier but safer and more accurate method of 
  // parseHTML (which uses the innerHTML gimmick).

  const document = parseHTML(string);
  const root = document.documentElement;

  // If there is no replacement specified, then use a much faster method
  if(!replacement) {
    return root.textContent;
  }

  // Grab all the text nodes and then join them together
  const values = [];
  const iterator = document.createNodeIterator(root, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {
    values.push(node.nodeValue);
    node = iterator.nextNode();
  }
  return values.join(replacement);
}
