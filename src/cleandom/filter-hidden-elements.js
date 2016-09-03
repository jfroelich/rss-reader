// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const HIDDEN_SELECTOR = [
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
  '[style*="opacity: 0.0"]',
  '[aria-hidden="true"]'
].join(',');

// Filters some hidden elements from a document. This is designed for speed,
// not accuracy. This does not check element.style due to performance issues.
// The contains check avoids removing nodes in detached subtrees. Elements are
// unwrapped instead of specifically removed to avoid removing valuable
// content in the case of documents wrapped in a hidden div or similar.
function filter_hidden_elements(doc) {
  const elements = doc.querySelectorAll(HIDDEN_SELECTOR);
  const doc_el = doc.documentElement;

  // Not using for..of due to V8 deopt warning about try/catch
  // Check not doc el because its not possible to unwrap the doc el but that
  // check is not made by unwrap.

  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(element !== doc_el && doc_el.contains(element)) {
      unwrap_element(element);
    }
  }
}

this.filter_hidden_elements = filter_hidden_elements;

} // End file block scope
