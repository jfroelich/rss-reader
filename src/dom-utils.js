// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DOMUtils = {};

// Parses the html string and returns an HTMLDocument instance
// NOTE: is practically equivalent to using DOMParser
DOMUtils.parseHTML = function(html) {
	const doc = document.implementation.createHTMLDocument();
	// NOTE: doc does not have an innerHTML property, we have
	// to use documentElement
	doc.documentElement.innerHTML = html;
	return doc;
};

// Replaces an element with its children in the element's document
// NOTE: not optimized for live documents
DOMUtils.unwrap = function(element) {
	const parent = element.parentElement;
	if(parent) {
		let first = element.firstChild;
		while(first) {
			parent.insertBefore(first, element);
			first = element.firstChild;
		}
		element.remove();
	}
};

// Finds the associated caption for an image element
DOMUtils.findCaption = function(image) {
	const parents = DOMUtils.getAncestors(image);
	const figure = parents.find(DOMUtils.isFigureElement);
	if(figure)
		return figure.querySelector('figcaption');
};

DOMUtils.isFigureElement = function(element) {
	// return element instanceof HTMLFigureElement
	return element.localName === 'figure';
};

// Returns an array of ancestor elements for the given element
// up to and including the documentElement, in bottom up order
DOMUtils.getAncestors = function(element) {
	const parents = [];
	let parent = element.parentElement;
	while(parent) {
		parents.push(parent);
		parent = parent.parentElement;
	}
	return parents;
};

// Finds all elements with the given tagName and removes them,
// in reverse document order. This will remove elements that do not need to
// be removed because an ancestor of them will be removed in a later iteration,
// but this is not currently avoidable.
DOMUtils.removeElementsByName = function(document, tagName) {
	// NOTE: this ONLY works in reverse
	const elements = document.getElementsByTagName(tagName);
	for(let i = elements.length - 1; i > -1; i--) {
		elements[i].remove();
	}
};

// Finds all elements matching the selector and removes them,
// in forward document order. In contrast to moveElementsBySelector, this
// will recursively remove elements that are descendants of elements already
// removed.
// NOTE: i tried to find a way to avoid visiting detached subtrees, but
// document.contains still returns true for a removed element. The only way
// seems to be to traverse upwards and checking if documentElement is still at
// the top of the ancestors chain. That is obviously too inefficient, and
// probably less efficient than just visiting descendants. The real tradeoff
// is whether the set of remove operations is slower than the time it takes
// to traverse. I assume traversal is faster, but not fast enough to merit it.
// TODO: use for..of once Chrome supports NodeList iterators

DOMUtils.removeElementsBySelector = function(document, selector) {
	const elements = document.querySelectorAll(selector);
	const length = elements.length;
	for(let i = 0; i < length; i++) {
		elements[i].remove();
	}
};

// The result is the same as removeElementsBySelector.
// If destination is undefined, then a dummy document is supplied.
// The basic idea here is that we perform fewer dom mutations by not removing
// elements in removed subtrees.
DOMUtils.moveElementsBySelector = function(source, destination, selector) {
	const elements = source.querySelectorAll(selector);
	const length = elements.length;
	destination = destination || document.implementation.createHTMLDocument();

	for(let i = 0, element; i < length; i++) {
		element = elements[i];
		if(element.ownerDocument === source) {
			destination.adoptNode(element);
		}
	}
};
