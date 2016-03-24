// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/utils.js

(function(exports) {
'use strict';

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

function applyCalamine(document) {
  let bestElement = findSignature(document);
  if(!bestElement) {
    bestElement = document.documentElement;
    const candidates = document.querySelectorAll(CANDIDATE_SELECTOR);
    const numCandidates = candidates.length;
    let highScore = 0.0;
    let score = 0.0;
    for(let i = 0, element; i < numCandidates; i++) {
      element = candidates[i];
      score = getElementScore(element);
      if(score > highScore) {
        bestElement = element;
        highScore = score;
      }
    }
  }

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

function findSignature(document) {
  for(let i = 0, len = SIGNATURES.length, elements; i < len; i++) {
    elements = document.querySelectorAll(SIGNATURES[i]);
    if(elements.length === 1) {
      return elements[0];
    }
  }
}

function getElementScore(element) {
  const textBias = getTextBias(element);
  const listBias = getListBias(element);
  const navBias = getNavBias(element);
  const ancestorBias = getAncestorBias(element);
  const attributeBias = getAttributeBias(element);
  return textBias + listBias + navBias + ancestorBias + attributeBias;
}

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

function getTextBias(element) {
  const text = element.textContent;
  const trimmedText = text.trim();
  const textLength = trimmedText.length;
  const anchorLength = getAnchorLength(element);
  return (0.25 * textLength) - (0.7 * anchorLength);
}

const LIST_SELECTOR = 'li,ol,ul,dd,dl,dt';
function getListBias(element) {
  return element.closest(LIST_SELECTOR) ? -200.0 : 0.0;
}

const NAV_SELECTOR = 'aside,header,footer,nav,menu,menuitem';
function getNavBias(element) {
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

function getAncestorBias(element) {
  var bias = 0.0;
  for(var childElement = element.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    bias += ANCESTOR_BIAS[childElement.localName] || 0.0;
  }
  return bias;
}

function getImageBias(element) {
  const images = utils.filter(element.childNodes, isImageElement);
  let bias = 0.0;
  utils.forEach(images, function updateImageBias(image) {
    bias += 0.0015 * Math.min(100000.0, image.width * image.height);
    bias += image.getAttribute('alt') ? 20.0 : 0.0;
    bias += image.getAttribute('title') ? 30.0 : 0.0;
    bias += findImageCaption(image) ? 100.0 : 0.0;
  });
  // Carousel penalty
  if(images.length) {
    bias += -50.0 * (images.length - 1);
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

function getAttributeBias(element) {
  var values = [
    element.id,
    element.name,
    element.className
  ].join(' ');
  var tokens = [];
  if(values.length > 2) {
    tokens = values.toLowerCase().split(/[\s\-_0-9]+/g);
    tokens = getUniqueTokens(tokens);
  }

  var bias = 0.0;
  var i = 0;
  var len = tokens.length;
  var token;
  for(; i < len; i++) {
    token = tokens[i];
    if(token) {
      bias += (ATTRIBUTE_BIAS[token] || 0.0);
    }
  }
  return bias;
}

function prune(document, bestElement) {
  const documentElement = document.documentElement;
  const elements = document.querySelectorAll('*');
  utils.forEach(elements, function maybePrune(element) {
    if(!element.contains(bestElement) && !bestElement.contains(element) &&
      documentElement.contains(element)) {
      element.remove();
    }
  });
}

exports.applyCalamine = applyCalamine;
} (this));
