// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Calamine filters boilerplate shingles from a document

// TODO: bring in ideas from calamine-dev and then delete calamine-dev.js
// TODO: re intrinsic bias, there are only maybe 5-6 likely elements and 
// everything else is very unlikely. <div> is the most likely.

// TODO: maybe deprecate scores prefill with 0
// TODO: reconsider single pass approach
// TODO: consider using multiple maps for the various scores and 
// only integrating in the find best element final step
// consistently use floats insteads of ints for scores/biases
// instead of storing in element.dataset, just use several maps,
// and then calc net score at end

const Calamine = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Filters boilerplate content
Calamine.transform = function Calamine$Transform(document, annotate) {
  const scores = initScores(document);
  applyTextBias(document, scores, annotate);
  applyIntrinsicBias(document, scores, annotate);
  applyDownwardBias(document, scores, annotate);
  applyUpwardBias(document, scores, annotate);
  applyImageContainerBias(document, scores, annotate);
  applyAttributeBias(document, scores, annotate);
  annotateScores(annotate);
  const bestElement = findBestElement(document, scores);
  removeNonIntersectingElements(document, bestElement);
};

function initScores(document) {
  // We fill 0 to avoid having to check if score 
  // is set each time we change it.
  const scores = new Map();
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    scores.set(elements[i], 0);
  }
  return scores;
}

function annotateScores(scores, annotate) {
  if(annotate) {
    for(let entry of scores) {
      entry[0].dataset.score = entry[1].toFixed(2);
    }
  }
}

function findBestElement(document, scores) {
  let bestElement = document.body;
  let bestScore = scores.get(bestElement);
  for(let entry of scores) {
    if(entry[1] > bestScore) {
      bestElement = entry[0];
      bestScore = entry[1];
    }
  }
  return bestElement;
}

function removeNonIntersectingElements(document, bestElement) {
  const it = document.createNodeIterator(
    document.documentElement,
    NodeIterator.SHOW_ELEMENT, 
    rejectIntersects.bind(this, bestElement));
  let element = it.nextNode();
  while(element) {
    element.remove();
    element = it.nextNode();
  }
}

// Rejects elements that intersect with the best element
// TODO: use Node.compareDocumentPosition
function rejectIntersects(bestElement, node) {
  return node === bestElement || bestElement.contains(node) ||
    node.contains(bestElement) ? NodeFilter.FILTER_REJECT : 
    NodeFilter.FILTER_ACCEPT;
}

const RE_WHITESPACE = /\s|&nbsp;/g;

// Generate a map between document elements and a count 
// of characters within the element. This is tuned to work
// from the bottom up rather than the top down.
function deriveTextLength(document) {
  const map = new Map();

  const it = document.createNodeIterator(
    document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while(node) {
    const length = node.nodeValue.replace(RE_WHITESPACE, '').length;

    if(length) {
      let element = node.parentElement;
      while(element) {
        const previousLength = map.get(element) || 0;
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
    bias = Math.min(4000, bias);
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
  for(let i = 0; i < numLists; i++) {
    const listDescendant = listDescendants[i];
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
  for(let i = 0; i < numNavs; i++) {
    const navDescendant = navDescendants[i];
    scores.set(navDescendant, scores.get(navDescendant) - 50);

    if(annotate) {
      const currentBias = 
        parseFloat(navDescendant.dataset.navDescendantBias) || 0.0;
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
  for(let i = 0; i < numImages; i++) {
    const image = images[i];
    const parent = image.parentElement;

    // Ignore images without a parent
    if(!parent) {
      console.debug('Encountered orphan image %o', image);
      continue;
    }

    let bias = 0.0;

    // Dimension bias
    if(image.width && image.height) {
      const area = image.width * image.height;
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

    const caption = DOMUtils.findCaption(image);
    if(caption) {
      bias += 50.0;
    }

    // Carousel bias
    const children = parent.childNodes;
    const numChildren = children.length;
    for(let j = 0; j < numChildren; j++) {
      const node = children[j];
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

const ITEM_TYPES = [
  'Article',
  'Blog',
  'BlogPost',
  'BlogPosting',
  'NewsArticle',
  'ScholarlyArticle',
  'TechArticle',
  'WebPage'
];

// Bias certain elements based on attribute values
// TODO: itemscope?
// TODO: itemprop="articleBody"?
// TODO: [role="article"]?
function applyAttributeBias(document, scores, annotate) {

  // chrome is warning about unsupported phi use of const variable
  // so using var

  var selector = 'a, aside, div, dl, figure, h1, h2, h3, h4,' +
    ' ol, p, section, span, ul';
  var elements = document.querySelectorAll(selector);
  var numElements = elements.length;
  var element = null;
  var bias = 0.0;

  for(let i = 0; i < numElements; i++) {
    element = elements[i];
    bias = getAttributeBias(element);
    scores.set(element, scores.get(element) + bias);
    if(annotate) {
      element.dataset.attributeBias = bias;
    }
  }

  // Pathological case for class="article"
  var articleClassElements = document.getElementsByClassName('article');
  var currentBias = 0.0;
  if(articleClassElements.length === 1) {
    element = articleClassElements[0];
    scores.set(element, scores.get(element) + 1000);
    if(annotate) {
      currentBias = parseFloat(element.dataset.attributeBias) || 0.0;
      element.dataset.attributeBias = currentBias + 1000;
    }
  }
  
  // Pathological case for class="articleText"
  var articleTextClassElements = document.getElementsByClassName(
    'articleText');
  if(articleTextClassElements.length === 1) {
    element = articleTextClassElements[0];
    scores.set(element, scores.get(element) + 1000);

    if(annotate) {
      currentBias = parseFloat(element.dataset.attributeBias) || 0.0;
      element.dataset.attributeBias = currentBias + 1000;
    }
  }

  // Pathological case for class="articleBody"
  var articleBodyClassElements = document.getElementsByClassName(
    'articleBody');
  if(articleBodyClassElements.length === 1) {
    element = articleBodyClassElements[0];
    scores.set(element, scores.get(element) + 1000);

    if(annotate) {
      currentBias = parseFloat(element.dataset.attributeBias) || 0.0;
      element.dataset.attributeBias = currentBias + 1000;
    }
  }

  // Item types
  ITEM_TYPES.forEach(function processItemType(schema) {
    var selector = '[itemtype="' + 'http://schema.org/' + schema + '"]';
    var elements = document.querySelectorAll(selector);
    if(elements.length !== 1) return;
    var element = elements[0];
    scores.set(element, scores.get(element) + 500);
    if(annotate) {
      element.dataset.itemTypeBias = 500;
    }
  });
}

const ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -200],
  ['artext1',100],
  ['articles', 100],
  ['articlecontent', 1000],
  ['articlecontentbox', 200],
  ['articleheadings', -50],
  ['articlesection', 200],
  ['articlesections', 200],
  ['attachment', 20],
  ['author', 20],
  ['block', -5],
  ['blog', 20],
  ['blogpost', 500], // Seen as itemprop value
  ['blogposting', 500],
  ['body', 100],
  ['bodytd', 50],
  ['bookmarking', -100],
  ['bottom', -100],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['cmt', -100],
  ['cmmt', -100],
  ['colophon', -100],
  ['column', 10],
  ['combx', -20],
  ['comic', 75],
  ['comment', -500],
  ['comments', -300],
  ['commercial', -500],
  ['community', -100],
  ['complementary', -100], // Seen as role
  ['component', -50],
  ['contact', -50],
  ['content', 100],
  ['contentpane', 200], // Google Plus
  ['contenttools', -50],
  ['contributors', -50],
  ['credit', -50],
  ['date', -50],
  ['dcsimg', -100],
  ['dropdown', -100],
  ['email', -100],
  ['entry', 100],
  ['excerpt', 20],
  ['facebook', -100],
  ['featured', 20],
  ['fn', -30],
  ['foot', -100],
  ['footer', -200],
  ['footnote', -150],
  ['ftr', -100],
  ['ftrpanel', -100],
  ['google', -50],
  ['gutter', -300],
  ['guttered', -100],
  ['head', -50],
  ['header', -100],
  ['heading', -50],
  ['hentry', 150],
  ['hnews', 200],
  ['inset', -50],
  ['insta', -100],
  ['left', -75],
  ['legende', -50],
  ['license', -100],
  ['like', -100],
  ['link', -100],
  ['links', -100],
  ['logo', -50],
  ['main', 50],
  ['mainbodyarea', 100],
  ['maincolumn', 50],
  ['mainnav', -500],
  ['mainnavigation', -500],
  ['masthead', -30],
  ['media', -100],
  ['mediaarticlerelated', -50],
  ['menu', -200],
  ['menucontainer', -300],
  ['meta', -50],
  ['most', -50],
  ['nav', -200],
  ['navbar', -100],
  ['navigation', -100],
  ['navimg', -100],
  ['newsarticle', 500],
  ['newscontent', 500],
  ['newsletter', -100],
  ['next', -300],
  ['nfarticle', 500],
  ['page', 50],
  ['pagetools', -50],
  ['parse', -50],
  ['pinnion', 50],
  ['popular', -50],
  ['popup', -100],
  ['post', 150],
  ['power', -100],
  ['prev', -300],
  ['print', -50],
  ['promo', -200],
  ['promotions', -200],
  ['ranked', -100],
  ['reading', 100],
  ['recap', -100],
  ['recreading', -100],
  ['rel', -50],
  ['relate', -300],
  ['related', -300],
  ['relposts', -300],
  ['replies', -100],
  ['reply', -50],
  ['retweet', -50],
  ['right', -100],
  ['rightcolumn', -100],
  ['rightrail', -100],
  ['scroll', -50],
  ['share', -200],
  ['sharebar', -200],
  ['shop', -200],
  ['shout', -200],
  ['shoutbox', -200],
  ['side', -200],
  ['sig', -50],
  ['signup', -100],
  ['snippet', 50],
  ['social', -200],
  ['socialnetworking', -250],
  ['socialtools', -200],
  ['source',-50],
  ['sponsor', -200],
  ['story', 100],
  ['storycontent', 500],
  ['storydiv',100],
  ['storynav',-100],
  ['storytext', 200],
  ['storytopbar', -50],
  ['storywrap', 50],
  ['strycaptiontxt', -50],
  ['stryhghlght', -50],
  ['strylftcntnt', -50],
  ['stryspcvbx', -50],
  ['subscribe', -50],
  ['summary',50],
  ['tabs', -100],
  ['tag', -100],
  ['tagcloud', -100],
  ['tags', -100],
  ['teaser', -100],
  ['text', 20],
  ['this', -50],
  ['time', -30],
  ['timestamp', -50],
  ['title', -50],
  ['tool', -200],
  ['topheader', -300],
  ['toptabs', -200],
  ['twitter', -200],
  ['txt', 50],
  ['utility', -50],
  ['vcard', -50],
  ['week', -100],
  ['welcome', -50],
  ['widg', -200],
  ['widget', -200],
  ['wnstorybody', 1000],
  ['zone', -50]
]);

const ATTRIBUTE_SPLIT = /[\s\-_0-9]+/g;

// TODO: the call to getAttributeBias appears to be a
// hotspot. Still needs a bit of tuning
function getAttributeBias(element) {
  const values = [];
  const id = element.getAttribute('id');
  if(id) values.push(id);
  const name = element.getAttribute('name');
  if(name) values.push(name);
  const className = element.getAttribute('class');
  if(className) values.push(className);
  const itemprop = element.getAttribute('itemprop');
  if(itemprop) values.push(itemprop);
 
  const allValues = values.join(' ');
  const normalizedValues = allValues.toLowerCase();

  // TODO: split on case-transition (lower2upper,upper2lower)
  // and do not lower case the value prior to the split, do it after
  const tokens = normalizedValues.split(ATTRIBUTE_SPLIT);

  let bias = 0;
  const seenTokens = new Set();
  const numTokens = tokens.length;
  let token = '';
  let tokenBias = 0;
  for(let i = 0; i < numTokens; i++) {
    token = tokens[i];
    if(token) {
      if(!seenTokens.has(token)) {
        seenTokens.add(token);
        tokenBias = ATTRIBUTE_BIAS.get(token) || 0;
        bias = bias + tokenBias;
      }
    }
  }

  return bias;
}

} // END ANONYMOUS NAMESPACE
