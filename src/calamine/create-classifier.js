// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: use for..of destructuring when supported
// TODO: refactor all extractors for body to just look for
// best body, not to analyze bp, and move
// return a results object, and make an annotate method that does
// the annotation (store sets as props of the results object),
// and remove the annotate parameter to this function
// TODO: split into two functions, one to find body,
// and one to do second pass to class bp

// Creates a boilerplate filtering function
function createClassifier(annotate, document) {

  if(!document.querySelector('body')) {
    return isAlwaysContentElement;
  }

  let bodyElement = fastFindBodyElement(document);
  let flagged = null;
  if(bodyElement) {
    flagged = classifyBoilerplate(bodyElement);
    return isContentElement.bind(this, bodyElement, flagged);
  }

  const textScores = analyzeText(document);
  const typeScores = analyzeTypes(document);
  const topologyScores = analyzeTopology(document);
  const imageParentScores = analyzeImages(document);
  const attributeScores = analyzeAttributes(document);
  const microdataScores = analyzeMicrodata(document);

  // Integrate the scores into a single map
  const scores = new Map();

  for(let entry of textScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of typeScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of topologyScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of imageParentScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of attributeScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
  }

  for(let entry of microdataScores) {
    scores.set(entry[0], (scores.get(entry[0]) || 0.0) + entry[1]);
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

  // Optionally annotate the scores
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

    for(let entry of imageParentScores) {
      entry[0].dataset.imageScore = entry[1].toFixed(2);
    }

    for(let entry of attributeScores) {
      entry[0].dataset.attributeScore = entry[1].toFixed(2);
    }

    for(let entry of microdataScores) {
      entry[0].dataset.microdataScore = entry[1].toFixed(2);
    }

    for(let entry of scores) {
      entry[0].dataset.score = entry[1].toFixed(2);
    }
  }

  flagged = classifyBoilerplate(bodyElement);
  return isContentElement.bind(this, bodyElement, flagged);
}

// Export global
this.createClassifier = createClassifier;

const BODY_SIGNATURES = [
  'article',
  '.hentry',
  '.entry-content',
  '#article',
  '.article',
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
  '#WNStoryBody',

  // todo: verify this one
  '.WNStoryBody'
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
// TODO: research using Node.compareDocumentPosition instead of contains
function isContentElement(bodyElement, flagged, element) {
  return element === bodyElement ||
    element.contains(bodyElement) ||
    (bodyElement.contains(element) &&
      !flagged.has(element));
}

} // END ANONYMOUS NAMESPACE
