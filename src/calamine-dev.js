// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// NOTE: Currently under major refactoring
// let, const
// up/down bias
// find best element

const calamine = {};

/**
 * An array of CSS selectors. These selectors, when present
 * in a page, generally indicate that a particular element
 * within the analyzed document is most likely the root element
 * of the content, in which case, no additional analysis
 * is necessary. Basically, these are fast paths. There is
 * no benefit to a more complete analysis when a document's author
 * makes it apparent.
 */
calamine.KNOWN_CONTENT_SIGNATURES = [
  'article', // HTML5
  '.hentry', // WordPress, microformats.org
  '.entry-content', // microformats.org
  '#article',
  '.articleText',
  '.articleBody',
  '#articleBody',
  '.article_body',
  '.articleContent',
  '.full-article',
  '[itemprop="articleBody"]',
  '[role="article"]',
  '[itemtype="http://schema.org/Article"]',
  '[itemtype="http://schema.org/NewsArticle"]',
  '[itemtype="http://schema.org/BlogPosting"]',
  '[itemtype="http://schema.org/Blog"]',
  '[itemtype="http://schema.org/WebPage"]',
  '[itemtype="http://schema.org/TechArticle"]',
  '[itemtype="http://schema.org/ScholarlyArticle"]',
  '#WNStoryBody' // TypePad blog articles
];

/**
 * Filters boilerplate from a document. The filter is done by transforming
 * the document object itself. The return value represents the best root
 * node, which could be document.body.
 *
 * This is not side effect free due to how various elements in the DOM are
 * removed for being in a blacklist. The idea here is that filtering out
 * blacklisted sections speeds up other processing, and simplifies the removal
 * of boilerplate that resides within the best element. A future version
 * of this may be purer, hopefully.
 *
 * The basic objective is to find the one element in the DOM hierarchy
 * that is most likely the root element under which the majority of the
 * useful content of a web page resides. The goal is not to independently
 * analyze each section of content and determine whether it is boilerplate
 * or not, although that is related.
 *
 * The algorithm works by treating the DOM as a dataset, where each element
 * represents a record, and properties of the element are its columns. There
 * is obviously redundancy when elements are nested, but this is not a concern.
 * Various 'shallow' features are then derived, such as the approximate number
 * of characters contained within the element. Then, an abstract 'score' value
 * is assigned to each element. The higher the score, the more likely the
 * element is the best element. Again, not the same thing as determining
 * whether the element contains boilerplate although that is related is related.
 * Various empirical (as in, dumb) heuristics are used to reward or penalize
 * elements. For example, the larger the amount of text within an element,
 * the higher its score. However, the larger the proportion of that text
 * that falls within hyperlinks to other pages, the greater the penalty.
 * After the elements have been scored, a simple search is done for the
 * best element, which is the result.
 *
 * There are some other heuristics involved, but testing out several approaches
 * suggests the most insightful feature is the amount of text in and out of
 * anchors. Generally, an article has a large amount of text that is not
 * present within anchors. Generally, boilerplate side menus and such have
 * less text and most of the text is within anchors.
 *
 * This is primarily based on the following research:
 * "Boilerplate Detection using Shallow Text Features"
 * http://www.l3s.de/~kohlschuetter/boilerplate
 *
 * TODO: use a better name, like filter or rub or something
 *
 * @param {HTMLDocument} document - the document to transform
 * @param {Object} options - optional, pass in some flags to effect the
 * behavior of the transform
 * @return {Element} - the best element to use as the root
 */
calamine.transform = function(document, options) {
  'use strict';
  options = options || {};

  // TODO: side-effect free?
  if(options.BLACKLIST) {
    options.BLACKLIST.forEach(calamine.prune, document);
  }

  const sig = calamine.find(calamine.KNOWN_CONTENT_SIGNATURES,
    calamine.selectorMatchesOnce, document);
  
  if(sig) {
    // console.debug('fast path %s', sig);

    // TODO: this is wrong, should be returning
    // an element

    return sig;
  }

  const elements = calamine.selectCandidateElements(document);
  const elementLengths = calamine.getElementLengths(document);
  const anchorLengths = calamine.getAnchorLengths(document, elementLengths);
  const scores = calamine.initScores(elements);
  const forEach = Array.prototype.forEach;

  const getDensityBias = calamine.getAnchorDensityBias.bind(null,
    elementLengths, anchorLengths);

  forEach.call(elements, function(element) {
    const anchorDensityBias = getDensityBias(element);
    const attributeBias = calamine.deriveAttributeBias(element);

    const score = anchorDensityBias + attributeBias;
    // TODO: Update score
  });

  // TODO: Annotations

  // TODO: Image bias
  // TODO: Downward bias
  // TODO: Upward bias
  //return calamine.findBestElement(document, elements, scores);

  // temp
  return document.body;
};

/**
 * Local utility function. Expects this instanceof Document.
 * Returns true when the selector matches only one element
 */
calamine.selectorMatchesOnce = function(selector) {
  'use strict';
  return this.querySelectorAll(selector).length === 1;
};

/**
 * Removes all instances of matching elements from a document.
 * Requires a document context (this instanceof HTMLDocument).
 *
 *
 * TODO: maybe pruning already-detached elements is not that
 * much of an issue and querySelectorAll is sufficient
 *
 * TODO: if querySelector is sugar for querySelectorAll[0],
 * then this is really dumb. Research how it is implemented.
 *
 * @param {String} selector - a CSS selector
 */
calamine.prune = function(selector) {
  'use strict';
  let element = this.querySelector(selector);
  while(element) {
    // console.debug('pruning %s', element.outerHTML);
    element.remove();
    element = this.querySelector(selector);
  }
};

/**
 * Select candidate elements (other than document.body). Only these elements
 * can be chosen as the best element (or we fallback to document.body).
 */
calamine.selectCandidateElements = function(document) {
  return document.querySelectorAll(
    'article, content, div, layer, main, section, span');
};

// Setup a map of elements and scores
calamine.initScores = function(elements) {
  'use strict';
  const scores = new Map();
  const numElements = elements.length;

  // Pre-populate to simplify updating scores later
  // TODO: this may no longer be that helpful? if we do not
  // prepop then this function is irrelevant
  for(let i = 0; i < numElements; i++) {
    scores.set(elements[i], 0);
  }
  return scores;
};

// Derive the text length for the candidate elements. For performance,
// aggregate from the bottom up instead of using textContent.length,
// and use character count instead of word count.
calamine.getElementLengths = function(document) {
  'use strict';
  const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  const map = new Map();
  calamine.forEachNode(it, calamine.propagateNodeLength, map);
  return map;
};

// Expects this to be a Map
calamine.propagateNodeLength = function(node) {
  'use strict';
  const len = calamine.getNodeLength(node);
  if(!len) return;
  let ancestor = node.parentElement;
  while(ancestor) {
    this.set(ancestor, (this.get(ancestor) || 0) + len);
    ancestor = ancestor.parentElement;
  }
};

calamine.getNodeLength = function(node) {
  // We are using character count instead of word count as
  // an even shallower metric to avoid the perf cost of tokenizing
  // strings.

  // Word count implicitly ignores intervening and extraneous
  // white space. However, character count does not. So we
  // have to trim. We are not bothering with excessive
  // intervening whitespace (for now).

  return node.nodeValue.trim().length;
};


/**
 * Crude shim for Array.prototype.find
 */
calamine.find = function(array, predicate, thisArg) {
  'use strict';
  const numElements = array.length;
  const boundPredicate = predicate.bind(thisArg);
  for(let i = 0; i < numElements; i++) {
    if(boundPredicate(array[i])) {
      return array[i];
    }
  }
};

/**
 * Basically undo the iterator interface to dom
 * traversal so we can iterate more declaratively
 */
calamine.forEachNode = function(iterator, callback, thisArg) {
  'use strict';
  const boundCallback = callback.bind(thisArg);
  for(let node = iterator.nextNode(); node; node = iterator.nextNode()) {
    boundCallback(node);
  }
};

// Collect non-nominal anchor text length per anchor and aggregate
// over ancestors.
calamine.getAnchorLengths = function(document, lengths) {
  'use strict';
  const anchors = document.querySelectorAll('a[href]');
  const result = new Map();
  const forEach = Array.prototype.forEach;
  const agg = calamine.aggregateAnchorAncestors.bind(lengths);
  forEach.call(anchors, agg, result);
  return result;
};

// Expects this to be bound to a Map storing anchor lengths
calamine.aggregateAnchorAncestors = function(lengths, anchor) {
  'use strict';
  const len = lengths.get(anchor);
  if(!len) return;
  let ancestor = anchor.parentElement;
  while(ancestor) {
    this.set(ancestor, (this.get(ancestor) || 0) + len);
    ancestor = ancestor.parentElement;
  }
};

calamine.getAnchorDensityBias = function(elementLengths, anchorLengths, element) {
  'use strict';
  // Apply a bias based on the text length of each element and the amount of
  // text within anchors within the element.
  // TODO: this obviously needs some improvment. This is just to get
  // something going.

  // Tentative, capping at 4k. Unsure whether this is relevant. If we switch to
  // prob, and we say that anchor density contributes to maybe 60%, then this
  // is a ratio of that 60%, and the cap at 60% would make sense if the function
  // could produce higher numbers. maybe normalize lengths so it is length
  // relative to other lengths. Should definitely be proportional as mixing
  // of absolute bias heuristics with variable text length feels dumb

  // This is performing horribly for several pages. See, e.g.,
  // http://www.local12.com/template/inews_wire/wires.national/351894d8-www.local12.com.shtml
  // The children propagate all the way up. So the main container element has
  // a ton of links causing this to generate a very negative bias
  // I think the solution is to propagate link text to only block-level
  // containers (e.g. div, section, ol, ul, aside).
  // That way divs of nav links that happen to be contained within the main
  // container div end up not negatively influencing the main

  // TODO: one idea is to have anchor count propagate upwards at a diminishing
  // amount. This would help some of the outer wrapper elements that are penalized
  // for containing too many links. But it might end up causing document.body
  // to always win.

  const numChars = elementLengths.get(element);
  if(!numChars) return 0;
  const numAnchorChars = anchorLengths.get(element) || 0;
  let bias = (0.25 * numChars) - (0.7 * numAnchorChars);
  bias = Math.min(4000, bias);
  return bias;
};

/**
 * Each element receives a bias according to the values of its attributes, such
 * as its id, class, name, itemtype, itemprop, and role. These are individual,
 * lowercase tokens that are generally found in the attribute values. They
 * are written to match up to the tokens generated by splitting using
 * RE_TOKEN_DELIMITER.
 */
calamine.ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -200],
  ['artext1',100],
  ['articles', 100],
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
  ['hentry', 150], // Common wordpress class, and microformat
  ['hnews', 200], // Common wordpress class
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
  ['zone', -50]
]);

/**
 * Calculates a bias according to attribute values
 *
 * TODO: itemscope? title? data-*?
 */
calamine.deriveAttributeBias = function(element) {
  'use strict';
  const at = calamine.getMaybeAttribute.bind(null, element);
  const tokens = calamine.tokenize([at('id'), at('name'), at('class'),
    at('itemprop'), at('role'), calamine.getItemTypePath(element) || ''
  ].join(' '));
  return tokens.reduce(calamine.addTokenBias, 0);
};

calamine.getMaybeAttribute = function(element, name) {
  'use strict';
  return element.getAttribute(name) || '';
};

calamine.addTokenBias = function(sum, token) {
  'use strict';
  return sum + (calamine.ATTRIBUTE_BIAS.get(token) || 0);
};


/**
 * Returns the path part of itemtype attribute values. Helper for
 * deriveAttributeBias
 */
calamine.getItemTypePath = function(element) {
  'use strict';
  let value = element.getAttribute('itemtype');
  if(!value) return;
  value = value.trim();
  if(!value) return;
  const lastSlashIndex = value.lastIndexOf('/');
  if(lastSlashIndex == -1) return;
  return value.substring(lastSlashIndex + 1);
};

/**
 * Tokenizes html element attribute values.
 *
 * TODO: split on case-transition (lower2upper,upper2lower)
 */
calamine.tokenize = function(string) {
  'use strict';
  // NOTE: we could just return distinctTokens as a Set
  // but iteration over sets is a bit wonky currently, e.g.
  // "of" is not fully supported. So for now we return an array.
  // I do not know of a simple way to convert a set to an array,
  // yet, so for now we use two data structures. Kind of gross
  // but works for now.
  // NOTE: split can produce empty strings, hence the check for
  // whether token is defined
  const inputTokens = string.toLowerCase().split(/[\s\-_0-9]+/g);
  return [...new Set(inputTokens)];
};

/**
 * Simply returns the value
 */
calamine.identity = function(value) {
  return value;
};

/**
 * Tries to clean up a title string by removing publisher info
 *
 * TODO: support publisher as prefix
 */
calamine.stripTitlePublisher = function(title) {
  'use strict';
  if(!title) return;
  // The extra spaces are key to avoiding truncation of hyphenated terms
  // like dog-house
  let delimiterPosition = title.lastIndexOf(' - ');
  if(delimiterPosition == -1)
    delimiterPosition = title.lastIndexOf(' | ');
  if(delimiterPosition == -1)
    delimiterPosition = title.lastIndexOf(' : ');
  if(delimiterPosition == -1)
    return title;

  const trailingText = title.substring(delimiterPosition + 1);
  const terms = trailingText.split(/\s+/).filter(calamine.identity);
  if(terms.length < 5) {
    return title.substring(0, delimiterPosition).trim();
  }
  return title;
};

////////////////////////////////////////////////////////////////////////
// OLD CODE BELOW

/**
 * Penalize list and navigational element descendants
 */
calamine.applyDownwardBias = function(doc, scores, annotate) {
  'use strict';
  // Penalize list and list-like descendants
  const LIST_DESCENDANT_BIAS = -100;
  const SELECTOR_LIST = 'li *, ol *, ul *, dd *, dl *, dt *';
  const listDescendants = doc.querySelectorAll(SELECTOR_LIST);
  let oldScore = 0;
  let element = null;
  const numListDescendants = listDescendants.length;
  for(let i = 0; i < numListDescendants; i++) {
    element = listDescendants[i];
    oldScore = scores.get(element);
    scores.set(element, oldScore + LIST_DESCENDANT_BIAS);
    // BUG: this ignores the case of nested list descendants
    if(annotate) element.dataset.listDescendantBias = LIST_DESCENDANT_BIAS;
  }

  // Penalize descendants of navigational elements
  const NAV_DESCENDANT_BIAS = -50;
  const SELECTOR_NAV = 'aside *, header *, footer *, nav *';
  const navDescendants = doc.body.querySelectorAll(SELECTOR_NAV);
  const numNavDescendants = navDescendants.length;

  for(let i = 0; i < numNavDescendants; i++) {
    element = navDescendants[i];
    oldScore = scores.get(element);
    scores.set(element, oldScore + NAV_DESCENDANT_BIAS);

    // Same bug as above
    if(annotate) element.dataset.navDescendantBias = NAV_DESCENDANT_BIAS;
  }
};

/**
 * Immediate parents of these elements receive a bias. For example, a <div>
 * that contains several <p>s receives a very positive bias, because that
 * <div> is more likely to be the target
 */
calamine.DESCENDANT_BIAS = new Map([
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

/**
 * Propagate bias upward for certain elements
 */
calamine.applyUpwardBias = function(elements, scores, annotate) {
  'use strict';

  const biasTable = calamine.DESCENDANT_BIAS;

  // http://www.thestate.com/2014/10/24/3765557/udalls-effort-to-woo-women-voters.html
  // Because we only bias immediate parent, the typical case is that a child
  // div that is not the target div gets the highest score.
  // But if we go up to far we end up matching too much and may as well just
  // consider the body element to be the best element.
  // This doesnt actually solve it because the negatives also propagate and the
  // target does not become actual in the above test url.
  // TODO: Maybe the leading image needs to propagate to parent also?
  const numElements = elements.length;
  for(let i = 0; i < numElements; i++) {
    var element = elements[i];
    var bias = biasTable.get(element.localName);
    if(!bias) continue;

    // We only propagate to the immediate parent, not all ancestors. This
    // is different than how downward bias propagation behaves.

    var parent = element.parentElement;

    if(annotate) {

      var prevBias = parseInt(parent.dataset.descendantBias || '0');
      parent.dataset.descendantBias = prevBias + bias;
    }

    scores.set(parent, scores.get(parent) + bias);
  }
};

/**
 * Finds the number of sibling image element for the given image
 */
calamine.countSiblingImages = function(image) {
  'use strict';
  // There is no built in DOM method. There may be a querySelector
  // but just explicitly coding this for now.
  var parent = image.parentElement;
  var siblings = parent.childNodes;
  var count = 0;
  var length = siblings.length;
  for(var i = 0; i < length; i++) {
    if(sibling.localName !== 'img') continue;
    if(sibling === image) continue;
    count++;
  }
  return count;
};

calamine.SIBLING_IMAGE_BIAS = -50;
calamine.DESCRIBED_IMAGE_BIAS = 30;

/**
 * Score image parent elements
 */
calamine.applyImageBias = function(doc, scores, annotate) {
  'use strict';
  var images = doc.body.getElementsByTagName('img');
  for(var i = 0, len = images.length; i < len; i++) {
    var image = images[i];
    var siblingBias = calamine.countSiblingImages(image) *
      calamine.SIBLING_IMAGE_BIAS;
    var descBias = 0;
    if(image.hasAttribute('alt') || image.hasAttribute('title') ||
      image.dataset.title || calamine.findImageCaption(image)) {
      descBias = calamine.DESCRIBED_IMAGE_BIAS;
    }

    var width = image.width;
    var area = width ? width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);

    var imageBias = siblingBias + descBias + areaBias;
    if(!imageBias) continue;

    // TODO: maybe this should be propagating upward by full or partial bias
    // to increase the chance of linking leading images to article
    // text where both share a distant ancestor

    var parent = image.parentElement;
    var oldScore = scores.get(parent);
    scores.set(parent, oldScore + imageBias);

    if(annotate) {
      var oldBias = parent.dataset.imageBias || '0';
      parent.dataset.imageBias = parseFloat(oldBias) + imageBias;
    }
  }
};

/**
 * Searches the DOM for an image's associated figcaption. Does not validate
 * whether the figcaption actually contains text.
 *
 * @param {HTMLElement} image - find the associated figcaption for this image
 * @return {HTMLElement} the associated figcaption or undefined
 */
calamine.findImageCaption = function(image) {
  'use strict';
  // NOTE: figure can be anywhere in an image's ancestry, not just the
  // immediate parent
  // Canonical case: <figure><img><figcaption>foo</figcaption></figure>
  // Other cases:
  // <figure><a href=""><img></a><figcaption>foo</figcaption></figure>
  // <figure><a href=""><img><figcaption>foo</figcaption></a></figure>
  // <figure><img></figure>

  // Walk up the hierarchy looking for the nearest figure. Stop when either
  // finding a figure element or after reaching the document root
  var parent = image.parentElement;
  var figure = null;
  while(parent) {
    if(parent.localName == 'figure') {
      figure = parent;
      parent = null;
    } else {
      parent = parent.parentElement;
    }
  }

  // Return either undefined or search for a descendant
  // figcaption element associated with the image in the same
  // figure element.
  if(figure) return figure.querySelector('figcaption');
};

/**
 * Searches the doc's DOM for the element with the highest score
 *
 * @param {HTMLDocument} doc - the document containing score elements
 * @param {NodeList<HTMLElement>} elements - elements from document.body
 * @param {Map<HTMLElement, float>} scores - element to score map
 * @return the element with the highest (best) score
 */
calamine.findBestElement = function(doc, elements, scores) {
  'use strict';
  // TODO: only consider elements from a restricted subset of elements
  // such as <div>, <article>, etc.

  var maxElement = doc.body;
  var maxScore = scores.get(maxElement);
  var numElements = elements.length;
  var currentScore = 0;

  for(var i = 0; i < numElements; i++) {
    var currentElement = elements[i];
    currentScore = scores.get(currentElement);
    if(currentScore > maxScore) {
      maxScore = currentScore;
      maxElement = currentElement;
    }
  }

  return maxElement;
};
