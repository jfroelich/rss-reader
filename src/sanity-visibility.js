// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Sanity helper functions for dealing with hidden elements.
// Requires: /src/dom.js
//
// Filters hidden elements from a document. This originally was more accurate
// because it checked computed style. However that turned out to be terribly
// slow. So instead, this uses a gimmick with query selectors to look for
// inline elements. This does not consider styles from linked css files as
// those are removed anyway. I might consider writing a document preprocessor
// that inlines all styles. As a result of the gimmick, it is less accurate
// but it is much faster.
//
// NOTE: i cannot use the offsetWidth/offsetHeight tricks like how jQuery does
// this because that trick only works for live documents. This is designed
// to work with an inert document such as one produceed by
// XMLHttpRequest.responseXML or DOMParser or
// document.implementation.createHTMLDocument. offsetWidth and offsetHeight
// are 0 for all elements in an inert document.
//
// This originally removed elements. Now it just unwraps. This helps avoid
// an issue with documents that wrap all content in a hidden element and then
// dynamically unhide the element. For example:
// view-source:http://stevehanov.ca/blog/index.php?id=132. This pages uses
// a main div with inline visibility hidden, and then uses an inline script
// at the bottom of the page that sets the visibility to visible. I also
// think this is a document produced by Macromedia Dreamweaver, so I think
// this issue is more prevalent.
//
// TODO: now that this unwraps, do additional testing to see if unwrapped
// content appears. Maybe a middle ground is to remove if removing does not
// leave an empty body. As in, if the parent is body, unwrap, otherwise
// remove.
// TODO: support aria hidden ?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden

function sanity_filter_hidden_elements(document) {
  'use strict';

  const docElement = document.documentElement;

  // Document element is required.
  if(!docElement) {
    return;
  }

  // TODO: maybe i do not need docElement, maybe
  // checking bodyElement.contains is sufficient.

  // Body is required.
  const bodyElement = document.body;
  if(!bodyElement) {
    return;
  }

  const HIDDEN_SELECTOR = [
    '[style*="display:none"]',
    '[style*="display: none"]',
    '[style*="visibility:hidden"]',
    '[style*="visibility: hidden"]',
    '[style*="opacity:0.0"]'
  ].join(',');

  // Select from within body so as to exclude documentElement and body from
  // the set of elements analyzed.
  const elements = bodyElement.querySelectorAll(HIDDEN_SELECTOR);
  const numElements = elements.length;

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      dom_unwrap(element);
    }
  }
}
