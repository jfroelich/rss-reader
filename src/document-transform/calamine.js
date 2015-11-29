// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Filters boilerplate content
this.applyCalamine = function _applyCalamine(document, annotate) {

  // Require a body that is not a frameset
  if(!document.querySelector('body')) {
    return;
  }

  const scores = initScores(document);
  applyTextBias(document, scores, annotate);
  applyIntrinsicBias(document, scores, annotate);
  applyDownwardBias(document, scores, annotate);
  applyUpwardBias(document, scores, annotate);
  applyImageContainerBias(document, scores, annotate);
  
  applyCalamineAttributeScore(document, scores, annotate);

  // Pathological attribute scoring cases
  applySingleClassBias(document, scores, annotate, 'article', 1000);
  applySingleClassBias(document, scores, annotate, 'articleText', 1000);
  applySingleClassBias(document, scores, annotate, 'articleBody', 1000);

  // Microdata attribute scoring
  MD_SCHEMAS.forEach(applySchemaBias.bind(null, 
    document, scores, annotate));

  prune(document, scores);
  annotateScores(annotate);
};

function initScores(document) {
  // We fill zeros to avoid having to check if score 
  // is set each time we change it.
  // We prefill 0.0 to give Chrome a value-type hint
  const scores = new Map();
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    scores.set(elements[i], 0.0);
  }
  return scores;
}

function annotateScores(scores, annotate) {
  if(!annotate) return;

  // TODO: use destructuring when Chrome supports
  for(let entry of scores) {
    entry[0].dataset.score = entry[1].toFixed(2);
  }
}

function findBestElement(document, scores) {
  let bestElement = document.body;
  let bestScore = scores.get(bestElement);

  // TODO: use destructuring if supported
  // for(let [element, score] of scores) {
  for(let entry of scores) {
    if(entry[1] > bestScore) {
      bestElement = entry[0];
      bestScore = entry[1];
    }
  }
  return bestElement;
}

// Removes elements not intersecting with the best element
function prune(document, scores) {

  const bestElement = findBestElement(document, scores);

  // Do not use a filter function for createNodeIterator due 
  // to performance issues
  // TODO: use Node.compareDocumentPosition if performance is better

  const it = document.createNodeIterator(
    document.documentElement,
    NodeIterator.SHOW_ELEMENT);
  let element = it.nextNode();
  while(element) {

    if(element !== bestElement && 
      !bestElement.contains(element) &&
      !element.contains(bestElement)) {
      element.remove();
    }

    element = it.nextNode();
  }
}

const RE_WHITESPACE = /\s|&nbsp;/g;

// TODO: need to improve the performance here
function getNodeTextLength(node) {
  return node.nodeValue.replace(RE_WHITESPACE, '').length;
}

// Generate a map between document elements and a count 
// of characters within the element. This is tuned to work
// from the bottom up rather than the top down.
function deriveTextLength(document) {
  const map = new Map();

  const it = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
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

    node = it.nextNode();
  }

  return map;
}

// Generate a map between document elements and a count of 
// the characters contained within anchor elements present 
// anywhere within the elements
// NOTE: chrome is giving a de-opt warning here, so testing with var

function deriveAnchorLength(document, textLengths) {
  var anchors = document.querySelectorAll('a[href]');
  var map = new Map();
  var numAnchors = anchors.length;

  // NOTE: Chrome is whining about unsupported phi use of const variable
  // and it may be due to declaring consts in loops
  var anchor = null;
  var ancestor = null;
  var previousLength = 0;
  var length = 0;

  for(var i = 0; i < numAnchors; i++) {
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

// Calculates and records the text bias for elements. The text bias
// metric is adapted from the algorithm described in the paper 
// "Boilerplate Detection using Shallow Text Features". See 
// See http://www.l3s.de/~kohlschuetter/boilerplate.
function applyTextBias(document, scores, annotate) {

  // const/let is causing de-opts, so using var

  var textLengths = deriveTextLength(document);
  var anchorLengths = deriveAnchorLength(document, textLengths);

  var elements = document.getElementsByTagName('*');
  var numElements = elements.length;

  var element = null;
  var length = 0;
  var bias = 0.0;
  var anchorLength = 0;

  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    length = textLengths.get(element);
    if(!length) continue;
    anchorLength = anchorLengths.get(element) || 0;

    bias = (0.25 * length) - (0.7 * anchorLength);
    // Tentatively cap the bias (empirical)
    bias = Math.min(4000.0, bias);
    if(!bias) continue;
    scores.set(element, scores.get(element) + bias);
  
    if(annotate) {
      element.dataset.textBias = bias.toFixed(2);
    }
  }
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

function applyIntrinsicBias(document, scores, annotate) {
  
  // chrome is warning about de-opts, using var

  var elements = document.getElementsByTagName('*');
  var numElements = elements.length;
  
  var element = null;
  var bias = 0.0;

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

function applyDownwardBias(document, scores, annotate) {

  // Penalize list descendants. Even though we are not mutating, 
  // it seems faster to use querySelectorAll here than using 
  // NodeIterator or getElementsByTagName because we want to include
  // all descendants.
  // TODO: this is buggy, not accumulating bias in annotation
  const LIST_SELECTOR = 'li *, ol *, ul *, dd *, dl *, dt *';
  const listDescendants = document.querySelectorAll(LIST_SELECTOR);
  const numLists = listDescendants.length;

  // init as an element to give chrome a type hint
  // init outside the loop due to strange let/const in loop decl behavior
  let listDescendant = document.documentElement;

  for(let i = 0; i < numLists; i++) {
    listDescendant = listDescendants[i];
    scores.set(listDescendant, scores.get(listDescendant) - 100);
    if(annotate) {
      // TODO: this needs to account for other bias
      listDescendant.dataset.listDescendantBias = -100;
    }

  }

  // Penalize descendants of navigational elements
  const NAV_SELECTOR = 'aside *, header *, footer *, nav *';
  const navDescendants = document.querySelectorAll(NAV_SELECTOR);
  const numNavs = navDescendants.length;
  let navDescendant = document.documentElement;
  let currentBias = 0;
  for(let i = 0; i < numNavs; i++) {
    navDescendant = navDescendants[i];
    scores.set(navDescendant, scores.get(navDescendant) - 50);

    if(annotate) {
      currentBias = parseFloat(
        navDescendant.dataset.navDescendantBias) || 0.0;
      navDescendant.dataset.navDescendantBias = currentBias - 50;
    }
  }
}

// Elements are biased for being parents of these elements
// NOTE: the anchor bias is partially redundant with the text bias
// but also accounts for non-text links (e.g. menu of images)
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

// Bias the parents of certain elements
function applyUpwardBias(document, scores, annotate) {
  
  // chrome warning unsupported phi use of const variable
  // so using var

  var elements = document.getElementsByTagName('*');
  var numElements = elements.length;
  var element = null;
  var bias = 0.0;
  var parent = null;
  var previousBias = 0.0;

  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    bias = UPWARD_BIAS.get(element.localName);
    if(!bias) continue;
    parent = element.parentElement;
    scores.set(parent, scores.get(parent) + bias);
    if(annotate) {
      previousBias = parseFloat(parent.dataset.upwardBias) || 0.0;
      parent.dataset.upwardBias = previousBias + bias;
    }
  }
}

// Bias image containers
function applyImageContainerBias(document, scores, annotate) {
  // We are not mutating, so gebtn is more appropriate than qsa
  const images = document.getElementsByTagName('img');
  const numImages = images.length;
  let image = null;
  let parent = null;
  let area = 0;
  let caption = null;
  let children = null;
  let numChildren = 0;
  let node = null;

  for(let i = 0; i < numImages; i++) {
    image = images[i];
    parent = image.parentElement;

    // Ignore images without a parent
    if(!parent) {
      console.debug('Encountered orphan image %o', image);
      continue;
    }

    let bias = 0.0;

    // Dimension bias
    if(image.width && image.height) {
      area = image.width * image.height;
      bias = 0.0015 * Math.min(100000, area);
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
    for(let j = 0; j < numChildren; j++) {
      node = children[j];
      if(node !== image && node.localName === 'img') {
        bias = bias - 50.0;
      }
    }

    if(bias) {
      scores.set(parent, scores.get(parent) + bias);      
      if(annotate) {
        parent.dataset.imageBias = bias;
      }
    }
  }
}


function applySingleClassBias(document, scores, annotate, className, bias) {
  const elements = document.getElementsByClassName(className);
  if(elements.length !== 1) return;

  const element = elements[0];
  scores.set(element, scores.get(element) + bias);
  if(annotate) {
    let previousBias = parseFloat(element.dataset.attributeBias) || 0.0;
    element.dataset.attributeBias = previousBias + bias;
  }
}

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
