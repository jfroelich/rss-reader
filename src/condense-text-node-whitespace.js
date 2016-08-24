// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// NOTE: perf testing showed that querying the ancestors per node is faster
// than generating a set of descendants of sensitive nodes and checking
// membership

const SELECTOR = ['code', 'pre', 'ruby', 'textarea', 'xmp'].join(',');

this.condense_text_node_whitespace = function(doc) {
  const it = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {

    // Note that accessing node value partially decodes (or is it encodes)
    // the raw node value.
    // TODO: double check this, this may be why this function matches so little
    // whitespace.
    const value = node.nodeValue;

    // The length check reduces calls to closest which is expensive.
    // closest is not defined on text nodes, only elements, so use parentNode
    // parentNode is guaranteed defined for text nodes and is always an element
    // closest is self-inclusive so this still works for immediate children
    // Not using an idiomatic function call due to perf
    if(value.length > 3 && !node.parentNode.closest(SELECTOR)) {

      // This is not an idiomatic function call due to perf. This regex looks
      // for two or more whitespace characters and replaces them with a single
      // space.
      // TODO: do I want to restrict this to actual spaces and not all
      // whitespace? \s matches a ton of entities.
      let condensed_value = value.replace(/\s{2,}/g, ' ');

      // Setting node value can be expensive so try and avoid it
      if(condensed_value !== value) {
        node.nodeValue = condensed_value;
      }
    }
  }
};

} // End file block scope
