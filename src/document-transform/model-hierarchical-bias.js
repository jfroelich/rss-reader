// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const forEach = Array.prototype.forEach;

// Elements are biased for being parents of these elements
// NOTE: the anchor bias is partially redundant with the text bias
// but also accounts for non-text links (e.g. menu of images)
const UPWARD_BIAS = new Map([
	['a', -5],
	['blockquote', 20],
	['div', -50],
	['figure', 20],
	['h1', 10],
	['h2', 10],
	['h3', 10],
	['h4', 10],
	['h5', 10],
	['h6', 10],
	['li', -5],
	['ol', -20],
	['p', 100],
	['pre', 10],
	['ul', -20]
]);

function modelHierarchicalBias(document, scores, annotate) {
  // TODO: use for..of once Chrome supports NodeList iteration
  forEach.call(document.querySelectorAll(
    'li *, ol *, ul *, dd *, dl *, dt *'),
    penalizeListDescendant.bind(null, scores, annotate));
  forEach.call(document.querySelectorAll(
    'aside *, header *, footer *, nav *, menu *, menuitem, *'),
    penalizeNavDescendant.bind(null, scores, annotate));

  // TODO: would it be faster to query each element individually
  // rather than all elements (and a map lookup per element)
  forEach.call(document.getElementsByTagName('*'),
    biasParent.bind(null, scores, annotate));
}

this.modelHierarchicalBias = modelHierarchicalBias;

function penalizeListDescendant(scores, annotate, element) {
  scores.set(element, scores.get(element) - 100.0);
  if(annotate) {
    // BUG: this needs to account for other bias
    const currentBias = parseFloat(element.dataset.listDescendantBias) || 0;
    element.dataset.listDescendantBias = -100;
  }
}

function penalizeNavDescendant(scores, annotate, element) {
  scores.set(element, scores.get(element) - 500.0);
  if(annotate) {
    const currentBias = parseFloat(element.dataset.navDescendantBias) || 0;
    element.dataset.navDescendantBias = currentBias - 500;
  }
}

function biasParent(scores, annotate, element) {
  const bias = UPWARD_BIAS.get(element.localName);
  if(!bias) return;
  const parent = element.parentElement;
  scores.set(parent, scores.get(parent) + bias);
  if(annotate) {
    const previousBias = parseFloat(parent.dataset.upwardBias) || 0;
    parent.dataset.upwardBias = previousBias + bias;
  }
}

} // END ANONYMOUS NAMESPACE
