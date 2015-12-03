// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const DOMUtils = {};

// Parses the html string and returns an HTMLDocument instance
// NOTE: is practically equivalent to using DOMParser
DOMUtils.parseHTML = function(html) {
	const doc = document.implementation.createHTMLDocument();
	doc.documentElement.innerHTML = html;
	return doc;
};

// Replaces an element with its children in the element's document
// NOTE: not optimized for live documents
DOMUtils.unwrap = function(element) {
	const parent = element.parentElement;
	if(parent) {
		while(element.firstChild) {
			parent.insertBefore(element.firstChild, element);
		}
		element.remove();
	}
};

// Finds the associated caption for an image element
DOMUtils.findCaption = function(image) {
	const parents = DOMUtils.getAncestors(image);
	const figure = parents.find(function(parent) {
		return parent.localName === 'figure';
	});
	if(figure)
		return figure.querySelector('figcaption');
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

DOMUtils.removeElementsByName = function(document, tagName) {
	// NOTE: this ONLY works in reverse
	const elements = document.getElementsByTagName(tagName);
	for(let i = elements.length - 1; i > -1; i--) {
		elements[i].remove();
	}
};

DOMUtils.removeElementsBySelector = function(document, selector) {
	const elements = document.querySelectorAll(selector);
	for(let i = 0, len = elements.length; i < len; i++) {
		elements[i].remove();
	}
};

// The basic idea here is that we perform fewer dom mutations by not removing
// elements in removed subtrees.
DOMUtils.moveElementsBySelector = function(source, destination, selector) {
	destination = destination || document.implementation.createHTMLDocument();
	for(let i = 0, elements = source.querySelectorAll(selector), 
		len = elements.length, element; i < len; i++) {
		element = elements[i];
		if(element.ownerDocument === source) {
			destination.adoptNode(element);
		}
	}
};
