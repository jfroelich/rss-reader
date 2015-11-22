// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const InlineElementFilter = {};

{ // BEGIN ANONYMOUS NAMESPACE

InlineElementFilter.transform = function(document, rest) {

  transformJavascriptAnchors(document);
  unwrapNominalAnchors(document);
  unwrapInlineElements(document);
};

function transformJavascriptAnchors(document) {
  const anchors = document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;
  for(let i = 0; i < numAnchors; i++) {
    const anchor = anchors[i];
    const href = anchor.getAttribute('href');
    if(/^\s*javascript\s*:/i.test(href)) {
      //console.debug('Removing href %s', href);
      anchor.removeAttribute('href');
    }
  }
}

function unwrapNominalAnchors(document) {

  const anchors = document.querySelectorAll('a');
  const numAnchors = anchors.length;
  for(let i = 0; i < numAnchors; i++) {
    const anchor = anchors[i];
    if(!anchor.hasAttribute('href')) {
      DOMUtils.unwrap(anchor);
    }
  }
}

// NOTE: we do not unwrap elements outside of body, so we 
// intentionally do not include head/body as unwrappable

const UNWRAPPABLE_ELEMENTS = [
  'article', 'big', 'blink', 'center', 'colgroup', 'data', 
  'details', 'div', 'font', 'footer', 'form', 'header', 'help',
  'hgroup', 'ilayer', 'insert', 'label', 'layer', 'legend', 'main',
  'mark',
  'marquee', 'meter', 'multicol', 'nobr', 'noembed', 'noscript',
  'plaintext', 'section', 'small', 'span', 'tbody', 'tfoot', 
  'thead', 'tt'
].join(',');

function unwrapInlineElements(document) {
  for(let element = document.querySelector(UNWRAPPABLE_ELEMENTS),
    iterations = 0; element && (iterations < 3000); 
    element = document.querySelector(UNWRAPPABLE_ELEMENTS), 
    iterations++) {
    DOMUtils.unwrap(element);
  }
}

} // END ANONYMOUS NAMESPACE
