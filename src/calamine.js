// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Provides the calamine.transform(HTMLDocument) function that guesses at
 * the content of a document. In other words, applying lotion to
 * soothe NLP shingles.
 *
 * TODO: support 'picture' element
 */
(function (exports) {
'use strict';

if(!Map || !Set) {
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
  ['articlebody', 300],
  ['articleheadings', -50],
  ['attachment', 20],
  ['author', 20],
  ['block', -5],
  ['blog', 20],
  ['body', 50],
  ['bodytd', 50],
  ['bookmarking', -100],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['cmt', -100],
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
  ['date', -50],
  ['dcsimg', -100],
  ['dropdown', -100],
  ['entry', 100],
  ['excerpt', 20],
  ['facebook', -100],
  ['fn', -30],
  ['foot', -100],
  ['footer', -200],
  ['footnote', -150],
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
  ['link', -100],
  ['logo', -50],
  ['main', 50],
  ['mediaarticlerelated', -50],
  ['menu', -200],
  ['menucontainer', -300],
  ['meta', -50],
  ['nav', -200],
  ['navbar', -100],
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
  ['reading', 100],
  ['recap', -100],
  ['rel', -50],
  ['relate', -300],
  ['replies', -100],
  ['reply', -50],
  ['retweet', -50],
  ['right', -100],
  ['scroll', -50],
  ['share', -200],
  ['shop', -200],
  ['shout', -200],
  ['shoutbox', -200],
  ['side', -200],
  ['sig', -50],
  ['snippet', 50],
  ['social', -200],
  ['socialnetworking', -250],
  ['source',-50],
  ['sponsor', -200],
  ['story', 50],
  ['storydiv',100],
  ['storytopbar', -50],
  ['strycaptiontxt', -50],
  ['stryhghlght', -50],
  ['strylftcntnt', -50],
  ['stryspcvbx', -50],
  ['subscribe', -50],
  ['summary',50],
  ['tag', -100],
  ['tagcloud', -100],
  ['tags', -100],
  ['text', 20],
  ['time', -30],
  ['timestamp', -50],
  ['title', -50],
  ['tool', -200],
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
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 * TODO: make score a function of cc and density instead
 * of searching classes
 */
function scoreElement(featuresMap, element) {
  var features = featuresMap.get(element);
  var cc = features.charCount;
  if(cc) {
    var density = (features.anchorCharCount || 0) / cc;
    if(cc > 1000) {
      if(density > 0.35) {
        features.score += 50;
      } else if(density > 0.2) {
        features.score += 100;
      } else if (density > 0.1) {
        features.score += 100;
      } else if(density > 0.05) {
        features.score += 250;
      } else {
        features.score += 300;
      }
    } else if(cc > 500) {
      if(density > 0.35) {
        features.score += 30;
      } else if(density > 0.1) {
        features.score += 180;
      } else {
        features.score += 220;
      }
    } else if(cc > 100) {
      if(density > 0.35) {
        features.score += -100;
      } else {
        features.score += 60;
      }
    } else {
      if(density > 0.35) {
        features.score -= 200;
      } else if(isFinite(density)) {
        features.score += 20;
      } else {
        features.score += 5;
      }
    }
  }

  featuresMap.set(element, features);
}

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
function transformDocument(doc, options) {
  options = options || {};

  var forEach = Array.prototype.forEach;

  // Pre-filter
  var removables = doc.body.querySelectorAll('nav, header, footer')
  forEach.call(removables, function (n) {
    n.remove();
  });

  // Initialize features map
  var features = new Map();
  features.set(doc.documentElement, {
    score: -Infinity, charCount: 0, anchorCharCount: 0
  });
  features.set(doc.body, {
    score: -Infinity, charCount: 0, anchorCharCount: 0
  });
  var elements = doc.body.getElementsByTagName('*');
  forEach.call(elements, function initFeatures(element) {
    features.set(element, {
      score: 0, charCount: 0, anchorCharCount: 0, previousSiblingCount: 0
    });
  });

  // Derive text features from the bottom up
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var element, node, elementFeatures, parent, parentFeatures;
  while(node = it.nextNode()) {
    element = node.parentElement;
    elementFeatures = features.get(element);
    elementFeatures.charCount += node.nodeValue.length;
    features.set(element, elementFeatures);
    if(!elementFeatures.charCount) {
      continue;
    }
    parent = element.parentElement;
    while(parent) {
      parentFeatures = features.get(parent);
      parentFeatures.charCount += elementFeatures.charCount;
      features.set(parent, parentFeatures);
      parent = parent.parentElement;
    }
  }

  // Derive non-nominal anchor features from the bottom up
  var anchors = doc.body.querySelectorAll('a[href]');
  forEach.call(anchors, function deriveAnchorFeatures(anchor) {
    var anchorFeatures = features.get(anchor);
    var cc = anchorFeatures.charCount;
    if(!cc) {
      return;
    }
    anchorFeatures.anchorCharCount = cc;
    features.set(anchor, anchorFeatures);
    var parentFeatures, parent = anchor.parentElement;
    while(parent) {
      parentFeatures = features.get(parent);
      parentFeatures.anchorCharCount += cc;
      features.set(parent, parentFeatures);
      parent = parent.parentElement;
    }
  });

  // Apply intrinsic bias (based on the type of element itself)
  forEach.call(elements, function applyIntrinsicBias(element) {
    var bias = INTRINSIC_BIAS.get(element.localName);
    if(!bias) {
      return;
    }
    var elementFeatures = features.get(element);
    elementFeatures.score += bias;
    features.set(element, elementFeatures);
  });

  // Penalize descendants of list elements
  var listDescendants = doc.body.querySelectorAll('li *,ol *,ul *');
  forEach.call(listDescendants, function biasLists(element) {
    var elementFeatures = features.get(element);
    elementFeatures.score -= 20;
    features.set(element, elementFeatures);
  });

  // Penalize descendants of navigational elements
  // NOTE: due to pre-filtering this is largely a no-op, but
  // pre-filtering may be disabled in the future
  var navDescendants = doc.body.querySelectorAll(
    'aside *, header *, footer *, nav *');
  forEach.call(navDescendants, function biasNavs(element) {
    var elementFeatures = features.get(element);
    elementFeatures.score -= 50;
    features.set(element, elementFeatures);
  });

  // Score images and image parents
  var reduce = Array.prototype.reduce;
  var images = doc.body.getElementsByTagName('img');
  forEach.call(images, function scoreImage(image) {
    var imageFeatures = features.get(image);
    var parent = image.parentElement;
    var parentFeatures = features.get(parent);
    // Penalize carousels
    parentFeatures.score += reduce.call(parent.childNodes,
      function calculateImageSiblingPenalty(bias, node) {
      return 'img' === node.localName && node !== image ? bias - 5 : bias;
    }, 0);
    // Reward auxillary descriptions
    var alt = image.getAttribute('alt');
    var title = image.getAttribute('title');
    var caption = parent.localName == 'figure' &&
      parent.querySelector('figcaption');
    var supportingTextBias = alt || title || caption ? 30 : 0;
    imageFeatures.score += supportingTextBias;
    parentFeatures.score +=  supportingTextBias;
    // Reward large images
    var area = image.width ? image.width * image.height : 0;
    var areaBias = 0.0015 * Math.min(100000, area);
    imageFeatures.score += areaBias;
    parentFeatures.score += areaBias;
    features.set(image, imageFeatures);
    features.set(parent, parentFeatures);
  });

  // Bias elements based on attribute content
  var RE_TOKEN_SPLIT = /[\s-_]+/g;
  var attributeNames = ['id', 'class', 'itemprop', 'name', 'role'];
  forEach.call(elements, function biasAttributes(element) {
    var text = attributeNames.map(function getValue(name) {
      return element.getAttribute(name);
    }).join(' ').toLowerCase();
    if(!text) return;
    var tokens = text.split(RE_TOKEN_SPLIT).filter(function (value) {
      return value;
    });
    if(!tokens.length) return;
    var bias = 0;
    (new Set(tokens)).forEach(function sumBias(token) {
      bias += ATTRIBUTE_BIAS.get(token) || 0;
    });
    if(!bias) return;
    var elementFeatures = features.get(element);
    elementFeatures.score += bias;
    features.set(element, elementFeatures);
  });

  // Bias the parents of ccertain elements
  forEach.call(elements, function biasParent(element) {
    var bias = DESCENDANT_BIAS.get(element.localName);
    if(!bias) return;
    var parent = element.parentElement;
    var parentFeatures = features.get(parent);
    parentFeatures.score += bias;
    features.set(parent, parentFeatures);
  });

  forEach.call(elements, scoreElement.bind(this, features));

  // Expose attributes for debugging
  var docElements = doc.documentElement.getElementsByTagName('*');
  forEach.call(docElements, function expose(element) {
    var meta = features.get(element);
    if(options.SHOW_CHAR_COUNT && meta.charCount)
      element.setAttribute('charCount', meta.charCount);
    if(options.SHOW_SCORE && meta.score)
      element.setAttribute('score', meta.score);
  });

  // Find and return the highest scoring element, defaulting to
  // the body element
  return reduce.call(elements, function (previous, current) {
    return features.get(current).score > features.get(previous).score ?
      current : previous;
  }, doc.body);
}

// Public API
exports.calamine = {
  transform: transformDocument
};

}(this));
