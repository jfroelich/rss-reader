// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: merge CalamineResults into this, make a basic object,
// Calamine, with state and all the methods?
// TODO: merge a part of analyzeAttributes into this?
// The current issue is basically the mixing of two analyses, one for
// finding the best body element, the other for classifying as boilerplate
// or not boilerplate. I want to cleanly separate the two. However, the issue
// that is delaying this for me is that some of the analysis feels redundant,
// in that identifying the body shares some of the work that has to be done
// with identifying whether a given element within the body is content. I am
// not sure how to exactly proceed.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Analyzes the document and returns a CalamineResults object
function analyzeDocument(document) {

  const results = new CalamineResults();
  results.document = document;

  // If there is no body, we cannot analyze the document, so exit early
  // NOTE: cannot use document.body because it is defined for frameset
  if(!document.querySelector('body')) {
    return results;
  }

  // Look for an obvious body element
  for(let i = 0, elements = null; i < NUM_SIGNATURES; i++) {
    elements = document.body.querySelectorAll(BODY_SIGNATURES[i]);
    if(elements.length === 1) {
      results.bodyElement = elements[0];
      break;
    }
  }

  // If we didn't find an obvious body element, do a full analysis
  if(!results.bodyElement) {
    results.bodyElement = document.body;
    results.textLengths = deriveTextLength(document);
    results.anchorLengths = deriveAnchorLength(document, results.textLengths);
    results.textScores = deriveTextScores(document, results.textLengths,
      results.anchorLengths);
    results.typeScores = deriveTypeScores(document);
    results.topologyScores = deriveTopologyScores(document);
    results.imageParentScores = deriveImageParentScores(document);
    results.attributeScores = analyzeAttributes(document);
    results.updateElementScores();

    // Set bodyElement to element with highest score
    // TODO: use for..of destructuring when supported
    let bestScore = results.bodyScores.get(results.bodyElement);
    for(let entry of results.bodyScores) {
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

// Calculates and records the text bias for elements. The text bias metric is
// adapted from the paper "Boilerplate Detection using Shallow Text Features".
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function deriveTextScores(document, textLengths, anchorLengths) {
  const scores = new Map();
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  let length = 0;
  let anchorLength = 0;
  let weight = 0.0;
  for(let i = 0, element; i < numElements; i++) {
    element = elements[i];
    length = textLengths.get(element);
    if(!length) continue;
    anchorLength = anchorLengths.get(element) || 0;
    weight = (0.25 * length) - (0.7 * anchorLength);
    weight = Math.min(4000.0, weight);
    if(!weight) continue;
    scores.set(element, (scores.get(element) || 0.0) + weight);
  }

  return scores;
}

const RE_WHITESPACE = /\s|&nbsp;/g;

// Gets a representation of the number of characters for a text node
function getNodeTextLength(node) {
  const value = node.nodeValue;
  let length = 0;
  // Avoid the overhead of the regular expression by checking for
  // various frequently occurring trivial text values
  if(value !== '\n' && value !== '\n\t' && value !== '\n\t\t') {
    // Get the length of the string without whitespace
    length = value.replace(RE_WHITESPACE, '').length;
  }

  return length;
}

// Generate a map between document elements and a count of characters within
// each element. For better performance, this accumulates the character counts
// of text nodes in each node's set of ancestors, from the bottom up, rather
// than accessing element.textContent.length from the top down.
function deriveTextLength(document) {
  const map = new Map();
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  let length = 0;
  let element = null;
  let previousLength = 0;
  while(node) {
    length = getNodeTextLength(node);
    if(length) {
      element = node.parentElement;
      while(element) {
        previousLength = map.get(element) || 0;
        map.set(element, previousLength + length);
        element = element.parentElement;
      }
    }

    node = iterator.nextNode();
  }

  return map;
}

// Generate a map between document elements and a count of
// the characters contained within anchor elements present
// anywhere within the elements
function deriveAnchorLength(document, textLengths) {
  const map = new Map();
  const anchors = document.querySelectorAll('a[href]');
  const numAnchors = anchors.length;

  for(let i = 0, length, previousLength, anchor, ancestor; i < numAnchors;
    i++) {

    anchor = anchors[i];
    length = textLengths.get(anchor);
    if(!length) continue;
    map.set(anchor, (map.get(anchor) || 0) + length);

    ancestor = anchor.parentElement;
    while(ancestor) {
      previousLength = (map.get(ancestor) || 0);
      map.set(ancestor, previousLength + length);
      ancestor = ancestor.parentElement;
    }
  }
  return map;
}

// TODO: this should be refactored to focus on just finding the best
// body element. this should have two analyses, one for finding body, one
// for classifying boilerplate.
// TODO: rather than traversing all elements, this could use repeated
// queries to find only only those elements in the map
// TODO: use for..of once Chrome supports NodeList iteration
function deriveTypeScores(document) {
  const scores = new Map();
  const elements = document.getElementsByTagName('*');
  for(let i = 0, len = elements.length, bias = 0, element = null; i < len;
    i++) {

    element = elements[i];
    bias = INTRINSIC_BIAS.get(element.localName);
    if(bias) {
      scores.set(element, bias);
    }
  }

  return scores;
}

// Bias image containers
// TODO: this should check if parent is one of the body candidates and
// avoid scoring non-candidates
// TODO: use for..of once chrome supports NodeList iteration
function deriveImageParentScores(document) {
  const scores = new Map();
  const images = document.getElementsByTagName('img');
  const numImages = images.length;
  let image = null;
  let parent = null;
  let area = 0;
  let caption = null;
  let children = null;
  let numChildren = 0;
  let node = null;
  let bias = 0.0;
  let j = 0;

  for(let i = 0; i < numImages; i++) {
    image = images[i];
    parent = image.parentElement;

    if(!parent) {
      continue;
    }

    bias = 0.0;

    // Dimension bias
    if(image.width && image.height) {
      area = image.width * image.height;
      bias += 0.0015 * Math.min(100000, area);
    }

    // Description bias
    // TODO: check data-alt and data-title?
    if(image.getAttribute('alt')) {
      bias += 20.0;
    }

    if(image.getAttribute('title')) {
      bias += 30.0;
    }

    caption = DOMUtils.findCaption(image);
    if(caption) {
      bias += 50.0;
    }

    // Carousel bias
    children = parent.childNodes;
    numChildren = children.length;
    for(j = 0; j < numChildren; j++) {
      node = children[j];
      if(node !== image && node.localName === 'img') {
        bias = bias - 50.0;
      }
    }

    if(bias) {
      scores.set(parent, (scores.get(parent) || 0.0) + bias);
    }
  }

  return scores;
}

// TODO: this should only influence body candidates
// TODO: maybe this should be 3 separate functions
function deriveTopologyScores(document) {
  const scores = new Map();
  let elements = document.querySelectorAll(
    'li *, ol *, ul *, dd *, dl *, dt *');
  // TODO: use for..of once Chrome supports NodeList iteration
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    scores.set(element, (scores.get(element) || 0.0) - 100.0);
  }

  elements = document.querySelectorAll(
    'aside *, header *, footer *, nav *, menu *, menuitem, *');
  // TODO: use for..of once Chrome supports NodeList iteration
  for(let i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    scores.set(element, (scores.get(element) || 0.0) - 500.0);
  }

  let upBias = 0;
  for(let entry of UPWARD_BIAS) {
    elements = document.getElementsByTagName(entry[0]);
    upBias = entry[1];
    // TODO: use for..of once Chrome supports NodeList iteration
    for(let i = 0, len = elements.length, element, parent; i < len; i++) {
      element = elements[i];
      parent = element.parentElement;
      if(parent) {
        scores.set(element, (scores.get(element) || 0.0) + upBias);
      }
    }
  }

  return scores;
}

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

const UPWARD_BIAS = new Map([
  ['a', -5],
  ['blockquote', 20],
  ['div', -50],
  ['figure', 20],
  ['h1', 10],
  ['h2', 10],
  ['h3', 10],
  ['h4', 10],
  ['h5', 10],
  ['h6', 10],
  ['li', -5],
  ['ol', -20],
  ['p', 100],
  ['pre', 10],
  ['ul', -20]
]);

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

} // END ANONYMOUS NAMESPACE
