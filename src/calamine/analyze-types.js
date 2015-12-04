// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: chrome is warning about de-opts, using var
// TODO: this should be refactored to focus on just finding the best
// body element. Some of its logic can be moved into the boilerplate
// classifier
// TODO: this should only be analyzing body (best element) candidates

// TODO: rather than traversing all elements, this could use repeated
// queries to find only only those elements in the map

// TODO: this should have two analyses, one for finding body, one
// for classifying boilerplate.

{ // BEGIN ANONYMOUS NAMESPACE

function analyzeTypes(document) {
	var typeScores = new Map();
	var elements = document.getElementsByTagName('*');
	for(let i = 0, len = elements.length, bias = 0, element = null;
		i < len; i++) {
		element = elements[i];
		bias = INTRINSIC_BIAS.get(element.localName);
		if(bias) {
			typeScores.set(element, bias);
		}
	}

	return typeScores;
}

this.analyzeTypes = analyzeTypes;

const INTRINSIC_BIAS = new Map([
	['article', 200],
	['main', 100],
	['section', 50],
	['blockquote', 10],
	['code', 10],
	['content', 200],
	['div', 200],
	['figcaption', 10],
	['figure', 10],
	['ilayer', 10],
	['layer', 10],
	['p', 10],
	['pre', 10],
	['ruby', 10],
	['summary', 10],
	['a', -500],
	['address', -5],
	['dd', -5],
	['dt', -5],
	['h1', -5],
	['h2', -5],
	['h3', -5],
	['h4', -5],
	['h5', -5],
	['h6', -5],
	['small', -5],
	['sub', -5],
	['sup', -5],
	['th', -5],
	['form', -20],
	['li', -50],
	['ol', -50],
	['ul', -50],
	['font', -100],
	['aside', -100],
	['header', -100],
	['footer', -100],
	['table', -100],
	['tbody', -100],
	['thead', -100],
	['tfoot', -100],
	['nav', -100],
	['tr', -500]
]);

} // END ANONYMOUS NAMESPACE
