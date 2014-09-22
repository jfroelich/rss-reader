// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Provides the calamine.transform(HTMLDocument) function that guesses at the
 * content of a document. In other words, applying lotion to soothe NLP
 * shingles.
 */
(function (exports) {
'use strict';

if(!Map || !Set) {
  // TODO: shim it for chrome < 38 without exp js features flag
  // TODO: do this in a separate shim file, not here, just use
  // some es6 map/set shim
  console.warn('Map/Set not supported, things will go wrong');
}

var INTRINSIC_BIAS = new Map([
  ['article', 2000],
  ['main', 100],
  ['section', 50],
  ['blockquote', 10],
  ['code', 10],
  ['div', 10],
  ['figcaption', 10],
  ['figure', 10],
  ['ilayer', 10],
  ['layer', 10],
  ['p', 10],
  ['pre', 10],
  ['ruby', 10],
  ['summary', 10],
  ['a', -5],
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

var DESCENDANT_BIAS = new Map([
  ['a', -5],
  ['b', 1],
  ['blockquote', 3],
  ['code', 2],
  ['em', 1],
  ['h1', 1],
  ['h2', 1],
  ['h3', 1],
  ['h4', 1],
  ['h5', 1],
  ['h6', 1],
  ['li', -5],
  ['ol', -5],
  ['p', 5],
  ['pre', 2],
  ['span', 1],
  ['strong', 1],
  ['sub', 2],
  ['summary', 1],
  ['sup', 2],
  ['time', 2],
  ['ul', -5]
]);

var ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -200],
  ['artext1',100],
  ['article', 200],
  ['articlebody', 1000],
  ['articleheadings', -50],
  ['attachment', 20],
  ['author', 20],
  ['block', -5],
  ['blog', 20],
  ['body', 50],
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
  ['community', -100],
  ['component', -50],
  ['contact', -50],
  ['content', 100],
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
  ['gutter', -100],
  ['guttered', -100],
  ['head', -50],
  ['heading', -50],
  ['hentry', 150],
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
  ['maincolumn', 50],
  ['masthead', -30],
  ['mediaarticlerelated', -50],
  ['menu', -200],
  ['menucontainer', -300],
  ['meta', -50],
  ['most', -50],
  ['nav', -200],
  ['navbar', -100],
  ['navigation', -100],
  ['navimg', -100],
  ['newsletter', -100],
  ['page', 50],
  ['pagetools', -50],
  ['parse', -50],
  ['pinnion', 50],
  ['popular', -50],
  ['popup', -100],
  ['post', 100],
  ['power', -100],
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
  ['source',-50],
  ['sponsor', -200],
  ['story', 50],
  ['storydiv',100],
  ['storynav',-100],
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
  ['text', 20],
  ['this', -50],
  ['time', -30],
  ['timestamp', -50],
  ['title', -50],
  ['tool', -200],
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
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
function transformDocument(doc, options) {
  options = options || {};

  var forEach = Array.prototype.forEach;

  // Pre-filter
  var removables = doc.body.querySelectorAll('nav, header, footer');
  forEach.call(removables, function remove(n) { n.remove(); });

  // Initialize scores
  var scores = new Map();
  scores.set(doc.documentElement, -Infinity);
  scores.set(doc.body, -Infinity);
  var elements = doc.body.getElementsByTagName('*');
  forEach.call(elements, function initScore(element) {
    scores.set(element, 0);
  });

  // Derive text features from the bottom up
  var charCounts = new Map();
  for(var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT),
    node = it.nextNode(), count = 0; node; node = it.nextNode()) {
    for(count = node.nodeValue.length, node = node.parentNode; node;
      node = node.parentNode) {
      charCounts.set(node, (charCounts.get(node) || 0) + count);
    }
  }

  // Derive non-nominal anchor features from the bottom up
  var anchorChars = new Map();
  var anchors = doc.body.querySelectorAll('a[href]');
  forEach.call(anchors, function deriveAnchorFeatures(anchor) {
    for(var n = charCounts.get(anchor), el = n && anchor; el;
      el = el.parentElement) {
      anchorChars.set(el, (anchorChars.get(el) || 0) + n);
    }
  });

  // Apply anchors-to-text character ratio bias.
  forEach.call(elements, function applyDensityBias(element) {
    var cc = charCounts.get(element);
    if(!cc) return;
    var acc = anchorChars.get(element) || 0;
    var bias = 0.25 * cc - 0.6 * acc;
    //console.debug('length %s, anchor-chars %s, bias %s', cc, acc, bias);
    if(!bias) return;
    scores.set(element, scores.get(element) + bias);
  });

  // Apply intrinsic bias (based on the type of element itself)
  forEach.call(elements, function applyIntrinsicBias(element) {
    var bias = INTRINSIC_BIAS.get(element.localName);
    if(!bias) return;
    scores.set(element, scores.get(element) + bias);
  });

  // Penalize descendants of list elements
  var listDescendants = doc.body.querySelectorAll('li *,ol *,ul *');
  forEach.call(listDescendants, function biasLists(element) {
    scores.set(element, scores.get(element) - 20);
  });

  // Penalize descendants of navigational elements
  // NOTE: due to pre-filtering this is largely a no-op, but
  // pre-filtering may be disabled in the future
  var navDescendants = doc.body.querySelectorAll(
    'aside *, header *, footer *, nav *');
  forEach.call(navDescendants, function biasNavs(element) {
    scores.set(element, scores.get(element) - 50);
  });

  // Score images and image parents
  var reduce = Array.prototype.reduce;
  var images = doc.body.getElementsByTagName('img');
  forEach.call(images, function scoreImage(image) {
    var parent = image.parentElement;
    var carouselBias = reduce.call(parent.childNodes,
      function calculateImageSiblingPenalty(bias, node) {
      return 'img' === node.localName && node !== image ? bias - 5 : bias;
    }, 0);
    var supportingTextBias = image.getAttribute('alt') ||
      image.getAttribute('title') || (parent.localName == 'figure' &&
      parent.querySelector('figcaption')) ? 30 : 0;
    var area = image.width ? image.width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);
    scores.set(image, scores.get(image) + supportingTextBias + areaBias);
    scores.set(parent, scores.get(parent) + carouselBias +
      supportingTextBias + areaBias);
  });

  // Bias score based on attribute content
  var RE_TOKEN_DELIMITER = /[\s\-_0-9]+/g;
  var identity = function(value) { return value; };

  // TODO: this is still the worst performer
  forEach.call(elements, function biasAttributes(element) {
    var text = (element.id || '') + ' ' + (element.className || '');
    var tokens = text.toLowerCase().split(RE_TOKEN_DELIMITER).filter(identity);
    if(!tokens.length) return;
    var bias = 0;
    var distinctTokens = new Set(tokens);
    distinctTokens.forEach(function sumBias(token) {
      bias += ATTRIBUTE_BIAS.get(token) || 0;
    });
    if(!bias) return;
    scores.set(element, scores.get(element) + bias);
  });

  // Bias the parents of certain elements
  // TODO: deprecate? is this material?
  forEach.call(elements, function biasParent(element) {
    var bias = DESCENDANT_BIAS.get(element.localName);
    if(!bias) return;
    var parent = element.parentElement;
    scores.set(parent, scores.get(parent) + bias);
  });

  // Expose attributes for debugging
  var docElements = doc.documentElement.getElementsByTagName('*');
  forEach.call(docElements, function expose(element) {
    var cc = options.SHOW_CHAR_COUNT && charCounts.get(element);
    cc && element.setAttribute('cc', cc);
    var score = options.SHOW_SCORE && scores.get(element);
    score && element.setAttribute('score', score);
  });

  // Find and return the highest scoring element, defaulting to body
  return reduce.call(elements, function compareScore(max, current) {
    return scores.get(current) > scores.get(max) ? current : max;
  }, doc.body);
}

// Public API
exports.calamine = {
  // todo: rename public function to 'rub'?
  transform: transformDocument
};

}(this));
