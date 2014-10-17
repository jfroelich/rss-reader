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
 */
(function (exports) {
'use strict';

var forEach = Array.prototype.forEach;
var reduce = Array.prototype.reduce;

exports.calamine = {
  /**
   * Returns the best element of the document. Does some mutation
   * to the document.
   * TODO: rename to 'rub'? relieve (e.g. toplogical relief)?
   */
  transform: function transform_(doc, options) {

    // options is optional but if specified must be
    // a type of object, or a function as it can also have props
    var optType = typeof options;
    if(optType != 'object' && optType != 'function') {
      options = {};
    }

    if(options.FILTER_NAMED_AXES) {
      filterBoilerplateAxes(doc);
    }

    var elements = doc.body.getElementsByTagName('*');
    var scores = initScores(doc, elements);
    applyTextLengthBias(doc, scores, elements, options);
    applyIntrinsicBias(doc, elements, scores);
    applyDownwardBias(doc, scores);
    applyUpwardBias(elements, scores);
    applyImageBias(doc, scores);
    applyAttributeBias(doc, elements, scores);
    maybeExposeAttributes(doc, scores, options);
    return findBestElement(doc, elements, scores);
  }
};

function filterBoilerplateAxes(doc) {

  // NOTE: this accounts for about 60-80% of the processing time

  // Note: Ideally, a block-based approach would avoid the need
  // for this step but the current best element approach effectively requires
  // it. These selectors target boilerplate typically found in the best
  // element, after processing, but are applied before processing to reduce the
  // amount of elements considered and reduce error. Most of the selectors are
  // conservative to avoid filtering non-boilerplate

  var detach = detachBySelector.bind(null, doc.body);
  BLACKLIST_SELECTORS.forEach(detach);
}

function initScores(doc, elements) {
  var scores = new Map();
  scores.set(doc.documentElement, 0);
  scores.set(doc.body, 0);
  forEach.call(elements, function (e) { scores.set(e, 0); });
  return scores;
}

/**
 * Collects the length of each node's inner text. Returns a map of node to
 * inner text length. Nodes without text are not not stored in the map.
 *
 * This uses an agglomerative approach in contrast to a top down approach
 * (using element.textContent) because there is a substantial performance
 * benefit and the code is still simple.
 */
function collectTextNodeLengths(doc) {
  var map = new Map();
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var count = 0;
  var sum = 0;

  for(var node = it.nextNode(); node; node = it.nextNode()) {
    // NOTE: node.nodeValue is never null for text nodes, as otherwise
    // the text node would not exist
    // We have to trim as otherwise we end up counting whitespace
    // and many authors use copious amounts of extraneous whitespace
    count = node.nodeValue.trim().length;

    // Ignore nodes without a length after trimming. This is common as
    // "\n" text nodes are prevalent.
    if(!count) continue;

    // Walk upwards and store the count in each ancestor. The node currently
    // points to a text node, which itself is ignored. We only care about
    // elements. Text nodes cannot contain other text nodes so we know
    // that each parent here is an element.
    for(node = node.parentNode; node; node = node.parentNode) {
      // Get the count for the node that already exists from prior iteration
      sum = map.get(node) || 0;
      map.set(node, sum + count);
    }
  }

  return map;
}

/**
 * Aggregate the count of text within anchors within ancestors. Done from the
 * bottom up in a second pass for performance
 */
function collectAnchorElementTextLengths(doc, charCounts) {

  var map = new Map();

  // We specifically select only non-nominal anchors because we only
  // want non-nominals to affect scoring
  var anchors = doc.body.querySelectorAll('a[href]');

  forEach.call(anchors, function aggregate(anchor) {
    var sum = 0;
    var count = charCounts.get(anchor);
    // Ignore anchors without inner text (e.g. image link)
    if(!count) return;

    // Walk upward and store the count in each ancestor
    for(var element = anchor; element; element = element.parentElement) {
      sum = map.get(element) || 0;
      map.set(element, sum + count);
    }
  });

  return map;
}

/**
 * Apply a bias based the number of characters and the number of characters
 * within anchors to each element's score. This "magical" formula is an
 * adaptation of a simple regression using some empirical weights.
 * Nodes with large amounts of text, that is not anchor text, get the most
 * positive bias. Adapted from "Boilerplate Detection using Shallow Text
 * Features" http://www.l3s.de/~kohlschuetter/boilerplate
 */
function applyTextLengthBias(doc, scores, elements, options) {

  var charCounts = collectTextNodeLengths(doc);
  var anchorChars = collectAnchorElementTextLengths(doc, charCounts);

  forEach.call(elements, function (e) {
    var cc = charCounts.get(e) || 0;

    if(cc && options.SHOW_CHAR_COUNT) {
      e.setAttribute('cc', cc);
    }

    var acc = anchorChars.get(e) || 0;

    if(acc && options.SHOW_ANCHOR_CHAR_COUNT) {
      e.setAttribute('acc', acc);
    }

    var bias = 0.25 * cc - 0.7 * acc;

    // Capping the maximum bias amount. Tentative.
    bias = Math.min(4000, bias);
    scores.set(e, scores.get(e) + bias);
  });
}

/**
 * Apply an intrinsic bias (based on the type of element itself)
 */
function applyIntrinsicBias(doc, elements, scores) {

  forEach.call(elements, function (element) {
    var bias = INTRINSIC_BIAS.get(element.localName);
    if(!bias) return;
    var score = scores.get(element);
    scores.set(element, score + bias);
  });

  // INTRINSIC_BIAS intentionally does not contain a bias for the
  // article element. Some websites, such as the Miami Herald, use
  // the article element multiple times for reasons such as a list of
  // related articles. Therefore, we have three cases: no article element,
  // one article element, or multiple. If one, promote greatly. If none
  // or multiple, promote weakly.

  var articles = doc.body.getElementsByTagName('article');
  if(articles.length == 1) {
    scores.set(articles[0], scores.get(articles[0]) + 1000);
  } else {
    forEach.call(articles, updateScore.bind(null, scores, 100));
  }
}

function applyDownwardBias(doc, scores) {
  // Penalize list and list-like descendants
  // NOTE: ignores dt due to rare usage
  var SELECTOR_LIST = 'li *, ol *, ul *, dd *, dl *';
  var listDescendants = doc.body.querySelectorAll(SELECTOR_LIST);
  forEach.call(listDescendants, updateScore.bind(null, scores, -20));

  // Penalize descendants of navigational elements. Due to pre-filtering this
  // is largely a no-op, but pre-filtering may be disabled in the future.
  // Essentially this just biases <aside> because header/footer/nav are
  // in the blacklist.
  var SELECTOR_NAV = 'aside *, header *, footer *, nav *';
  var navDescendants = doc.body.querySelectorAll(SELECTOR_NAV);
  forEach.call(navDescendants, updateScore.bind(null, scores, -50));
}

// Bias the parent of certain elements
function applyUpwardBias(elements, scores) {

  forEach.call(elements, function (element) {
    var parent = element.parentElement;
    var bias = DESCENDANT_BIAS.get(element.localName);
    if(!bias) return;
    var currentScore = scores.get(parent);
    scores.set(parent, currentScore + bias);
  });
}

// Score images and image parents
function applyImageBias(doc, scores) {

  var images = doc.body.getElementsByTagName('img');
  forEach.call(images, function (image) {
    var parent = image.parentElement;
    // Avoid over-promotion of slideshow-container elements
    var carouselBias = reduce.call(parent.childNodes, function (bias, node) {
      return 'img' === node.localName && node !== image ? bias - 50 : bias;
    }, 0);

    // Bump images that the author bothered to describe
    var descBias = image.getAttribute('alt') ||  image.getAttribute('title') ||
      getImageCaption(image) ? 30 : 0;

    // Proportionally promote large images
    var area = image.width ? image.width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);

    scores.set(image, scores.get(image) + descBias + areaBias);
    scores.set(parent, scores.get(parent) + carouselBias + descBias +
      areaBias);
  });
}

// Conditionally expose attributes for debugging
function maybeExposeAttributes(doc, scores, options) {
  var elements = doc.documentElement.getElementsByTagName('*');
  if(options.SHOW_SCORE) {
    forEach.call(elements, function (e) {
      var score = scores.get(e);
      if(score) {
        e.setAttribute('score', score);
      }
    });
  }
}

/**
 * Find and return the highest scoring element in the document
 */
function findBestElement(doc, elements, scores) {
  // The default best element is doc.body
  var maxElement = doc.body;
  var maxScore = scores.get(doc.body);
  var numElements = elements.length;
  var currentElement = null;
  var currentScore = 0;

  for(var i = 0; i < numElements;i++) {
    currentElement = elements[i];
    currentScore = scores.get(currentElement);

    if(currentScore > maxScore) {
      maxScore = currentScore;
      maxElement = currentElement;
    }
  }

  return maxElement;
}

// Returns the corresponding figcaption element for an image, if present
function getImageCaption(image) {
  // NOTE: use Array.prototype.find once Chrome supports it
  var parents = getParents(image);
  for(var i = 0, len = parents.length, parent; i < len; i++) {
    parent = parents[i];
    if(parent.localName == 'figure') {
      return parent.querySelector('figcaption');
    }
  }
}

function getParents(element) {
  var parents = [];
  for(var parent = element.parentElement; parent;
    parent = parent.parentElement) {
    parents.push(parent);
  }
  return parents;
}

function detachBySelector(root, selector) {

  // Currently consumes approximately 50-70% of the processing time,
  // 100% of which is the nested call to querySelector

  // querySelector is used instead of querySelectorAll because:
  // (1) the code is more concise,
  // (2) the perf delta from querySelectorAll is immaterial, and
  // (3) this avoids the need to check doc.contains(element) per iteration,
  // as the selector restarts from the outer ancestor. Using querySelectorAll
  // would require this extra check because descendants of detached nodes
  // remain in the node list produced by querySelectorAll
  for(var element = root.querySelector(selector); element;
    element = root.querySelector(selector)) {
    element.remove();
  }
}

/**
 * Used to split up the value of an attribute into tokens.
 */
var RE_TOKEN_DELIMITER = /[\s\-_0-9]+/g;

/**
 * Applies an attribute bias to each element's score.
 *
 * For each element, collect some of its attribute values, tokenize the
 * values, and then sum up the biases for the tokens and apply them to
 * the element's score.
 *
 * Due to very poor performance, this uses basic loops and an imperative
 * style. In addition, this previously encounted a strange v8 error about
 * "too many optimizations" so calling functions within loops is avoided.
 *
 * TODO: research itemscope
 * TODO: Open Graph Protocol
 * - <meta property="og:type" content="article">
 *
 */
function applyAttributeBias(doc, elements, scores) {

  // Notes
  // itemtype="http://schema.org/BlogPosting"
  // itemtype="http://schema.org/WebPage"
  //http://schema.org/TechArticle
  //http://schema.org/ScholarlyArticle

  // itemprop="blogPost"
  // itemprop="mainContentOfPage"
  // role="complementary"

  // TODO: Google plus obfuscates attributes but
  // it does use role="article"

  // TODO: itemtype has the same issues as 'article' id/class,
  // in that some articles use the itemtype repeatedly

  var attributeValue = null;
  var bias = 0;
  var element = null;
  var length = elements.length;
  var elementTokens = new Set();
  var attributeTokens = null;
  var i = 0, j = 0;
  var it = null;
  var val = null;

  for(i = 0; i < length; i++) {

    element = elements[i];

    attributeValue = element.id;
    if(attributeValue) {
      attributeValue = attributeValue.trim();
      if(attributeValue) {
        attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
        for(j = 0; j < attributeTokens.length; j++) {
          elementTokens.add(attributeTokens[j]);
        }
      }
    }

    attributeValue = element.name;
    if(attributeValue) {
      attributeValue = attributeValue.trim();
      if(attributeValue) {
        attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
        for(j = 0; j < attributeTokens.length; j++) {
          elementTokens.add(attributeTokens[j]);
        }
      }
    }

    // NOTE: cannot use element.className because it has the
    // potential to return SVGAnimatedString, which is an object
    // that cannot be trimmed or lowercased or split
    attributeValue = element.getAttribute('class');
    if(attributeValue) {
      attributeValue = attributeValue.trim();
      if(attributeValue) {
        attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
        for(j = 0; j < attributeTokens.length; j++) {
          elementTokens.add(attributeTokens[j]);
        }
      }
    }

    attributeValue = element.getAttribute('itemprop');
    if(attributeValue) {
      attributeValue = attributeValue.trim();
      if(attributeValue) {
        attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
        for(j = 0; j < attributeTokens.length; j++) {
          elementTokens.add(attributeTokens[j]);
        }
      }
    }

    attributeValue = element.getAttribute('role');
    if(attributeValue) {
      attributeValue = attributeValue.trim();
      if(attributeValue) {
        attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
        for(j = 0; j < attributeTokens.length; j++) {
          elementTokens.add(attributeTokens[j]);
        }
      }
    }

    // Tentatively disabled while dealing with perf issues
    //attributeValue = getItemType(element);
    //if(attributeValue) {
    //  attributeValue = attributeValue.trim();
    //  if(attributeValue) {
    //    var attributeTokens = attributeValue.toLowerCase().split(RE_TOKEN_DELIMITER);
    //    for(var j = 0; j < attributeTokens.length; j++) {
    //      elementTokens.add(attributeTokens[j]);
    //    }
    //  }
    //}

    // For each token, lookup its corresponding bias and aggregate
    it = elementTokens.values();
    for(val = it.next().value; val; val = it.next().value) {
      bias += ATTRIBUTE_BIAS.get(val) || 0;
    }

    if(bias) {
      scores.set(element, scores.get(element) + bias);

      // Reset for next iteration
      // This is within the if block as otherwise it is 0
      bias = 0;
    }

    // Rather than create a new Set each iteration we reuse
    // the same set object by clearing it. I assume this is
    // faster than creating a new set object each time
    elementTokens.clear();
  }

  // Pathological cases for "articleBody"
  // See, e.g., ABC News, Comic Book Resources
  // Also, because 'article' not in attribute bias, explicitly search here
  // for itemtype article (see schema.org)

  // TODO: article_body (E-Week)

  var articleAttributes =  ['id', 'class', 'name', 'itemprop', 'role'].map(
    function(s) { return '['+s+'*="articlebody"]'; });
  articleAttributes.push('[role="article"]'); // Google Plus
  articleAttributes.push('[itemtype="http://schema.org/Article"]');

  var SELECT_ARTICLE = articleAttributes.join(',');
  var articles = doc.body.querySelectorAll(SELECT_ARTICLE);
  if(articles.length == 1) {
    scores.set(articles[0], scores.get(articles[0]) + 1000);
  } else {
    var forEach = Array.prototype.forEach;
    forEach.call(articles, updateScore.bind(null, scores, 100));
  }
}

// Helper function for applyAttributeBias that gets the
// path component of a schema url
function getItemType(element) {

  // So far the following have been witnessed in the wild
  // http://schema.org/Article
  // http://schema.org/NewsArticle
  // http://schema.org/BlogPosting
  // http://schema.org/Blog

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

  // We know initScores set a score of 0 for
  // every element so there is no need to check
  // if score is undefined prior to update

  scores.set(score + delta);
}

function findArticleTitle(doc) {

  // Check head-title
  // Check meta? Like OGP?
  // Check H1s and such in body
  // Promote earlier elements

  // If found, try and remove trailling text
  // like "article title | newspaper name" > "article title"
  // so look for -,|,: and 1-3 words

}

/**
 * An element's score is biased according to the type of the element. Certain
 * elements are more or less likely to contain boilerplate. The focus here
 * is not assessing whether each element contains boilerplate or not, but how
 * likely could the elementy type serve as the target element.
 */
var INTRINSIC_BIAS = new Map([
  ['main', 100],
  ['section', 50],
  ['blockquote', 10],
  ['code', 10],
  ['content', 200],
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

/**
 * Immediate parents of these elements receive a bias. For example, a <div>
 * that contains several <p>s receives a very positive bias, because that
 * <div> is more likely to be the target
 */
var DESCENDANT_BIAS = new Map([
  ['a', -5],
  ['blockquote', 20],
  ['div', -50],
  ['h1', 10],
  ['h2', 10],
  ['h3', 10],
  ['h4', 10],
  ['h5', 10],
  ['h6', 10],
  ['li', -5],
  ['ol', -20],
  ['p', 30],
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
  ['article', 200],
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
  ['component', -50],
  ['contentpane', 200], // Google Plus
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
  ['gutter', -300],
  ['guttered', -100],
  ['head', -50],
  ['header', -100],
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
  ['newsletter', -100],
  ['page', 50],
  ['pagetools', -50],
  ['parse', -50],
  ['pinnion', 50],
  ['popular', -50],
  ['popup', -100],
  ['post', 150],
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


// TODO: BLACKLIST_SELECTORS should be a Set to demonstrate
// uniqueness of keys

// Hardcoded template-based selectors that are very likely
// to contain boilerplate. Empirically collected.
var BLACKLIST_SELECTORS = [
  'a.aggregated-rel-link', // // The Oklahoman
  'a.carousel-control', // The Miami Herald
  'a.commentLink', // Salt Lake Tribune
  'a.dsq-brlink', // USA Today
  'a.hdn-analytics', // SF Gate
  'a.more-tab', // The Oklahoman
  'a.nextPageLink', // Salt Lake Tribune
  'a.post_cmt1', // Times of India
  'a[rel="tag"]', // // The Oklahoman
  'a.skip-to-text-link', // NYTimes
  'aside.itemAsideInfo', // The Guardian
  'aside#asset-related', // St. Louis Today
  'aside#bpage_ad_bottom', // BuzzFeed
  'aside[data-panelmod-type="relatedContent"]', // LA Times
  'aside.callout', // The Atlantic
  'aside.entry-sidebar', // The Globe
  'aside.livefyre-comments', // Vanity Fair
  'aside.marginalia', // NY Times
  'aside.mashsb-container', // cryptocoinsnews.com
  'aside#post_launch_success', // BuzzFeed
  'aside.prev-next', // The Economist
  'aside.related-articles', // BBC
  'aside.related-content', // // The Oklahoman
  'aside#related-content-xs', // The Miami Herald
  'aside.related-side', // NY Magazine
  'aside.right-rail-module', // Time
  'aside#sidebar', // TechSpot
  'aside#sidebar-read-more', // USA Today
  'aside.story-right-rail', // USA Today
  'aside.tools', // The Boston Globe
  'aside.vestpocket', // Forbes
  'aside.views-tags', // BuzzFeed
  'aside.widget-area', // thedomains.com
  'div#a-all-related', // New York Daily News
  'div.ad', // Reuters
  'div.adAlone300', // The Daily Herald
  'div.adarea', // Telegraph
  'div.ad-cluster-container', // TechCrunch
  'div.ad-container', // Fox News
  'div.addthis_toolbox', // NobelPrize.org
  'div.adCentred', // The Sydney Morning Herald
  'div.adjacent-entry-pagination', // thedomains.com
  'div#addshare', // The Hindu
  'div.admpu', // Telegraph UK
  'div.adsense', // Renew Economy
  'div.ad-unit', // TechCrunch
  'div.advertisementPanel', // TV New Zealand
  'div[aria-label="+1 this post"]', // Google Plus
  'div.artbody > div.share', // China Topix
  'div.art_tabbed_nav', // The Wall Street Journal (blog)
  'div#article div.share', // timeslive.co.za
  'div.article_actions', // Forbes
  'div.article_cat', // Collegian
  'div#article_comments', // Fort Worth Star Telegram
  'div.article_comments', // Voice of America
  'div.articleComments', // Reuters
  'div#articleIconLinksContainer', // The Daily Mail
  'div.article-social', // Fortune Magazine
  'div.articleEmbeddedAdBox', // Mercury News
  'div.article-extra', // TechCrunch
  'div.article_interaction', // Bloomberg
  'div[data-vr-zone="You May Like"]', // Voice of America
  'div.article-list', // // The Oklahoman
  'div#articleKeywords', // The Hindu
  'div.articleMeta', // Tampa Bay
  'div.articleOptions', // Mercury News
  'div#articlepagerreport', // Chron.com
  'div.article-pagination', // UT San Diego
  'div.article-print-url', // USA Today
  'div.articleRelates', // Baltimore Sun
  'div.articleShareBottom', // Fox Sports
  'div.article-side', // The Times
  'div.articleSponsor', // Telegraph Co Uk
  'div.article-tags', // entrepeneur.com
  'div.article-tips', // 9News
  'div.articleTools', // Reuters
  'div.article-tools', // The Atlantic
  'div.article-utilities', // Sports Illustrated
  'div.articleViewerGroup', // Mercury News
  'div.assetBuddy', // Reuters
  'div.at-con', // Design & Trend
  'div.at-next', // Design & Trend
  'div.at-tag', // Design & Trend
  'div.at-tool', // Design & Trend
  'div.author_topics_holder', // The Irish Times
  'div[data-ng-controller="bestOfMSNBCController"]', // MSNBC
  'div.bio-socials', // Atomic Object
  'div.bk-socialbox', // Latin Post
  'div#blq-foot', // BBC
  'div#blog-sidebar', // Comic Book Resources
  'div#blox-breadcrumbs', // Joplin
  'div#blox-comments', // National Standard
  'div#blox-footer', // Joplin
  'div#blox-header', // Joplin
  'div#blox-right-col', // Joplin
  'di#blox-breadcrumbs', // Joplin
  'div#bottom-rail', // Vanity Fair
  'div.bpcolumnsContainer', // Western Journalism
  'div#breadcrumb', // Autonews
  'div.breadcrumb_container', // NBC News
  'div#breadcrumbs', // E-Week
  'div.breadcrumbs', // Scientific American
  'div.browse', // ABC News
  'div.bt-links', // Learning and Finance
  'div[bucket-id="most_popular_01"]', // Telegraph/Reuters
  'div[bucket-id="secondary_navigation_01"]', // Telegraph/Reuters
  'div.buying-option', // Times of India
  'div.byline', // Misc, but the only way to identify Autonews
  'div.byline_links', // Bloomberg
  'div.bylineSocialButtons', // Telegraph Co Uk
  'div.card-stats', // WFPL
  'div.category-nav', // Sparkfun
  'div#ce-comments', // E-Week
  'div.cnn_strybtntools', // CNN
  'div.cnn_strylftcntnt', // CNN
  'div.cnn_strycntntrgt', // CNN
  'div.cn_reactions_comments', // Vanity Fair
  'div#commentary', // Autonews
  'div#comment_bar', // Autonews
  'div#commentBar', // Newsday
  'div.comment_bug', // Forbes
  'div#comment-container', // auburnpub.com
  'div#comments', // CBS News
  'div.comments', // TechCrunch
  'div#commentblock', // Learning and Finance
  'div.commentCount', // Reuters
  'div.comment-count', // auburnpub.com
  'div.comment-count-block',// TechSpot
  'div.comment_count_affix', // // The Oklahoman
  'div.commentDisclaimer', // Reuters
  'div.comment-holder', // entrepeneur.com
  'div#commenting', // Fox News
  'div#commentLink', // // The Oklahoman
  'div#comment-list', // Bangkok Post
  'div#comment-reply-form', // Sparkfun
  'div#comments-tabs', // Houston News
  'div.commentThread', // kotatv
  'div.comment-tools', // Latin post
  'div.comment_links', // Forbes
  'div.comments-overall', // Aeon Magazine
  'div.comment-policy-box', // thedomains.com
  'div#commentPromo', // Salt Lake Tribune
  'div.commentWrap', // Corcodillos
  'div.component-share', // Sports Illustrated
  'div.contribution-stats-box', // Knight News Challenge
  'div.control-bar', // SF Gate
  'div.controls', // NY Daily News
  'div.correspondant', // CBS News
  'div[data-module-zone="articletools_bottom"]', // The Wall Street Journal
  'div[data-ng-controller="moreLikeThisController"]', // MSNBC
  'div.dfad', // thedomains.com
  'div.dfinder_cntr', // Hewlett Packard News
  'div#dfp-ad-mosad_1-wrapper', // The Hill
  'div#digital-editions', // The New Yorker
  'div#disqus', // ABCNews
  'div#disqusAcc', // Telegraph Co Uk
  'div#disqus_thread', // Renew Economy
  'div.editorsChoice', // Telegraph Co Uk
  'div.editors-picks', // The Wall Street Journal
  'div.email-optin', // Quantstart
  'div#email-sign-up', // BBC
  'div.email-signup', // entrepeneur.com
  'div.encrypted-content', // Atlantic City Press
  'div.endslate', // WFMY News (final slide element)
  'div.entity_popular_posts', // Forbes
  'div.entity_preview', // Forbes
  'div.entity_recent_posts', // Forbes
  'div.entry-meta', // Re-code (uncertain about this one)
  'div.entry-related', // The Globe
  'div#entry-tags', // hostilefork
  'div.entry-tags', // Wired.com
  'div.entry-unrelated', // The New Yorker
  'div#epilogue', // hostilefork
  'div.essb_links', // Beta Wired
  'div#et-sections-dropdown-list', // The Washington Post
  'div.pane-explore-issues-topics', // MSNBC
  'div.feature-btns', // USA Today (assumes video not supported)
  'div.feature_nav', // E-Week
  'div#features', // BBC News
  'div.field-name-field-tags', // WFPL
  'div.followable_block', // Forbes
  'div.follow-us', // Fox News
  'div.footer', // KMBC
  'div#forgotPassword', // Joplin Globe
  'div#forgotPasswordSuccess', // Joplin Globe
  'div.gallery-sidebar-ad', // USA Today
  'div.gallery-overlay-outter', // SF Gate
  'div#gkSocialAPI', // The Guardian
  'div.googleads', // Telegraph UK
  'div.group-link-categories', // Symmetry Magazine
  'div.group-links', // Symmetry Magazine
  'div.gsharebar', // entrepeneur.com
  'div.headlines', // // The Oklahoman
  'div.headlines-images', // ABC 7 News
  'div.hide-for-print', // NobelPrize.org
  'div.hst-articlefooter', // Chron.com
  'div.hst-articletools', // Chron.com
  'div.hst-blockstates', // Stamford Advocate (may be problematic)
  'div.hst-featurepromo', // Seattle Pi
  'div.hst-freeform', // Chron.com
  'div.hst-headlinelist', // Chron.com
  'div.hst-hottopics', // Chron.com
  'div.hst-modularlist', // Chron.com
  'div.hst-morestories', // Chron.com
  'div.hst-mostpopular', // Seattle Pi
  'div.hst-newsgallery', // Stamford Advocate
  'div.hst-othernews', // Stamford Advocate
  'div.hst-relatedlist', // Seattle Pi
  'div.hst-simplelist', // Chron.com
  'div.hst-siteheader', // Seattle Pi
  'div.hst-slideshowpromo', // Seattle Pi
  'div.ib-collection', // KMBC
  'div.icons', // Brecorder
  'div#infinite-list', // The Daily Mail
  'div#inlineAdCont', // Salt Lake Tribune
  'div.inline-sharebar', // CBS News
  'div.inline-share-tools-asset', // USA Today
  'div.inline-related-links', // Gourmet.com
  'div.inner-related-article', // Recode
  'div#inset_groups', // Gizmodo
  'div.interactive-sponsor', // USA Today
  'div.issues-topics', // MSNBC
  'div[itemprop="comment"]',// KMBC
  'div#jp-relatedposts', // IT Governance USA
  'div#latest-by-section', // Houston News
  'div.LayoutSocialTools', // ecdc.europa.eu
  'div.LayoutTools', // ecdc.europa.eu
  'div#leader', // hostilefork
  'div.lhs_relatednews', // NDTV
  'div.like-share', // Bangkok Post
  'div.linearCalendarWrapper', // ABC News
  'div.link-list-inline', // Las Vegas Sun
  'div#livefyre-wrapper', // The Wall Street Journal
  'div.ljcmt_full', // LiveJournal
  'div.ljtags', // LiveJournal
  'div.load-comments', // entrepeneur.com
  'div.l-sidebar', // TechSpot
  'div.l-story-secondary', // Boston.com
  'div.main > div#rail', // Fox News
  'div#main-content > div.share', // Knight News Challenge
  'div.main_social', // Times of India
  'div.m-article__share-buttons', // The Verge
  'div.mashsharer-box', // internetcommerce.org
  'div.m-entry__sidebar', // The Verge
  'div.menu', // CNBC
  'div#mergeAccounts', // Joplin Globe
  'div.meta_bottom', // Collegian
  'div#meta-related', // Entertainment Weekly
  'div#mc_embed_signup', // stgeorgeutah.com
  'div.m-linkset', // The Verge
  'div.middle-ads', // The Times
  'div.mla_cite', // NobelPrize.org
  'div.mmn-link', // ABC 7 News
  'div.more-single', // USA Today
  'div.moreweb', // Uptown Magazine
  'div#most-popular', // BBC
  'div#mostPopularTab', // Reuters
  'div#most-read-news-wrapper', // The Daily Mail
  'div#mostSharedTab', // Reuters
  'div#most-watched-videos-wrapper', // The Daily Mail
  'div.mTop15', // Times of India
  'div.multiplier_story', // Christian Science Monitor
  'div.nav', // KMBC (note: may be problematic)
  'div.navigation', // Renew Economy (may be problematic)
  'div#newsletterList', // E-Week
  'div#newsletter_signup_article', // People Magazine
  'div.newsletterSignupBox', // NBC
  'div.newsreel', // The Wall Street Journal
  'div.next_on_news', // BuzzFeed
  'div#nlHeader', // E-Week
  'div.node-footer', // Drupal
  'div.node-metainfo', // The Boston Herald
  'div.NotifyUserBox', // Bangkok Post
  'div.npRelated', // National Post
  'div.NS_projects__project_share', // Kickstarter
  'div.Other-stories ', // Bangkok Post
  'div.overlayPostPlay', // The Sydney Morning Herald
  'div.page_label', // Hewlett Packard News
  'div#page-nav', // Uptown Magazine
  'div.page-navigation', // Misc.
  'div.par-y_rail', // Vanity Fair
  'div.pb-f-page-comments', // Washington Post
  'div.pfont', // Newsday
  'div.pl-most-popular', // entrepeneur.com
  'div#popular-by-section', // Houston News
  'div#popup', // Times of India
  'div.postcats', // The Wall Street Journal (blog)
  'div.postcommentpopupbox', // Times of India
  'div.post-comments', // The Sun Times
  'div.post-links', // Pro Football Talk
  'div.post-meta-category', // Comic Book Resources
  'div.post-meta-share', // Comic Book Resources
  'div.post-meta-tags', // Comic Book Resources
  'div.post-meta-taxonomy-terms', // The Sun Times
  'div.post-share-buttons', // Blogspot
  'div#powered_by_livefyre_new', // Entertainment Tonight
  'div#prevnext', // hostilefork
  'div.printad', // North Jersey
  'div.printHide', // Telegraph UK
  'div.printstory', // North Jersey
  'div#prologue', // hostilefork
  'div.promo-inner', // Chron.com
  'div.promo-top', // Chron.com
  'div.pull-left-tablet', // NY1 (only uses "article" for related)
  // 'div.pull-right', // CANNOT USE (oklahoman vs nccgroup blog)
  'div#reader-comments', // The Daily Mail
  'div.read_more', // Times of India
  'div.recirculation', // New Yorker
  'div.recommended-articles-wrap', // Vice.com
  'div.recommended-links', // The Appendix
  'div#registration-notice', // Atlantic City Press
  'div#registrationNewVerification', // Joplin Globe
  'div#relartstory', // Times of India
  'div#related', // The Boston Globe (note: wary of using this)
  'div.related', // CNBC (note: wary of using this one)
  'div.related-carousel', // The Daily Mail
  'div.related-block', // auburnpub.com
  'div.related-block2', // St. Louis Today
  'div.related-column', // The Hindu
  'div.related-items', // BBC
  'div#related_items', // Business Week
  'div#relatedlinks', // ABC News
  'div.related-media', // Fox News
  'div.relatedNews', // Tampa Bay
  'div.related-posts-inner', // threatpost.com
  'div.relatedRail', // Reuters
  'div#related-services', // BBC
  'div.relatedStories', // Salt Lake Tribute
  'div#related-stories', // Daily News
  'div#related-tags', // St. Louis Today
  'div#relatedTopics', // Reuters
  'div.relatedTopicButtons', // Reuters
  'div.related-vertical', // The Wrap
  'div#related-videos-container', // E-Online
  'div.relatedVidTitle', // E-Online
  'div.rel-block-news', // The Hindu
  'div.rel-block-sec', // The Hindu
  'div.relposts', // TechCrunch
  'div.resizer', // KMBC
  'div#respond', // Stanford Law
  'div#returnTraditional', // Joplin Globe
  'div#returnSocial', // Joplin Globe
  'div#reveal-comments', // Aeon Magazine
  'div#right-column', // The Hindu
  'div.right_rail_cnt', // Hewlett Packard News
  'div#rn-section', // Getty
  'div[role="article"] div.DM', // Google Plus comments
  'div[role="article"] div.Qg', // Google Plus comment count
  'div[role="article"] div.QM', // Google Plus entry tags
  'div[role="article"] div.yx', // Google Plus footer
  'div[role="complementary"]', // USA Today
  'div#rt_contact', // CNBC
  'div#rt_featured_franchise', // CNBC
  'div#rt_primary_1', // CNBC
  'div[id^="rt_promo"]', // CNBC
  'div#rt_related_0', // CNBC
  'div#savedata1', // Times of India
  'div.save-tooltip', // auburnpub
  'div.sd-social', // Re-code
  'div#section-comments',  // The Washington Post
  'div#section-kmt', // The Guardian
  'div.section-puffs', // Telegraph UK
  //'div.share', // CANNOT USE
  'div.share > div.right', // auburnpub.com
  'div.shareArticles', // The Daily Mail
  'div.share-bar', // Gulf News
  'div#sharebarx_new', // Times of India
  'div.share-body-bottom', // BBC
  'div.share-buttons', // Quantstart
  'div.share-count-container', // CNBC
  'div.sharedaddy', // Fortune
  'div.share-help', // BBC
  'div.share_inline_header', // The Economist
  'div.share_inline_footer', // The Economist
  'div.share-link-inline', // Sparkfun
  'div.shareLinks', // Reuters
  'div.sharetools-inline-article-ad', // NYTimes
  'div.shareToolsNextItem', // KMBC
  'div.sharrre-container', // Concurring Opinions
  'div.shortcode-post', // ABC7 News
  'div.show-related-videos', // CBS News
  'div#sidebar', // The Appendix
  'div.sideBar', // Bangkok Post
  'div.sidebar-content', // Concurring opinions
  'div.sidebar-feed', // WRAL
  'div#signIn', // Joplin
  'div.simpleShare', // Newsday
  'div.single-related', // USA Today
  'div.sitewide-footer', // NBCNews
  'div.sitewide-header-content', // NBCNews
  'div.social', // BBC
  'div.social-action', // Pakistan Daily
  'div.social-actions', // BuzzFeed
  'div.socialbar', // Autonews
  'div.socialBar', // Chron.com
  'div.social-bar', // The Miami Herald
  'div.social-bookmarking-module', // Wired.com
  'div.social-buttons', // The Verge
  'div.social-column', // TechSpot
  'div.social-count', // Fox News
  'div.social-dd', // The Wall Street Journal
  'div.sociable', // Mint Press
  'div.social_icons', // Forbes
  'div#social-links', // Reuters
  'div.social-links ', // SF Gate
  'div.social-links-bottom', // MSNBC
  'div.social-links-top', // MSNBC
  'div.socialNetworks', // NBC
  'div#socialRegistration', // Joplin Globe
  'div#social-share', // Priceonomics
  'div.social-share', // Bloomberg
  'div.social-share-top', // Priceonomics
  'div.social-share-bottom', // The Hill
  'div.social-toolbar', // News OK
  'div.social-toolbar-affix', // News OK
  'div#socialTools', // Salt Lake Tribute
  'div.social-tools-wrapper-bottom ', // Washington Post
  'div.spantab', // Times of India
  'div.SPOSTARBUST-Related-Posts', // RObservatory
  'div.sps-twitter_module', // BBC
  'div.stack-talent', // NBC News (author bio)
  'div.stack-video-nojs-overlay', // NBC News
  'div#sticky-nav', // Christian Science Monitor
  'div.sticky-tools', // The Boston Globe
  'div#story_add_ugc', // Fort Worth Star Telegram
  'div.story-block--twitter', // 9News
  'div.story-comment', // Latin Post
  'div#storyContinuesBelow', // Salt Lake Tribune
  'div#storyControls', // Politico
  'div#story-embed-column', // Christian Science Monitor
  'div#story-footer', // The Miami Herald
  'div.story_list', // Christian Science Monitor
  'div#storyMoreOnFucntion', // Telegraph UK
  'div.storynav', // TechCrunch
  'div.story_pagination', // ABC News
  'div#story_right_column_ad', // dailyjournal.net
  'div#story-share-buttons', // USA Today
  'div.story-share-buttons', // USA Today
  'div#story-share-buttons-old', // USA Today
  'div.story-tags', // Fox Sports
  'div.story-taxonomy', // ABC Chicago
  'div.storytools', // TechCrunch
  'div.story-tools', // Latin Post
  'div.submit-button', // Knight News Challenge
  'div.subscribe', // Times of India
  'div#subscription-notice', // Atlantic City Press
  'div#tabs-732a40a7-tabPane-2', // The Miami Herald (unclear)
  'div.talklinks', // LiveJournal
  'div.taxonomy', // ABC Chicago
  'div.t_callout', // ABC News
  'div#teaserMarketingCta', // The Times
  'div.textSize', // CBS
  'div#teaser-overlay', // The Times
  'div.thirdPartyRecommendedContent', // KMBC
  'div#thumb-scroller', // E-Week
  'div.three-up-list', // The Huffington Post
  'div#tncms-region-jh-article-bottom-content', // Idaho Press
  'div.tncms-restricted-notice', // Atlantic City Press
  'div.toolbox', // ABC News
  'div.tools1', // The Wall Street Journal (blog)
  'div.topic-category', // Bangkok Post
  'div.top-index-stories', // BBC
  'div.topkicker', // entrepreneur.com
  'div.top-stories-range-module', // BBC
  'div.top-stories05', // Telegraph UK
  'div#traditionalRegistration', // Joplin Globe
  'div#traditionalAuthenticateMerge', // Joplin Globe
  'div.trb_embed_related', // LA Times
  'div.trb_panelmod_body', //  LA Times
  'div.twipsy', // St. Louis Today
  'div.upshot-social', // The New York Times
  'div.util-bar-flyout', // USA Today
  'div.utilities', // The Times
  'div#utility', // WRAL
  'div.utility-bar', // USA Today
  'div.utility-panels', // WRAL
  'div.utils', // kotatv
  'div.utilsFloat', // KMBC
  'div.video_about_ad', // Christian Science Monitor
  'div.video_disqus', // Bloomberg
  'div#video-share', // ABC News
  'div.view-comments', // auburnpub.com
  'div#vuukle_env', // The Hindu
  'div.wideheadlinelist2', // Chron.com
  'div#WNCol4', // Fox (subsidary myfoxny.com)
  'div#WNStoryRelatedBox', // Fox (subsidiary myfoxal.com)
  'div.xwv-related-videos-container', // The Daily Mail
  'div#you-might-like', // The New Yorker
  'div#zergnet', // Comic Book Resources
  'dl.blox-social-tools-horizontal', // Joplin
  'dl.related-mod', // Fox News
  'dl.tags', // NY Daily News
  'figure.ib-figure-ad', // KMBC
  'figure.kudo', // svbtle.com blogs
  'footer', // Misc.
  'header', // Misc.
  'h2.hide-for-print', // NobelPrize.org
  'h2#page_header', // CNBC
  'h3#comments-header', // Knight News Challenge
  'h3.more-keywords', // Joplin
  'h3#scrollingArticlesHeader', // The Oklahoman
  'h4.taboolaHeaderRight', // KMBC
  'hr', // ALL
  'img#ajax_loading_img', // E-Week
  'li#mostPopularShared_0', // Reuters
  'li#mostPopularShared_1', // Reuters
  'li#pagingControlsPS', // neagle
  'li#sharetoolscontainer', // neagle
  'ol[data-vr-zone="Around The Web"]', // The Oklahoman
  'ol#comment-list', // Pro Football Talk
  'nav', // Misc.
  'p.authorFollow', // The Sydney Morning Herald
  'p.comments', // Telegraph Co Uk
  'p.essay-tags', // Aeon Magazine
  'p.moreVideosTitle', // E-Online
  'p.pagination', // Stamford Advocate
  'p.p_top_10', // Star Telegram
  'p.post-tags', // USA Today
  'p.story-ad-txt', // Boston.com
  'p.storytag', // chinatopix.com
  'p.story-tags', // Latin Post
  'p.trial-promo', // Newsweek
  'section.also-on', // Huffington Post
  'section.around-bbc-module', // BBC
  'section.article-author', // Ars Technica
  'section.bottom_shares', // BuzzFeed
  'section.breaking_news_bar', // Bloomberg
  'section#comments', // TechSpot
  'section.comments', // ABC Chicago
  'section#comments-area', // The Economist
  'section#follow-us', // BBC
  'section.headline-list', // The Miami Herald
  'section.headlines-list', // ABC Chicago
  'section#injected-newsletter', // GigaOM
  'section.morestories', // Entertainment Tonight
  'section#more-stories-widget', // The Miami Herald
  'section#newsletter-signup', // New Yorker
  'section.pagination_controls', // Vanity Fair
  'section#promotions', // The New Yorker
  'section.related_links', // Bloomberg
  'section#related-links', // BuzzFeed
  'section.related-products', // TechSpot
  'section#responses', // BuzzFeed
  'section.section-tertiary', // Sports Illustrated
  'section.share-section', // Sports Illustrated
  'section.signup-widget', // The Miami Herald
  'section.story-tools-mod', // Boston.com
  'section.suggested-links', // The Examiner
  'section.tagblock', // Entertainment Tonight
  'section.three-up', // The Huffington Post
  'section.top-video', // ABC 7 News
  'section.youmaylike', // Entertainment Tonight
  'span.sharetools-label', // NY Time
  'span.text_resizer', // Fort Worth Star Telegram
  'table.hst-articleprinter', // Stamford Advocate
  'table#commentTable', // Times of India
  'table.complexListingBox', // Mercury News
  'ul#additionalShare', // NBC
  'ul.article-options', // TVNZ
  'ul.article-share', // DNA India
  'ul#article-share-links', // The Boston Herald
  'ul.article-tags', // 9News
  'ul.article_tools', // The Wall Street Journal
  'ul#associated', // TV New Zealand
  'ul#blox-body-nav', // Houston News
  'ul.blox-recent-list', // Atlantic City Press
  'ul.breadcrumb', // The Miami Herald
  'ul.breadcrumbs', // Giga OM
  'ul.breaking-news-stories', // ABC 7 News
  'ul.bull-list', // Joplin
  'ul.comment-list', // Sparkfun
  'ul.display-posts-listing', // Recode
  'ul.entry-extra', // Wired Magazine
  'ul.entry_sharing', // Bloomberg
  'ul#flairBar', // Scientific American
  'ul.flippy', // MSNBC
  'ul.generic_tabs', // Bloomberg
  'ul.header-lnks', // Knight News Challenge
  'ul.hl-list', // Chron.com
  'ul.links--inline', // Drupal
  'ul.links-list', // BBC
  'ul.m-block__meta__links', // Tomahawk Nation
  'ul.menu', // The New York Times
  'ul.navbar-nav', // Noctua Software Blog
  'ul.navigation', // USA Today
  'ul.nav-tabs', // The Miami Herald
  'ul.newslist', // Autonews
  'ul#page-actions-bottom', // ESPN
  'ul.pagenav', // The Guardian
  'ul.pagination', // Politico
  'ul.project-nav', // Kickstarter
  'ul.related-links', // The Boston Globe
  'ul.related-posts', // Concurring Opinions
  'ul.rssi-icons', // Pacific Standard Magazine
  'ul.services', // The Appendix
  'ul.sharebar', // CNet
  'ul.share-buttons', // Ars Technica
  'ul.social', // The Sydney Morning Herald
  'ul.social-bookmarking-module', // Wired Magazine
  'ul.socialByline', // The Wall Street Journal (blog)
  'ul.social-icons', // Citylab
  'ul.socials', // independent.ie
  'ul.social-share-list', // TechCrunch
  'ul.social-tools', // The Washington Post
  'ul#story-font-size', // Idaho Press
  'ul.story-tools-sprite', // Houston News
  'ul.tags', // BBC
  'ul.tags-listing', // Colorado Independent
  'ul.text-scale', // GigaOM
  'ul.thumbs', // NY Daily News
  'ul#toolbar-sharing', // UT San Diego
  'ul.tools', // The Syndey Morning Herald
  'ul#topics', // Yahoo News
  'ul.utility-list'// WRAL
];


// Allow external manipulation
exports.calamine.BLACKLIST_SELECTORS = BLACKLIST_SELECTORS;

}(this));
