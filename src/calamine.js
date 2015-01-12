// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Provides the calamine.transform(HTMLDocument) function that guesses at the
 * content of a document. In other words, applying lotion to soothe NLP
 * shingles.
 *
 * TODO: express everything as probability. Use a scale of 0 to 100
 * to represent each element's likelihood of being useful content, where
 * 100 is most likely. Every blcok gets its own probability score. Then
 * iteratively backfrom from a threshold of something like 50%. Or instead
 * of blocks weight the elements and use the best element approach again,
 * where probability means the likelihood of any given element being the
 * best element, not whether it is content or boilerplate.
 *
 * TODO: maybe use a single bias function and just extract features prior to that
 */
(function (exports) {
'use strict';

var forEach = Array.prototype.forEach;
var reduce = Array.prototype.reduce;

/**
 * Returns the best element of the document. Does some mutation to the
 * document.
 */
function transform(doc, options) {
  options = options || {};

  var blacklist = exports.BLACKLIST_SELECTORS || [];

  if(options.FILTER_NAMED_AXES) {
    blacklist.forEach(function detachSelector(selector) {
      // Currently consumes approximately 50-70% of the processing time,
      // 100% of which is the nested call to querySelector
      // TODO: try a form of visitor pattern instead of querySelector, benchmark
      // TODO: try querySelectorAll+contains instead of querySelector loop
      var root = doc.body;
      var element = root.querySelector(selector);
      while(element) {
        element.remove();
        element = root.querySelector(selector);
      }
    });
  }

  var elements = doc.body.getElementsByTagName('*');
  var scores = initScores(doc, elements);
  applyTextLengthBias(doc, elements, scores, options.ANNOTATE);
  applyIntrinsicBias(doc, elements, scores, options.ANNOTATE);
  applyDownwardBias(doc, scores, options.ANNOTATE);
  applyUpwardBias(elements, scores, options.ANNOTATE);
  applyImageBias(doc, scores, options.ANNOTATE);
  applyAttributeBias(doc, scores, options.ANNOTATE);
  maybeExposeAttributes(doc, scores, options.ANNOTATE);
  return findBestElement(doc, elements, scores);
}

function initScores(doc, elements) {
  var scores = new Map();
  scores.set(doc.documentElement, 0);
  scores.set(doc.body, 0);
  forEach.call(elements, function (element) { scores.set(element, 0); });
  return scores;
}

function collectTextNodeLengths(doc) {
  var lengths = new Map(), length = 0, node = null;
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  while(node = it.nextNode()) {
    length = node.nodeValue.trim().length;
    if(!length) continue;
    while(node = node.parentNode) {
      lengths.set(node, (lengths.get(node) || 0) + length);
    }
  }

  return lengths;
}

/**
 * Aggregate the count of text within non-nominal anchors within ancestors.
 */
function collectAnchorElementTextLengths(doc, charCounts) {
  var anchors = doc.body.querySelectorAll('a[href]');
  return reduce.call(anchors, function (map, anchor) {
    var count = charCounts.get(anchor);
    return count ? [anchor].concat(getAncestors(anchor)).reduce(function(map,
      element) {
      return map.set(element, (map.get(element) || 0) + count);
    }, map) : map;
  }, new Map());
}

/**
 * Apply a bias based the number of characters and the number of characters
 * within anchors to each element's score.
 *
 * Adapted from "Boilerplate Detection using Shallow Text Features"
 * http://www.l3s.de/~kohlschuetter/boilerplate
 */
function applyTextLengthBias(doc, elements, scores, annotate) {

  // This is performing horribly for several pages. See, e.g.,
  // http://www.local12.com/template/inews_wire/wires.national/351894d8-www.local12.com.shtml
  // The children propagate all the way up. So the main container element has
  // a ton of links causing this to generate a very negative bias
  // I think the solution is to propagate link text to only block-level
  // containers (e.g. div, section, ol, ul, aside).
  // That way divs of nav links that happen to be contained within the main
  // container div end up not negatively influencing the main

  var charCounts = collectTextNodeLengths(doc);
  var anchorChars = collectAnchorElementTextLengths(doc, charCounts);

  forEach.call(elements, function handleElement(element) {
    var cc = charCounts.get(element);
    if(!cc) return;
    var acc = anchorChars.get(element) || 0;
    var bias = (0.25 * cc) - (0.7 * acc);
    // Tentative
    bias = Math.min(4000, bias);
    scores.set(element, scores.get(element) + bias);

    if(annotate) {
      element.dataset.textChars = cc;
      if(acc) element.dataset.anchorChars = acc;
      element.dataset.textBias = bias.toFixed(2);
    }
  });
}

/**
 * Apply an intrinsic bias (based on the type of element itself)
 */
function applyIntrinsicBias(doc, elements, scores, annotate) {
  forEach.call(elements, function (element) {
    var bias = INTRINSIC_BIAS.get(element.localName);
    if(!bias) return;
    scores.set(element, scores.get(element) + bias);
    if(annotate) element.dataset.intrinsicBias = bias;
  });

  // Pathological case for article element
  var articles = doc.body.getElementsByTagName('article');
  if(articles.length == 1) {
    var article = articles[0];
    if(annotate) article.dataset.intrinsicBias = 1000;
    scores.set(article, scores.get(article) + 1000);
  } else {
    // There are either 0 or multiple article elements. Since divs get
    // +200 intrinsic, we have to give the article elements a competitive
    // baseline, so inflate them all here. Otherwise child divs of the main
    // article sometimes mistakenly beat out the actual article element.
    // NOTE: we could simply shove article back into INTRINSIC BIAS map
    forEach.call(articles, function(article) {
      if(annotate) article.dataset.intrinsicBias = 200;
      scores.set(article, scores.get(article) + 200);
    });
  }
}

function applyDownwardBias(doc, scores, annotate) {
  // Penalize list and list-like descendants
  var SELECTOR_LIST = 'li *, ol *, ul *, dd *, dl *, dt *';
  var listDescendants = doc.body.querySelectorAll(SELECTOR_LIST);

  forEach.call(listDescendants, function (element) {
    if(annotate) element.dataset.inListPenaltyBias = -100;
    scores.set(element, scores.get(element) - 100);
  });

  // Penalize descendants of navigational elements
  var SELECTOR_NAV = 'aside *, header *, footer *, nav *';
  var navDescendants = doc.body.querySelectorAll(SELECTOR_NAV);
  forEach.call(navDescendants, function (element) {
    if(annotate) element.dataset.inNavPenaltyBias = -50;
    scores.set(element, scores.get(element) - 50);
  });
}

// Bias the parent of certain elements
function applyUpwardBias(elements, scores, annotate) {

  // NOTE: http://www.thestate.com/2014/10/24/3765557/udalls-effort-to-woo-women-voters.html
  // Because we only bias immediate parent, the typical case is that a child div that is
  // not the target div gets the highest score.
  // But if we go up to far we end up matching too much and may as well just consider the body
  // element to be the best element.
  // This doesnt actually solve it because the negatives also propagate and the target does
  // not become actual in the above test url
  // Maybe the leading image needs to propagate to parent also?
  forEach.call(elements, function (element) {
    var bias = DESCENDANT_BIAS.get(element.localName);
    if(!bias) return;
    var parent = element.parentElement;
    // note the subtlety here, we are annotating parent, not element
    if(annotate) {
      var prevBias = parent.dataset.descendantBias || '0';

      parent.dataset.descendantBias = parseInt(prevBias) + bias;
    }
    scores.set(parent, scores.get(parent) + bias);
    // Testing
    //var grandParent = parent.parentElement;
    //var grandParentScore = scores.get(grandParent);
    //var gpBias = bias * 0.8;
    //console.log('Increasing grand parent bias by %s', gpBias);
    //scores.set(grandParent, grandParentScore + gpBias);
  });
}

// Score images and image parents
function applyImageBias(doc, scores, annotate) {
  var images = doc.body.getElementsByTagName('img');
  forEach.call(images, function (image) {
    var parent = image.parentElement;
    // Avoid over-promotion of slideshow-container elements
    var carouselBias = reduce.call(parent.childNodes, function (bias, node) {
      return 'img' === node.localName && node !== image ? bias - 50 : bias;
    }, 0);
    // TODO: this should probably also check data-alt and data-title as many
    // sites use this alternate syntax
    var descBias = image.getAttribute('alt') ||  image.getAttribute('title') ||
      getImageCaption(image) ? 30 : 0;
    var area = image.width ? image.width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);
    var imageBias = carouselBias + descBias + areaBias;
    if(!imageBias) return;
    if(annotate) parent.dataset.imageBias = imageBias;
    scores.set(parent, scores.get(parent) + imageBias);
  });
}

// Conditionally expose attributes for debugging
function maybeExposeAttributes(doc, scores, annotate) {
  if(!annotate) return;
  forEach.call(doc.documentElement.getElementsByTagName('*'), function (element) {
    var score = scores.get(element);
    if(!score) return;
    element.dataset.score = score.toFixed(2);
  });
}

function findBestElement(doc, elements, scores) {
  var maxElement = doc.body;
  var maxScore = scores.get(maxElement);
  var numElements = elements.length;
  var currentElement = null;
  var currentScore = 0;

  for(var i = 0; i < numElements; i++) {
    currentElement = elements[i];
    currentScore = scores.get(currentElement);

    if(currentScore > maxScore) {
      maxScore = currentScore;
      maxElement = currentElement;
    }
  }

  return maxElement;
}

function arrayFind(array, predicate) {
  for(var i = 0, length = array.length, value; i < length; i++) {
    if(predicate(array[i]))
      return array[i];
  }
}

function isFigure(element) {
  return element.localName == 'figure';
}

function getImageCaption(image) {
  // NOTE: figcaption may contain other elements, not
  // just text. So this just checks for whether there is
  // a figcaption element, not whether it has any content
  var parents = getAncestors(image);
  var figure = arrayFind(parents, isFigure);
  if(figure) {
    return figure.querySelector('figcaption');
  }
}

// Walks upward
function getAncestors(element) {
  var parents = [], parent = element;
  while(parent = parent.parentElement) {
    parents.push(parent);
  }
  return parents;
}

/**
 * Splits attribute value into tokens
 * TODO: split on case-transition (lower2upper,upper2lower)
 */
function tokenize(string) {
  var tokens = string.toLowerCase().split(/[\s\-_0-9]+/g).filter(identity);
  var set = new Set(tokens);
  return setToArray(set);
}

function identity(value) {
  return value;
}

function setToArray(set) {

  // Chrome does not support Array.from
  // The Moz polyfill example does something I don't
  // understand, something baout
  // var obj = Object(set);
  // then iterate over ks and vs

  var array = [];
  set.forEach(function(v) {
    array.push(v);
  });
  return array;
}

var SCORABLE_ATTRIBUTES = ['id', 'name', 'class', 'itemprop', 'itemtype', 'role'];

function getAttributeBias(element) {
  var values = SCORABLE_ATTRIBUTES.map(function asValue(name) {
    return name == 'itemtype' ? getItemTypePath(element) :
      element.getAttribute(name);
  }).filter(identity);
  var tokens = tokenize(values.join(' '));
  return tokens.reduce(function add(sum, value) {
    return sum + ATTRIBUTE_BIAS.get(value) || 0;
  }, 0);
}

/**
 * Applies an attribute bias to each element's score.
 *
 * TODO: itemscope
 * TODO: itemtype 'article' id/class issue
 */
function applyAttributeBias(doc, scores, annotate) {
  var SCORABLE_SELECTOR = 'a, aside, div, dl, figure, h1, h2, h3, h4,'+
    ' ol, p, section, span, ul';
  var elements = doc.body.querySelectorAll(SCORABLE_SELECTOR);
  forEach.call(elements, function (element) {
    var bias = getAttributeBias(element);
    if(annotate) element.dataset.attributeBias = bias;
    scores.set(element, scores.get(element) + bias);
  });

  // Pathological cases. The code violates DRY but that is merely because
  // it is experimental.
  // TODO: article_body (E-Week) ?
  // TODO: itemprop="articleBody" ?
  // TODO: [role="article"] ? (Google Plus)
  // TODO: [itemtype="http://schema.org/Article"] ??
  applySingleClassBias(doc, scores, 'article', 1000, annotate);
  applySingleClassBias(doc, scores, 'articleText', 1000, annotate);
  applySingleClassBias(doc, scores, 'articleBody', 1000, annotate);
}

function applySingleClassBias(doc, scores, className, bias, annotate) {
  var elements = doc.body.getElementsByClassName(className);
  if(elements.length != 1) return;
  var e = elements[0];
  if(annotate)
    e.dataset.attributeBias = parseInt(e.dataset.attributeBias || '0') + bias;
  scores.set(e, scores.get(e) + bias);
}

// Returns the path part of itemtype attribute values
function getItemTypePath(element) {
  // http://schema.org/Article
  // http://schema.org/NewsArticle
  // http://schema.org/BlogPosting
  // http://schema.org/Blog
  // http://schema.org/WebPage
  // http://schema.org/TechArticle
  // http://schema.org/ScholarlyArticle
  var value = element.getAttribute('itemtype');
  if(!value) return;
  value = value.trim();
  if(!value) return;
  var lastSlashIndex = value.lastIndexOf('/');
  if(lastSlashIndex == -1) return;
  var path = value.substring(lastSlashIndex + 1);
  return path;
}

/**
 * Updates the score of an element by adding in delta
 */
function updateScore(scores, delta, element) {
  var score = scores.get(element);
  scores.set(element, score + delta);
}

function findArticleTitle(doc) {

  // Check head-title
  // Check meta? Like OGP?
  // Check H1s and such in body
  // Promote earlier elements

  // As an aside, in-article titles are often within or preceding the same
  // element as the best element. If the title is outside the best element
  // then maybe it is a sign the best element should be expanded
}

/**
 * Tries to clean up a title string by removing publisher info
 *
 * TODO: support publisher as prefix
 */
function stripTitlePublisher(title) {

  if(!title) return;
  // The extra spaces are key to avoiding truncation of hyphenated terms
  var delimiterPosition = title.lastIndexOf(' - ');
  if(delimiterPosition == -1)
    delimiterPosition = title.lastIndexOf(' | ');
  if(delimiterPosition == -1)
    delimiterPosition = title.lastIndexOf(' : ');
  if(delimiterPosition == -1)
    return title;
  var trailingText = title.substring(delimiterPosition + 1);
  var terms = trailingText.split(/\s+/).filter(identity);
  if(terms.length < 5) {
    var newTitle = title.substring(0, delimiterPosition).trim();
    return newTitle;
  }
  return title;
}

function identity(value) {
  return value;
}

/**
 * An element's score is biased according to the type of the element. Certain
 * elements are more or less likely to contain boilerplate. The focus here
 * is not assessing whether each element contains boilerplate or not, but how
 * likely could the elementy type serve as the target element.
 *
 * TODO: if the focus is on best element I have no idea what I was thinking
 * here. There are only maybe 5-6 likely elements and everything else
 * is very unlikely. <div> is the most likely. I think this is just remnant
 * of the block-based scoring approach
 */
var INTRINSIC_BIAS = new Map([
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

/**
 * Immediate parents of these elements receive a bias. For example, a <div>
 * that contains several <p>s receives a very positive bias, because that
 * <div> is more likely to be the target
 */
var DESCENDANT_BIAS = new Map([
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
 * Each element receives a bias according to the values of its attributes, such
 * as its id, class, name, itemtype, itemprop, and role. These are individual,
 * lowercase tokens that are generally found in the attribute values. They
 * are written to match up to the tokens generated by splitting using
 * RE_TOKEN_DELIMITER.
 */
var ATTRIBUTE_BIAS = new Map([
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
  ['wnstorybody', 1000],
  ['zone', -50]
]);

exports.calamine = {
  stripTitlePublisher: stripTitlePublisher,
  transform: transform
};

}(this));
