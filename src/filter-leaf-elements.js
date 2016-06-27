// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Removes leaf-like elements from the document. An element is a leaf unless
// it is a named exception, contains a non-whitespace-only text node, or
// contains at least one non-leaf child element.
// Because DOM modification is expensive, this tries to minimize the number
// of elements removed by only removing the shallowest elements. For example,
// when processing <outerleaf><innerleaf></innerleaf></outerleaf>, the naive
// approach would perform two operations, first removing the innerleaf and
// then the outerleaf. The outerleaf is also a leaf because upon removing the
// innerleaf, it then satisfies the is-leaf condition. Instead, this recognizes
// this situation, and only removes outerleaf. The cost of doing this is
// that the is-leaf function is recursive and nested elements are revisited.
// This still iterates over all of the elements, because using querySelectorAll
// is faster than walking. As a result, this also checks at each step of the
// iteration whether the current element is still attached to the document, and
// avoids removing elements that were detached by virtue of an ancestor being
// detached in a prior iteration step.
// TODO: think of a better way to avoid revisiting nodes
// TODO: figure out a way to avoid re-trimming text nodes. I feel like the
// bulk of the time is spent doing this.

function filterLeafElements(document) {
  const docElement = document.documentElement;
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  // These elements are never considered leaves, regardless of other criteria.
  // In general, these elements correspond to 'void' elements that generally
  // cannot contain child elements.
  // In an HTML document context, element.nodeName is always uppercase
  // I am using a plain old object instead of a Set because profiling showed
  // poor performance.
  const NON_LEAF_ELEMENTS = {
    'AREA': 1, 'AUDIO': 1, 'BASE': 1, 'COL': 1, 'COMMAND': 1, 'BR': 1,
    'CANVAS': 1, 'COL': 1, 'HR': 1, 'IFRAME': 1, 'IMG': 1, 'INPUT': 1,
    'KEYGEN': 1, 'META': 1, 'NOBR': 1, 'PARAM': 1, 'PATH': 1, 'SOURCE': 1,
    'SBG': 1, 'TEXTAREA': 1, 'TRACK': 1, 'VIDEO': 1, 'WBR': 1
  };

  // Only iterate elements within the body element. This prevents the body
  // element itself and the document element from also being iterated and
  // therefore identified as leaves and therefore removed in the case of an
  // empty document.
  const elements = bodyElement.querySelectorAll('*');

  // docElement.contains(docElement) returns true because docElement
  // is an inclusive descendant of docElement as defined in the spec. This is
  // why docElement itself can also be removed if this iterated over all
  // elements and not just those within the body.
  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let element of elements) {
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element) && isLeafNode(element)) {
      element.remove();
    }
  }

  function isLeafNode(node) {
    if(node.nodeType === Node.ELEMENT_NODE) {
      if(node.nodeName.toUpperCase() in NON_LEAF_ELEMENTS) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!isLeafNode(child)) {
          return false;
        }
      }

    } else if(node.nodeType === Node.TEXT_NODE) {
      return !node.nodeValue.trim();
    } else {
      return false;
    }

    return true;
  }
}
