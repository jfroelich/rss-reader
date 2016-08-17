// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Filters hidden elements from a document. This originally was more accurate
// because it checked computed style. However that turned out to be terribly
// slow. So instead, this uses a gimmick with query selectors to look for
// inline elements.

// This does not consider styles from linked css files as
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
// think this is a document produced by Macromedia Dreamweaver, so
// this is not pathological.
//
// I have mixed feelings about revealing hidden content. There is an ambiguity
// regarding whether the content is useful. It is either content subject to the
// un-hide trick, or it is content that is intentionally hidden for some
// unknown reason by the author. It does not happen very often anymore but
// some authors hide content maliciously to fool search engines or simply
// because it is remnant of drafting the page, or because it is auxillary
// stuff, or because it is part of some scripted component of the page.
// TODO: now that this unwraps, do additional testing to see if unwrapped
// content appears. Maybe a middle ground is to remove if removing does not
// leave an empty body. As in, if the parent is body, unwrap, otherwise
// remove.

// Removing nodes that reside in a node already removed is harmless. However,
// it is a wasted operation, and dom operations are generally expensive.
// This checks 'contains' so as to avoid removing elements that were already
// removed in a prior iteration. Nodes are walked in document order
// because that is how querySelectorAll produces its NodeList content.
// Therefore descendants are visisted after ancestors. Therefore it is
// possible to iterate over descendants that reside in an ancestor that was
// already removed.
// I would prefer to not even visit such descendants. I suppose I could
// use a TreeWalker. However, I have found that tree walking is slow.
// However, maybe it is worth it to experiment again.

function filter_hidden_elements(document) {
  const elements = select_hidden_elements(document);
  const docElement = document.documentElement;
  for(let i = 0, len = elements.length; i < len; i++) {
    let element = elements[i];
    if(element !== docElement && docElement.contains(element)) {
      unwrap_element(element);
    }
  }
}

function select_hidden_elements(document) {
  const HIDDEN_SELECTOR = [
    '[style*="display:none"]',
    '[style*="display: none"]',
    '[style*="visibility:hidden"]',
    '[style*="visibility: hidden"]',
    '[style*="opacity: 0.0"]',
    '[aria-hidden="true"]'
  ].join(',');

  return document.querySelectorAll(HIDDEN_SELECTOR);
}
