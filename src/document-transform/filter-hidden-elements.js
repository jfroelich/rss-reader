// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const HIDDEN_FACTORS = [
  'display:none',
  'display: none',
  'visibility:hidden',
  'visibility: hidden',
  'opacity:0.0',
  'opacity: 0.0',
  'opacity:0'
];

function makeSelectorCondition(string) {
  return '[style*="' + string + '"]';
}

const HIDDEN_SELECTOR = HIDDEN_FACTORS.map(makeSelectorCondition).join(',');

// Removes hidden elements from a document.
// Requires: removeElementsBySelector
//
// NOTE: this originally iterated over all elements and tested against
// each element's style property. Performance analysis showed this was
// very slow. So we sacrifice accuracy to move most of the traveral
// operations to a native querySelectorAll call. The selectors here do
// not match ALL hidden elements. First, we
// are only looking at inline styles and not considering the other
// relevant CSS, so we are already simplifying the problem and allowing
// for hidden elements. Second, hidden elements do not show up in the
// output.
// This is really only a component of compression, which isn't
// the primary purpose of the overall application.
// It may have some impact on boilerplate analysis, but I haven't given that
// too much consideration.
function filterHiddenElements(document) {
  removeElementsBySelector(document, HIDDEN_SELECTOR);
}

// Exports
this.filterHiddenElements = filterHiddenElements;

} // END ANONYMOUS NAMESPACE
