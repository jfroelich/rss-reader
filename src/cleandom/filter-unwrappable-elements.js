// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const SELECTOR = [
  'abbr',
  'acronym',
  'article',
  'aside',
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
].join(',');

function filterUnwrappableElements(document) { 
  const elements = document.querySelectorAll(SELECTOR);
  for(let i = 0, len = elements.length; i < len; i++) {
    unwrapElement(elements[i]);
  }
}

this.filterUnwrappableElements = filterUnwrappableElements;

} // End file block scope
