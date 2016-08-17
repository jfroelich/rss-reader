// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: figure out a way to avoid re-trimming text nodes. I feel like the
// bulk of the time is spent doing this.

// Certain elements, typically those that are defined as void elements in the
// spec, can readily appear to be leaves, but should not be considered leaves.
// I am using a plain object instead of a Set because profiling showed
// poor performance.
const EXCEPTIONS = {
  'area': 1, 'audio': 1, 'base': 1, 'col': 1, 'command': 1, 'br': 1,
  'canvas': 1, 'col': 1, 'hr': 1, 'iframe': 1, 'img': 1, 'input': 1,
  'keygen': 1, 'meta': 1, 'nobr': 1, 'param': 1, 'path': 1, 'source': 1,
  'sbg': 1, 'textarea': 1, 'track': 1, 'video': 1, 'wbr': 1
};

//An element is a leaf unless
// it is a named exception, contains a non-whitespace-only text node, or
// contains at least one non-leaf child element.
// Recursive
this.is_leaf_node = function(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(node.localName in EXCEPTIONS) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!is_leaf_node(child)) {
          return false;
        }
      }
      break;
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
};

} // End file block scope
