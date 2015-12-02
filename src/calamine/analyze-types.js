// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// NOTE: chrome is warning about de-opts, using var
// TODO: this should be refactored to focus on just finding the best
// body element. Some of its logic can be moved into the boilerplate
// classifier


{ // BEGIN ANONYMOUS NAMESPACE

function analyzeTypes(document, scores, annotate) {
	var elements = document.getElementsByTagName('*');
	var numElements = elements.length;

	var element = null;
	var bias = 0.0;

  // TODO: test perf by reverting to basic forEach.call here, there
  // may not be a materal perf detriment

	for(let i = 0; i < numElements; i++) {
		element = elements[i];
		bias = INTRINSIC_BIAS.get(element.localName);
		if(bias) {
			scores.set(element, scores.get(element) + bias);
			if(annotate) {
				element.dataset.intrinsicBias = bias;
			}
		}
	}

	// Pathological case for single article
	var articles = document.getElementsByTagName('article');
	var article = null;
	if(articles.length === 1) {
		article = articles[0];
		scores.set(article, scores.get(article) + 1000);
		if(annotate) {
			// todo: does this need to pay attention to other
			// setting of intrinsicBias, or is it indepedent?
			element.dataset.intrinsicBias = 1000;
		}
	}
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
