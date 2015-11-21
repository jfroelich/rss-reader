// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// The Calamine lib provides the transform function that modifies 
// the contents of a Document instance.

// TODO: express everything as probability? Use a scale of 0 to 100
// to represent each element's likelihood of being useful content, where
// 100 is most likely. Every blcok gets its own probability score. Then
// iteratively backfrom from a threshold of something like 50%. Or instead
// of blocks weight the elements and use the best element approach again,
// where probability means the likelihood of any given element being the
// best element, not whether it is content or boilerplate.
// TODO: when the main container has several links, the text bias is very 
// negative. Maybe propagate link text to only block level containers,
// or proportionally decrease the negative bias based on depth
// Note: Ideally, a block-based approach would avoid the need for the blacklisted
// elements removal step but the current best element approach effectively requires
// it. These selectors target boilerplate typically found in the best
// element, after processing, but are applied before processing to reduce the
// amount of elements considered and reduce error.

// TODO: re intrinsic bias, there are only maybe 5-6 likely elements and 
// everything else is very unlikely. <div> is the most likely.

// TODO: pruning blacklisted elements early appears to be too resource 
// intensive. Perhaps it would be better to leave them in until the 
// best element has been found, and then prune the best element. Or, 
// rather than prune, just mark various dom-subtrees as excluded 
// and somehow ignore them when scoring, and then prune after

const Calamine = {};

{ // BEGIN ANONYMOUS NAMESPACE

// Modifies the input document by removing boilerplate text. Also 
// tidies and compresses markup.
Calamine.transform = function(document, rest) {
  const setAnnotation = rest.annotate ? setDatasetProperty : noop;
  const scores = initScores(document);
  applyTextBias(document, scores, setAnnotation);
  applyIntrinsicBias(document, scores, setAnnotation);
  applyDownwardBias(document, scores, setAnnotation);
  applyUpwardBias(document, scores, setAnnotation);
  applyImageContainerBias(document, scores, setAnnotation);
  applyAttributeBias(document, scores, setAnnotation);
  annotateScores(document, scores, rest.annotate);
  removeNonIntersectingElements(document, scores);
};

function initScores(document) {
  const elements = document.getElementsByTagName('*');
  const scores = new Map();
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    scores.set(element, 0);
  }

  return scores;
}

// Calculates and records the text bias for elements. The text bias
// metric is adapted from the algorithm described in the paper 
// "Boilerplate Detection using Shallow Text Features". See 
// See http://www.l3s.de/~kohlschuetter/boilerplate. For better 
// performance, this substitutes character count for word count.
function applyTextBias(document, scores, setAnnotation) {

  // Generate a map between document elements and a count 
  // of characters within the element. This is tuned to work
  // from the bottom up rather than the top down.
  const textLengths = new Map();
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while(node) {
    const length = node.nodeValue.length;
    if(length) {
      let element = node.parentElement;
      while(element) {
        const previousLength = (textLengths.get(element) || 0);
        textLengths.set(element, previousLength + length);
        element = element.parentElement;
      }
    }

    node = it.nextNode();
  }

  // Generate a map between document elements and a count of 
  // the characters contained within anchor elements present 
  // anywhere within the elements
  const anchors = document.querySelectorAll('a[href]');
  const anchorLengths = new Map();
  const numAnchors = anchors.length;
  for(let i = 0; i < numAnchors; i++) {
    const anchor = anchors[i];
    const length = textLengths.get(anchor);
    if(!length) continue;
    anchorLengths.set(anchor, (anchorLengths.get(anchor) || 0) + length);

    let ancestor = anchor.parentElement;
    while(ancestor) {
      const previousLength = (anchorLengths.get(ancestor) || 0);
      anchorLengths.set(ancestor, previousLength + length);
      ancestor = ancestor.parentElement;
    }
  }

  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const length = textLengths.get(element);
    if(!length) continue;
    const anchorLength = anchorLengths.get(element) || 0;

    let bias = (0.25 * length) - (0.7 * anchorLength);
    // Tentatively cap the bias (empirical)
    bias = Math.min(4000, bias);
    if(!bias) continue;
    scores.set(element, scores.get(element) + bias);
    setAnnotation(element, 'textBias', bias.toFixed(2));
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

function applyIntrinsicBias(document, scores, setAnnotation) {

  // Because we are not mutating the document, using a live
  // node list (returned by getElementsByTagName) makes the 
  // most sense since there is very little overhead in 
  // performing the query multiple times.

  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    if(!element) {
      console.debug('Undefined element? %s', i);
      continue;
    }
    const bias = INTRINSIC_BIAS.get(element.localName);
    if(!bias) continue;
    setAnnotation(element, 'intrinsicBias', bias);
    scores.set(element, scores.get(element) + bias);
  }

  // Pathological case for single article
  const articles = document.getElementsByTagName('article');
  if(articles.length === 1) {
    const article = articles[0];
    scores.set(article, scores.get(article) + 1000);
    setAnnotation(article, 'intrinsicBias', 1000);
  }
}

function applyDownwardBias(document, scores, setAnnotation) {

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
    setAnnotation(listDescendant, 'listDescendantBias', -100);
  }

  // TODO: is it silly to bias such elements if they are 
  // blacklisted?

  // Penalize descendants of navigational elements
  const NAV_SELECTOR = 'aside *, header *, footer *, nav *';
  const navDescendants = document.querySelectorAll(NAV_SELECTOR);
  const numNavs = navDescendants.length;
  for(let i = 0; i < numNavs; i++) {
    const navDescendant = navDescendants[i];
    scores.set(navDescendant, scores.get(navDescendant) - 50);

    // NOTE: this test here is in place due to an unexplained issue with
    // dataset not being defined? Figure out why. Is it because it is 
    // lazily defined on the first data property being added, and we 
    // encounter elements without other data properties yet defined?
    // TODO: and what if it isn't defined? Are we failing to set the 
    // annotation in that case? Is that a bug?
    if(navDescendant.dataset) {
      setAnnotation(navDescendant, 'navDescendantBias', 
        parseInt(navDescendant.dataset.navDescendantBias || '0') - 50);
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
function applyUpwardBias(document, scores, setAnnotation) {
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const bias = UPWARD_BIAS.get(element.localName);
    if(!bias) continue;
    const parent = element.parentElement;
    scores.set(parent, scores.get(parent) + bias);
    setAnnotation(parent, 'upwardBias', parseInt(
      parent.dataset.upwardBias || '0') + bias);
  }
}

// Bias image containers
function applyImageContainerBias(document, scores, setAnnotation) {
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

    const caption = findCaption(image);
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
      setAnnotation(parent, 'imageBias', bias);
      scores.set(parent, scores.get(parent) + bias);      
    }
  }
}

const ITEM_TYPES = [
  'http://schema.org/Article',
  'http://schema.org/Blog',
  'http://schema.org/BlogPost',
  'http://schema.org/BlogPosting',
  'http://schema.org/NewsArticle',
  'http://schema.org/ScholarlyArticle',
  'http://schema.org/TechArticle',
  'http://schema.org/WebPage'
];

// Bias certain elements based on attribute values
// TODO: itemscope?
// TODO: itemprop="articleBody"?
// TODO: [role="article"]?
function applyAttributeBias(document, scores, setAnnotation) {

  // TODO: the call to getAttributeBias appears to be a
  // hotspot. Needs tuning

  const selector = 'a, aside, div, dl, figure, h1, h2, h3, h4,' +
    ' ol, p, section, span, ul';
  const elements = document.querySelectorAll(selector);
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const bias = getAttributeBias(element);
    setAnnotation(element, 'attributeBias', bias);
    scores.set(element, scores.get(element) + bias);
  }

  // Pathological case for class="article"
  const articleClassElements = document.getElementsByClassName('article');
  if(articleClassElements.length === 1) {
    const element = articleClassElements[0];
    scores.set(element, scores.get(element) + 1000);
    if(element.dataset && element.dataset.attributeBias) {
      setAnnotation(element, 'attributeBias',
        (parseFloat(element.dataset.attributeBias) || 0) + 1000);
    } else {
      setAnnotation(element, 'attributeBias', 1000);
    }
  }
  
  // Pathological case for class="articleText"
  const articleTextClassElements = document.getElementsByClassName(
    'articleText');
  if(articleTextClassElements.length === 1) {
    const element = articleTextClassElements[0];
    scores.set(element, scores.get(element) + 1000);
    if(element.dataset && element.dataset.attributeBias) {
      setAnnotation(element, 'attributeBias',
        (parseFloat(element.dataset.attributeBias) || 0) + 1000);
    } else {
      setAnnotation(element, 'attributeBias', 1000);
    }
  }

  // Pathological case for class="articleBody"
  const articleBodyClassElements = document.getElementsByClassName(
    'articleBody');
  if(articleBodyClassElements.length === 1) {
    const element = articleBodyClassElements[0];
    scores.set(element, scores.get(element) + 1000);
    if(element.dataset && element.dataset.attributeBias) {
      setAnnotation(element, 'attributeBias',
        (parseFloat(element.dataset.attributeBias) || 0) + 1000);
    } else {
      setAnnotation(element, 'attributeBias', 1000);
    }
  }

  // Item types
  ITEM_TYPES.forEach(function applyItemTypeBias(schema) {
    const elements = document.querySelectorAll('[itemtype="' + 
      schema + '"]');
    if(elements.length === 1) {
      scores.set(elements[0], scores.get(elements[0]) + 500);
      setAnnotation(elements[0], 'itemTypeBias', 500);
    }
  });
}

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
  const tokens = normalizedValues.split(/[\s\-_0-9]+/g);

  // NOTE: Spread operator is causing deopt
  //const distinctTokens = [...new Set(tokens.filter(identity))];

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

function annotateScores(document, scores, annotate) {

  if(!annotate) return;

  // TODO: this should just iterate over the scores map entries
  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const score = scores.get(element);
    if(score) {
      element.dataset.score = score.toFixed(2);
    }
  }
}

function removeNonIntersectingElements(document, scores) {
  const bestElement = findBestElement(document, scores);

  const it = document.createNodeIterator(document.documentElement,
    NodeIterator.SHOW_ELEMENT);
  let element = it.nextNode();
  while(element) {

    // TODO: use Node.compareDocumentPosition instead of 
    // three conditions
    if(element !== bestElement &&
      !bestElement.contains(element) &&
      !element.contains(bestElement)) {
      element.remove();
    }

    element = it.nextNode();
  }
}

function findBestElement(document, scores) {

  let bestElement = document.body;
  let bestScore = scores.get(bestElement);

  // TODO: this should just iterate over scores map?

  const elements = document.getElementsByTagName('*');
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    const element = elements[i];
    const score = scores.get(element) || 0;
    if(score > bestScore) {
      bestElement = element;
      bestScore = score;
    }
  }

  return bestElement;
}

// todo: move to dom-utils.js
// NOTE: not optimized for live documents
function unwrap(element) {
  const parent = element.parentElement;
  if(parent) {
    while(element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    element.remove();
  }
}

// Export so other modules can use
Calamine.unwrap = unwrap;

// todo: move to dom utils
function remove(element) {
  element.remove();
}

// todo: move to dom utils
function findCaption(image) {
  const parents = getAncestors(image);  
  const figure = parents.find(e => {
    return e.matches('figure')
  });
  if(figure)
    return figure.querySelector('figcaption');
}

// todo: move to dom utils
function getAncestors(element) {
  const parents = [];
  let parent = element.parentElement;
  while(parent) {
    parents.push(parent);
    parent = parent.parentElement;
  }
  return parents;
}

function identity(value) {
  return value;
}

function setDatasetProperty(element, propertyName, value) {
  element.dataset[propertyName] = value;
}

function noop() {}

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

} // END ANONYMOUS NAMESPACE
