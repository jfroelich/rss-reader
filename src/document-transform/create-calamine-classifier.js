// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Filters boilerplate content. Internally, this applies a series of modeling
// functions that assign a weight to elements representing whether the element
// is probably the root element of the content area of an HTMLDocument, then
// finds the most probable root, and then removes all elements outside of the
// chosen root from the document.
// @param models {Array} an array of modeling functions
// @param document {HTMLDocument} the document to analyze
// @param annotate {boolean} whether to annotate elements with derived info
function createCalamineClassifier(models, annotate, document) {
	'use strict';
	// Require a body that is not a frameset
	if(!document.querySelector('body'))
		return;

	// Prefill scores
	const scores = new Map();
	// TODO: use for..of once NodeList is iterable
	Array.prototype.forEach.call(document.getElementsByTagName('*'),
		function setInitialElementScore(element) {
		scores.set(element, 0.0);
	});

	// Apply the models
	for(let model of models) {
		model(document, scores, annotate);
	}

	// TODO: use destructuring when supported
	if(annotate) {
		for(let entry of scores) {
			entry[0].dataset.score = entry[1].toFixed(2);
		}
	}

	// Reduce the scores map to the highest scoring element. The highest
	// scoring element is basically a node to which all connected nodes in the
	// graph (directly or indirectly) are considered content.
	// TODO: use destructuring when supported
	let bestElement = document.body;
	let bestScore = scores.get(bestElement);
	for(let entry of scores) {
		if(entry[1] > bestScore) {
			bestElement = entry[0];
			bestScore = entry[1];
		}
	}

	// The 'model' we plan to return, that classifies an element as
	// content or boilerplate
	function isContentElement(element) {
		// TODO: research Node.compareDocumentPosition
		const intersects = element === bestElement ||
			bestElement.contains(element) ||
			element.contains(bestElement);
		if(intersects) {
			// The element falls within the best element, or is the best
			// element, or contains the best element. In which it is not
			// boilerplate.

			// TODO: before returning true, this should also check for explicit
			// element ids and classes that indicate boilerplate.

			return true;
		}

		return false;
	}

	return isContentElement;
}
