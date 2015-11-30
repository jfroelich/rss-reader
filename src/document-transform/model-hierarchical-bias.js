// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function modelHierarchicalBias(document, scores, annotate) {

  applyDownwardBias(document, scores, annotate);
  applyUpwardBias(document, scores, annotate);
}

this.modelHierarchicalBias = modelHierarchicalBias;


function applyDownwardBias(document, scores, annotate) {

	// Penalize list descendants. Even though we are not mutating,
	// it seems faster to use querySelectorAll here than using
	// NodeIterator or getElementsByTagName because we want to include
	// all descendants.
	// TODO: this is buggy, not accumulating bias in annotation
	const LIST_SELECTOR = 'li *, ol *, ul *, dd *, dl *, dt *';
	const listDescendants = document.querySelectorAll(LIST_SELECTOR);
	const numLists = listDescendants.length;

	// init as an element to give chrome a type hint
	// init outside the loop due to strange let/const in loop decl behavior
	let listDescendant = document.documentElement;

	for(let i = 0; i < numLists; i++) {
		listDescendant = listDescendants[i];
		scores.set(listDescendant, scores.get(listDescendant) - 100);
		if(annotate) {
			// TODO: this needs to account for other bias
			listDescendant.dataset.listDescendantBias = -100;
		}

	}

	// Penalize descendants of navigational elements
	const NAV_SELECTOR = 'aside *, header *, footer *, nav *';
	const navDescendants = document.querySelectorAll(NAV_SELECTOR);
	const numNavs = navDescendants.length;
	let navDescendant = document.documentElement;
	let currentBias = 0;
	for(let i = 0; i < numNavs; i++) {
		navDescendant = navDescendants[i];
		scores.set(navDescendant, scores.get(navDescendant) - 50);

		if(annotate) {
			currentBias = parseFloat(
				navDescendant.dataset.navDescendantBias) || 0.0;
			navDescendant.dataset.navDescendantBias = currentBias - 50;
		}
	}
}

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

// Bias the parents of certain elements
function applyUpwardBias(document, scores, annotate) {

	// chrome warning unsupported phi use of const variable
	// so using var

	var elements = document.getElementsByTagName('*');
	var numElements = elements.length;
	var element = null;
	var bias = 0.0;
	var parent = null;
	var previousBias = 0.0;

	for(let i = 0; i < numElements; i++) {
		element = elements[i];
		bias = UPWARD_BIAS.get(element.localName);
		if(!bias) continue;
		parent = element.parentElement;
		scores.set(parent, scores.get(parent) + bias);
		if(annotate) {
			previousBias = parseFloat(parent.dataset.upwardBias) || 0.0;
			parent.dataset.upwardBias = previousBias + bias;
		}
	}
}

} // END ANONYMOUS NAMESPACE
