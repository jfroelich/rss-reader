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
function applyCalamine(models, annotate, document) {
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

	// TODO: idea, what I really want calamine to do is to generate
	// a model. the model is basically a function that classifies an
	// element as boilerplate or content. Which is basically just
	// this pruning section but for one element. So I want to rewrite calamine
	// to generate a scoring function, and then use the scoring function
	// externally to prune. That was calamine becomes purely analytical,
	// and we can rename the function to createContentClassifier or something,
	// and have it generate a scoring function as its return value.
	// The returned function returns boolean, true if content, false if
	// boilerplate, something like that.
	// Maybe we could have the function keep a reference to bestElement
	// in its closure scope.
	// Then the caller can have a removeBoilerplate function that traverses
	// the dom and classifies each element and prunes.
	// Calamine then no longer becomes a document transform and we could move
	// the file.


	// The second part of this is the analysis of element ids and classes
	// that target nested boilerplate within the best element. I suppose that
	// could also be a part of the model, instead of being a part of the
	// blacklist filter.


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
