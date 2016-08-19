// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';


// Removes leaf-like elements from the document.
// Because DOM modification is expensive, this tries to minimize the number
// of elements removed by only removing the shallowest elements. For example,
// when processing <outerleaf><innerleaf></innerleaf></outerleaf>, the naive
// approach would perform two operations, first removing the innerleaf and
// then the outerleaf. The outerleaf is also a leaf because upon removing the
// innerleaf, it then satisfies the is-leaf condition. Instead, this recognizes
// this situation, and only removes outerleaf. The cost of doing this is
// that the is-leaf function is recursive and nested elements are revisited.
//
// This still iterates over all of the elements, because using querySelectorAll
// is faster than walking. As a result, this also checks at each step of the
// iteration whether the current element is still attached to the document, and
// avoids removing elements that were detached by virtue of an ancestor being
// detached in a prior iteration step.

// Only iterate elements within the body element. This prevents the body
// element itself and the document element from also being iterated and
// therefore identified as leaves and therefore removed in the case of an
// empty document.
// docElement.contains(docElement) returns true because docElement
// is an inclusive descendant of docElement as defined in the spec. This is
// why docElement itself can also be removed if this iterated over all
// elements and not just those within the body.

// contains is checked first because it is a native method that is faster than
// is_leaf_node, so this minimizes the calls to is_leaf_node

// This is not currently using for..of to iterate over the node list because of
// a V8 deoptimization warning (something about a try catch), my guess is that
// it has to do with how it is desugared

// TODO: think of a better way to avoid revisiting nodes

function filter_leaf_elements(doc) {
  if(!doc.body) {
    return;
  }

  const docElement = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(docElement.contains(element) && is_leaf_node(element)) {
      element.remove();
    }
  }
}
