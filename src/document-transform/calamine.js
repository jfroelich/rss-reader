// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Filters boilerplate content. Internally, this applies a series of modeling
// functions that assign a weight to elements representing whether the element
// is probably the root element of the content area of an HTMLDocument, then
// finds the most probable root and removes all elements outside of the chosen
// root from the document.
// @param models {Array} an array of modeling functions
// @param document {HTMLDocument} the document to analyze
// @param annotate {boolean} whether to annotate elements with derived info
function applyCalamine(models, annotate, document) {
	'use strict';
	// Require a body that is not a frameset
	if(!document.querySelector('body'))
		return;

	// Prefill scores
	const scores = new Map();
	Array.prototype.forEach.call(document.getElementsByTagName('*'),
		function setInitialElementScore(element) {
		scores.set(element, 0.0);
	});

	// Iterate over the models
	models.forEach(function applyModel(model) {
		model(document, scores, annotate);
	});

	// Reduce the scores map to the highest scoring element
	// TODO: use destructuring when supported
	let bestElement = document.body;
	let bestScore = scores.get(bestElement);
	for(let entry of scores) {
		if(entry[1] > bestScore) {
			bestElement = entry[0];
			bestScore = entry[1];
		}
	}

	// Remove non-intersecting elements. We use a node iterator to avoid
	// visiting detached subtrees.
	// TODO: research Node.compareDocumentPosition
	const it = document.createNodeIterator(
		document.documentElement,
		NodeIterator.SHOW_ELEMENT);
	let element = it.nextNode();
	while(element) {
		if(element !== bestElement &&
			!bestElement.contains(element) &&
			!element.contains(bestElement)) {
			element.remove();
		}

		element = it.nextNode();
	}

	// TODO: use destructuring when supported
	if(annotate) {
		for(let entry of scores) {
			entry[0].dataset.score = entry[1].toFixed(2);
		}
	}
}

// Returns the typical set of models used when running applyCalamine
function getDefaultCalamineModels() {
	'use strict';
	return [
		modelTextBias,
		modelIntrinsicBias,
		modelHierarchicalBias,
		modelImageBias,
		modelAttributeBias
	];
}
