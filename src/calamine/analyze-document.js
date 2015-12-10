// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: use for..of destructuring when supported
// TODO: refactor all extractors for body to just look for
// best body, not to analyze bp, and move
// TODO: split into two functions, one to find body,
// and one to do second pass to class bp

// Creates a boilerplate filtering function
function analyzeDocument(document) {

  const results = new CalamineResults();
  results.document = document;

  if(!document.querySelector('body')) {
    results.bodyElement = null;
    return results;
  }

  // TODO: rename classifyBoilerplate
  //results.bodyElement = fastFindBodyElement(document);

  // Looks for obvious best elements based on known content signatures
  for(let i = 0, elements = null; i < NUM_SIGNATURES; i++) {
    elements = document.body.querySelectorAll(BODY_SIGNATURES[i]);
    if(elements.length === 1) {
      results.bodyElement = elements[0];
      break;
    }
  }

  if(results.bodyElement) {
    results.boilerplateElements = classifyBoilerplate(results.bodyElement);
    return results;
  }

  results.textLengths = deriveTextLength(document);
  results.anchorLengths = deriveAnchorLength(document, results.textLengths);
  results.textScores = analyzeText(document, results.textLengths,
    results.anchorLengths);
  results.typeScores = analyzeTypes(document);
  results.topologyScores = analyzeTopology(document);
  results.imageParentScores = analyzeImages(document);
  results.attributeScores = analyzeAttributes(document);
  results.microdataScores = analyzeMicrodata(document);
  results.updateElementScores();

  // Set bodyElement to element with highest score
  results.bodyElement = document.body;
  let bestScore = results.scores.get(results.bodyElement);
  for(let entry of results.scores) {
    if(entry[1] > bestScore) {
      results.bodyElement = entry[0];
      bestScore = entry[1];
    }
  }

  // TODO: rename classifyBoilerplate
  results.boilerplateElements = classifyBoilerplate(results.bodyElement);
  return results;
}

// Export global
this.analyzeDocument = analyzeDocument;

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

} // END ANONYMOUS NAMESPACE
