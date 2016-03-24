// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

(function(exports) {
'use strict';



// Looks for the element that is most likely the root element of the content
// and removes elements all other elements
function applyCalamine(document) {
  let bestElement = findSignature(document) ||
    findHighestScoringElement(document);
  if(bestElement !== document.documentElement) {
    prune(document, bestElement);
  }
}

const SIGNATURES = [
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
  'div[itemtype="http://schema.org/Article"]',
  'div[itemtype="http://schema.org/BlogPosting"]',
  'div[itemtype="http://schema.org/Blog"]',
  'div[itemtype="http://schema.org/NewsArticle"]',
  'div[itemtype="http://schema.org/TechArticle"]',
  'div[itemtype="http://schema.org/ScholarlyArticle"]',
  'div[itemtype="http://schema.org/WebPage"]',
  '#WNStoryBody'
];

// Looks for the first single occurrence of an element matching
// one of the signatures
function findSignature(document) {
  for(let i = 0, len = SIGNATURES.length, elements; i < len; i++) {
    elements = document.querySelectorAll(SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}

// Only these elements are considered as potential best elements
const CANDIDATE_SELECTOR = [
  'article',
  'content',
  'div',
  'layer',
  'main',
  'section',
  'span',
  'td'
].join(',');

// Scores each of the candidate elements and returns the one with
// the highest score
function findHighestScoringElement(document) {
  let bestElement = document.documentElement;
  const elements = document.querySelectorAll(CANDIDATE_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element, highScore = 0.0, score = 0.0;
    i < numElements; i++) {
    element = elements[i];
    score = deriveElementScore(element);
    if(score > highScore) {
      bestElement = element;
      highScore = score;
    }
  }
  return bestElement;
}

// Calculates an elements score. A higher score means the element is more
// likely to be the root element of the content of the document containing
// the element
function deriveElementScore(element) {
  const textBias = getTextBias(element);
  const listBias = getListBias(element);
  const navBias = getNavBias(element);
  const ancestorBias = getAncestorBias(element);
  const imageBias = getImageBias(element);
  const attributeBias = getAttributeBias(element);
  return textBias + listBias + navBias + ancestorBias + imageBias +
    attributeBias;
}

// Returns the approximate number of characters contained within anchors that
// are descendants of the element. Assumes no anchor nesting.
function getAnchorLength(element) {
  // using var due to deopt (inline bailout reason)
  var anchors = element.querySelectorAll('a[href]');
  var numAnchors = anchors.length;
  var anchorLength = 0;
  for(var i = 0; i < numAnchors; i++) {
    anchorLength += anchors[i].textContent.trim().length;
  }
  return anchorLength;
}

// This returns a approximate measure representing a ratio of the amount of
// text in the element to text within descendant anchors. The text bias metric
// is adapted from the paper "Boilerplate Detection using Shallow Text
// Features". See http://www.l3s.de/~kohlschuetter/boilerplate.
function getTextBias(element) {
  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = trimmedText.length;
  const anchorLength = getAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

// Penalizes an element for being a descendant of a list
function getListBias(element) {
  const LIST_SELECTOR = 'li,ol,ul,dd,dl,dt';
  return element.closest(LIST_SELECTOR) ? -200.0 : 0.0;
}

// Penalizes an element for being a descendant of a navigational section
function getNavBias(element) {
  const NAV_SELECTOR = 'aside,header,footer,nav,menu,menuitem';
  return element.closest(NAV_SELECTOR) ? -500.0 : 0.0;
}

const ANCESTOR_BIAS = {
  'a': -5.0,
  'aside': -50.0,
  'blockquote': 20.0,
  'br': 3.0,
  'div': -50.0,
  'figure': 20.0,
  'h1': 10.0,
  'h2': 10.0,
  'h3': 10.0,
  'h4': 10.0,
  'h5': 10.0,
  'h6': 10.0,
  'nav': -100.0,
  'ol': -20.0,
  'p': 10.0,
  'pre': 10.0,
  'section': -20.0,
  'ul': -20.0
};

// Derives a bias based on the immediate child elements
function getAncestorBias(element) {
  var bias = 0.0;
  for(var childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    bias += ANCESTOR_BIAS[childElement.localName] || 0.0;
  }
  return bias;
}

function getImageArea(image) {
  return image.width * image.height;
}

// Derives a bias based on child images
function getImageBias(parentElement) {
  let bias = 0.0;
  let numImages = 0;
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName === 'img') {
      bias += 0.0015 * Math.min(100000.0, getImageArea(element));
      bias += element.getAttribute('alt') ? 20.0 : 0.0;
      bias += element.getAttribute('title') ? 30.0 : 0.0;
      bias += findImageCaption(element) ? 100.0 : 0.0;
      numImages++;
    }
  }

  // Penalize elements containing multiple images. These are usually
  // carousels.
  if(numImages > 1) {
    bias += -50.0 * (numImages - 1);
  }
  return bias;
}

function isImageElement(node) {
  return node.nodeType === Node.ELEMENT_NODE && node.localName === 'img';
}

function findImageCaption(image) {
  const figure = image.closest('figure');
  return figure ? figure.querySelector('figcaption') : null;
}

const ATTRIBUTE_BIAS = {
  'ad': -500.0,
  'ads': -500.0,
  'advert': -500.0,
  'article': 500.0,
  'body': 500.0,
  'comment': -500.0,
  'content': 500.0,
  'contentpane': 500.0,
  'gutter': -300.0,
  'left': -50.0,
  'main': 500.0,
  'meta': -50.0,
  'nav': -200.0,
  'navbar': -200.0,
  'newsarticle': 500.0,
  'page': 200.0,
  'post': 300.0,
  'promo': -100.0,
  'rail': -300.0,
  'rel': -50.0,
  'relate': -500.0,
  'related': -500.0,
  'right': -50.0,
  'social': -200.0,
  'story': 100.0,
  'storytxt': 500.0,
  'tool': -200.0,
  'tools': -200.0,
  'widget': -200.0,
  'zone': -50.0
};

// While Array.from(new Set(tokens)) would accomplish this, testing showed
// absolutely horrid performance.
function getUniqueTokens(tokens) {
  const distinctTokens = [];
  for(let i = 0, len = tokens.length, token, keys = {}; i < len; i++) {
    token = tokens[i];
    if(!(token in keys)) {
      keys[token] = 1;
      distinctTokens.push(token);
    }
  }
  return distinctTokens;
}

// Splits a string value into an array of strings ideally representing
// separate words
function tokenize(value) {
  return value.split(/[\s\-_0-9]+/g);
}

// Derives a bias to an element's score based on its attributes
// TODO: maybe it is ok to assume that id and name are always single
// words and never multi-word values, and maybe i only need to tokenize
// className
function getAttributeBias(element) {
  // I am using var for now because of Chrome deopt warnings
  var bias = 0.0;

  // Merge attribute values into a single string
  // Accessing attributes by property is faster than using getAttribute
  // Array.prototype.join implicitly filters null values
  var values = [element.id, element.name, element.className].join(' ');

  // If the element did not have any values for the attributes checked,
  // then values will only contain a small string of spaces so we exit early
  // to minimize the work done.
  if(values.length < 3) {
    return bias;
  }

  var tokens = getUniqueTokens(tokenize(values.toLowerCase()));

  // Using a raw for loop instead of reduce or map then reduce because
  // of performance issues.
  for(var i = 0, len = tokens.length, token; i < len; i++) {
    token = tokens[i];
    if(token) {
      bias += (ATTRIBUTE_BIAS[token] || 0.0);
    }
  }

  return bias;
}

// Remove elements that do not intersect with the best element
function prune(document, bestElement) {

  // In order to reduce the number of removals, this uses a contains check
  // to avoid removing elements that exist in the static node list but
  // are descendants of elements removed in a previous iteration. The
  // assumption is that this yields better performance.

  // TODO: instead of doing two calls to contains, I think I can use one
  // call to compareDocumentPosition and then check against its result.
  // I am not very familiar with compareDocumentPosition yet, that is the
  // only reason I am not using it.

  const docElement = document.documentElement;
  const elements = document.querySelectorAll('*');
  utils.forEach(elements, function maybePrune(element) {
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      docElement.contains(element)) {
      element.remove();
    }
  });
}

exports.applyCalamine = applyCalamine;
} (this));
