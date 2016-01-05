// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Unwraps various inline elements in a document. Given that style information
// and other information is removed, several elements in the document may
// no longer serve a formatting purpose, so we want to remove them but
// keep the child elements. Because the topology serves as a feature in
// boilerplate extraction, this should only be done after analyzing the content
// for boilerplate.

// TODO: this is doing some wasted operations in the case of nested
// inline elements. For example, for <div><div>content</div><div>,
// content should be hoisted all the way outside of the div in a single
// move. Right now it unwraps both inner and outer, doing the move twice. So
// instead of finding the parent in unwrap, we would want to walk up the
// ancestor tree to the first non-unwrappable (stopping before document.body).
// I think this means we cannot use unwrapElement, because that
// hardcodes the move destination as element.parentElement

function filterInlineElements(document) {
  const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    unwrapElement(elements[i]);
  }
}

this.filterInlineElements = filterInlineElements;

// NOTE: This does not contain ALL inline elements, just those we
// want to unwrap. This is different than the set of inline
// elements defined for the purpose of trimming text nodes.
// TODO: some of these would maybe be better handled in other more
// specialized handlers
// noscript and noembed are handled by other transforms
const UNWRAPPABLE_ELEMENTS = [
  'article',
  'center',
  'colgroup',
  'data',
  'details',
  'div',
  'footer',
  'header',
  'help',
  'hgroup',
  'ilayer',
  'insert',
  'layer',
  'legend',
  'main',
  'mark',
  'marquee',
  'meter',
  'multicol',
  'nobr',
  'noembed',
  'section',
  'span',
  'tbody',
  'tfoot',
  'thead',
  'form',
  'label',
  'big',
  'blink',
  'font',
  'plaintext',
  'small',
  'tt'
];

const UNWRAPPABLE_SELECTOR = UNWRAPPABLE_ELEMENTS.join(',');

} // END ANONYMOUS NAMESPACE
