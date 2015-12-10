// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

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
  '[itemtype="http://schema.org/BlogPosting"]',
  '[itemtype="http://schema.org/Blog"]',
  '[itemtype="http://schema.org/NewsArticle"]',
  '[itemtype="http://schema.org/TechArticle"]',
  '[itemtype="http://schema.org/ScholarlyArticle"]',
  '[itemtype="http://schema.org/WebPage"]',
  '#WNStoryBody',

  // todo: verify this one
  '.WNStoryBody'
];

const NUM_SIGNATURES = BODY_SIGNATURES.length;

// Analyzes the document and returns a CalamineResults object
function analyzeDocument(document) {

  const results = new CalamineResults();
  results.document = document;

  if(!document.querySelector('body')) {
    results.bodyElement = null;
    return results;
  }

  // Looks for obvious best elements based on known content signatures
  for(let i = 0, elements = null; i < NUM_SIGNATURES; i++) {
    elements = document.body.querySelectorAll(BODY_SIGNATURES[i]);
    if(elements.length === 1) {
      results.bodyElement = elements[0];
      break;
    }
  }

  // If we didn't find an obvious body signature, do a full analysis
  if(!results.bodyElement) {
    results.bodyElement = document.body;
    results.textLengths = deriveTextLength(document);
    results.anchorLengths = deriveAnchorLength(document, results.textLengths);
    results.textScores = analyzeText(document, results.textLengths,
      results.anchorLengths);
    results.typeScores = analyzeTypes(document);
    results.topologyScores = analyzeTopology(document);
    results.imageParentScores = analyzeImages(document);
    results.attributeScores = analyzeAttributes(document);
    results.updateElementScores();

    // Set bodyElement to element with highest score
    // TODO: use for..of destructuring when supported
    let bestScore = results.scores.get(results.bodyElement);
    for(let entry of results.scores) {
      if(entry[1] > bestScore) {
        results.bodyElement = entry[0];
        bestScore = entry[1];
      }
    }
  }

  // TODO: rename classifyBoilerplate to something clearer
  results.boilerplateElements = classifyBoilerplate(results.bodyElement);
  return results;
}

// Export global
this.analyzeDocument = analyzeDocument;

} // END ANONYMOUS NAMESPACE
