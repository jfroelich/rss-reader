// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const InlineElementFilter = {};

{ // BEGIN ANONYMOUS NAMESPACE

InlineElementFilter.transform = function(document) {
  
  const it = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_ELEMENT, 
    isInline);
  
  let element = it.nextNode();
  while(element) {
    DOMUtils.unwrap(element);
    element = it.nextNode();
  }
};

// NOTE: This does not contain ALL inline elements, just those we 
// want to unwrap.

const INLINE_ELEMENTS = new Set([
  'article',
  'big',
  'blink',
  'center',
  'colgroup',
  'data', 
  'details',
  'div',
  'font',
  'footer',
  'form',
  'header',
  'help',
  'hgroup',
  'ilayer',
  'insert',
  'label',
  'layer',
  'legend',
  'main',
  'mark',
  'marquee',
  'meter',
  'multicol',
  'nobr',
  'noembed',
  'plaintext',
  'section',
  'small',
  'span',
  'tbody',
  'tfoot', 
  'thead',
  'tt'
]);

function isInline(node) {
  const name = node.localName;
  if(INLINE_ELEMENTS.has(name)) {
    return NodeFilter.FILTER_ACCEPT;
  }

  if(name === 'noscript' || name === 'noframes') {

    // Due to content-loading tricks, noscript requires special handling
    // e.g. nbcnews.com
    // This requires some additional refinement. For now we just unwrap.
    // This obviously leads to sometimes dup content or strange looking
    // internal content
    return NodeFilter.FILTER_ACCEPT;
  }

  // Conditionally unwrap anchors
  if(name === 'a') {
    let href = node.getAttribute('href');
    href = (href || '').trim();
    if(!href) {
      return NodeFilter.FILTER_ACCEPT;
    }

    if(/^\s*javascript\s*:/i.test(href)) {
      return NodeFilter.FILTER_ACCEPT;
    }
  }

  return NodeFilter.FILTER_REJECT;
}

} // END ANONYMOUS NAMESPACE
