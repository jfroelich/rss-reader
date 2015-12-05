// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Creates a boilerplate filtering function
function createCalamineClassifier(annotate, document) {

	// TODO: use for..of destructuring when supported

	// TODO: split into two functions, one to find body,
	// and one to do second pass to class bp
	// TODO: refactor all extractors for body to just look for
	// best body, not to analyze bp, and move

	if(!document.querySelector('body')) {
		return isAlwaysContentElement;
	}

	let bodyElement = fastFindBodyElement(document);
	let flagged = null;
	if(bodyElement) {
		flagged = classifyBoilerplate(bodyElement);
		return isContentElement.bind(this, bodyElement, flagged);
	}

	// Prefill scores map used by various feature extractors
	// TODO: deprecate once i switched over to returning maps below
	const scores = new Map();
	for(let i = 0, elements = document.getElementsByTagName('*'),
		len = elements.length; i < len; i++) {
		scores.set(elements[i], 0.0);
	}

	const textScores = analyzeText(document);
	const typeScores = analyzeTypes(document, scores, annotate);
	const topologyScores = analyzeTopology(document, scores, annotate);
	analyzeImages(document, scores, annotate);
	analyzeAttributes(document, scores, annotate);
	analyzeMicrodata(document, scores, annotate);

	// Integrate the scores
	for(let entry of textScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	for(let entry of typeScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	for(let entry of topologyScores) {
		scores.set(entry[0], (scores.get(entry[0]) || 0) + entry[1]);
	}

	if(annotate) {
		for(let entry of textScores) {
			entry[0].dataset.textBias = entry[1].toFixed(2);
		}

		for(let entry of typeScores) {
			entry[0].dataset.intrinsicBias = entry[1];
		}

		for(let entry of topologyScores) {
			entry[0].dataset.topologyScore = entry[1];
		}

		for(let entry of scores) {
			entry[0].dataset.score = entry[1].toFixed(2);
		}
	}

	// Set bodyElement to element with highest score, defaulting
	// to document.body.
	bodyElement = document.body;
	let bestScore = scores.get(bodyElement);
	for(let entry of scores) {
		if(entry[1] > bestScore) {
			bodyElement = entry[0];
			bestScore = entry[1];
		}
	}

	flagged = classifyBoilerplate(bodyElement);
	return isContentElement.bind(this, bodyElement, flagged);
}

// Export global
this.createCalamineClassifier = createCalamineClassifier;

const BODY_SIGNATURES = [
  'article',
  '.hentry',
  '.entry-content',
  '#article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
	'.repository-content',
  '[itemprop="articleBody"]',
  '[role="article"]',
  '[itemtype="http://schema.org/Article"]',
  '[itemtype="http://schema.org/NewsArticle"]',
  '[itemtype="http://schema.org/BlogPosting"]',
  '[itemtype="http://schema.org/Blog"]',
  '[itemtype="http://schema.org/WebPage"]',
  '[itemtype="http://schema.org/TechArticle"]',
  '[itemtype="http://schema.org/ScholarlyArticle"]',
  '#WNStoryBody'
];

const NUM_SIGNATURES = BODY_SIGNATURES.length;

// Looks for obvious best elements based on known content signatures
function fastFindBodyElement(document) {
	let elements = null;
	for(let i = 0; i < NUM_SIGNATURES; i++) {
		elements = document.body.querySelectorAll(BODY_SIGNATURES[i]);
		if(elements.length === 1) {
			return elements[0];
		}
	}
}

// A dummy classifier that treats every element as content
function isAlwaysContentElement(element) {
	return true;
}

// The function returned by createCalamineClassifier
// TODO: look into using Node.compareDocumentPosition instead of contains
function isContentElement(bodyElement, flagged, element) {
	return element === bodyElement ||
		element.contains(bodyElement) ||
		(bodyElement.contains(element) &&
			!flagged.has(element));
}

} // END ANONYMOUS NAMESPACE
