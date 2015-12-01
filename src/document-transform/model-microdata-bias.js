// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: itemscope?
// TODO: itemprop="articleBody"?
// TODO: [role="article"]?
// 'complementary' negative role
// 'blogpost' positive itemprop

{ // BEGIN ANONYMOUS NAMESPACE

// Microdata schemas
const MD_SCHEMAS = [
	'Article',
	'Blog',
	'BlogPost',
	'BlogPosting',
	'NewsArticle',
	'ScholarlyArticle',
	'TechArticle',
	'WebPage'
];

function modelMicrodataBias(document, scores, annotate) {

	MD_SCHEMAS.forEach(applySchemaBias.bind(null,
		document, scores, annotate));
}

this.modelMicrodataBias = modelMicrodataBias;

function applySchemaBias(document, scores, annotate, schema) {
	const selector = '[itemtype="http://schema.org/' + schema + '"]';
	const elements = document.querySelectorAll(selector);
	if(elements.length !== 1) return;
	const element = elements[0];
	scores.set(element, scores.get(element) + 500);
	if(annotate) {
		element.dataset.itemTypeBias = 500;
	}
}

} // END ANONYMOUS NAMESPACE
