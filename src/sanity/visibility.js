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
// I cannot use the offsetWidth/offsetHeight tricks like how jQuery does
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
// this is not a one-time thing.
//
// I have mixed feelings about unwrapping hidden content. There is an ambiguity
// regarding whether the content is useful. It is either content subject to the
// un-hide trick, or it is content that is intentionally hidden for some
// unknown reason by the author. It does not happen very often anymore but
// some authors hide content maliciously to fool search engines or simply
// because it is remnant of drafting the page, or because it is auxillary
// stuff, or because it is part of some scripted component of the page.
//
// TODO: now that this unwraps, do additional testing to see if unwrapped
// content appears. Maybe a middle ground is to remove if removing does not
// leave an empty body. As in, if the parent is body, unwrap, otherwise
// remove.
// TODO: support aria hidden ?
// https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden

function sanity_filter_hidden_elements(document) {
  'use strict';

  // Document element is required.
  // TODO: maybe i do not need docElement, maybe
  // checking bodyElement.contains is sufficient.
  // Also, when would a document ever not have a documentElement? It seems
  // like this should be a runtime error that I do not catch. In other words
  // this is overly-defensive.
  const docElement = document.documentElement;
  if(!docElement) {
    return;
  }

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

  // Removing nodes that reside in a node already removed is harmless. However,
  // it is a wasted operation, and dom operations are generally expensive.

  // This checks 'contains' so as to avoid removing elements that were already
  // removed in a prior iteration. Nodes are walked in document order
  // because that is how querySelectorAll produces its NodeList content.
  // Therefore descendants are visisted after ancestors. Therefore it is
  // possible to iterate over descendants that reside in an ancestor that was
  // already removed.

  // I would prefer to not even visit such descendants. I suppose I could
  // use a TreeWalker. However, I have found that tree walking is very slow
  // in comparison to querySelectorAll and contains. However, I have not
  // tested this in a while so maybe it is worth it to experiment again.

  // Select from within body so as to exclude documentElement and body from
  // the set of elements analyzed. This is important because it prevents
  // the chance that the body and document element are removed.

  const elements = bodyElement.querySelectorAll(HIDDEN_SELECTOR);
  const numElements = elements.length;

  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    if(docElement.contains(element)) {
      dom_unwrap(element);
    }
  }
}
