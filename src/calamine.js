// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * The calamine module provides functions for removing boilerplate content
 * In other words, applying lotion to soothe NLP shingles.
 *
 * TODO: look more into shadow dom manipulation? or is that
 * the role of sanitize?
 * TODO: support 'picture' element
 */
(function calamineWrapper(exports) {
'use strict';

var INTRINSIC_BIAS = new Map([
  ['a', -1],
  ['address', -3],
  ['article', 100],
  ['aside', -200],
  ['blockquote', 5],
  ['canvas', 3],
  ['dir', -20],
  ['dd', -3],
  ['div', 20],
  ['dl', -10],
  ['dt', -3],
  ['figcaption', 10],
  ['figure', 10],
  ['footer', -100],
  ['form', -50],
  ['header', -20],
  ['h1', -2],
  ['h2', -2],
  ['h3', -2],
  ['h4', -2],
  ['h5', -2],
  ['h6', -2],
  ['li', -20],
  ['main', 100],
  ['nav', -50],
  ['ol', -20],
  ['p', 10],
  ['pre', 5],
  ['ruby', 5],
  ['section', 10],
  ['small', -1],
  ['summary', 5],
  ['td', 3],
  ['th', -3],
  ['time', 2],
  ['tr', 1],
  ['ul', -20]
]);

var DESCENDANT_BIAS = new Map([
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
  ['p', 5],
  ['pre', 2],
  ['span', 1],
  ['strong', 1],
  ['sub', 2],
  ['summary', 1],
  ['sup', 2],
  ['time', 2]
]);

var ANCESTOR_BIAS = new Map([
  ['blockquote', 10],
  ['code', 10],
  ['dir', -5],
  ['div', 1],
  ['dl', -5],
  ['header', -5],
  ['i', 1],
  ['li', -3],
  ['nav', -20],
  ['ol', -5],
  ['p', 10],
  ['pre', 10],
  ['ruby', 5],
  ['summary', 2],
  ['table', -2],
  ['ul', -5]
]);

/*
TODO: if we refactor to use selectors we could revert to using
contains efficiently using *= css wildcard. However, we would have
to lose custom scores and isntead use about 3 to 6 selectors each
with its own score, e.g. BEST +200, GOOD +100, BAD -100, WORST -200,
where BEST is something like [id*=article][class*=article].
*/
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
  ['block', 10],
  ['blog', 20],
  ['body', 50],
  ['bookmarking', -100],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['cmt', -100],
  ['column', 10],
  ['combx', -20],
  ['comic', 75],
  ['comment', -300],
  ['comments', -300],
  ['community', -100],
  ['component', -50],
  ['contact', -50],
  ['content', 50],
  ['contenttools', -50],
  ['date', -50],
  ['dcsimg', -100],
  ['dropdown', -100],
  ['entry', 50],
  ['excerpt', 20],
  ['facebook', -100],
  ['fn',-30],
  ['foot', -100],
  ['footnote', -150],
  ['google', -50],
  ['head', -50],
  ['heading', -50],
  ['hentry',150],
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
  ['post', 50],
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
  ['tags', -100],
  ['text', 20],
  ['time', -30],
  ['timestamp', -50],
  ['title', -100],
  ['tool', -200],
  ['twitter', -200],
  ['txt', 50],
  ['utility', -50],
  ['vcard', -50],
  ['week', -100],
  ['welcome', -50],
  ['widg', -200],
  ['zone', -50]
]);

var AXIS_BLACKLIST = [
  '[id*="_ad_"]',
  '[id*="comment"]',
  '[id*="-ad"]',
  '[id*="disqus"]',
  '[id*="share"]',
  '[id*="social"]',
  '[class*="-actions"]',
  '[class*="-ad"]',
  '[class*="adv"]',
  '[class*="addthis"]',
  '[class*="comment"]',
  '[class*="-control"]',
  '[class*="dsq"]',
  '[class*="gallery"]',
  '[class*="googleAds"]',
  '[class*="links"]',
  '[class*="-nav"]',
  '[class*="share"]',
  '[class*="sharing"]',
  '[class*="social"]',
  '[class*="taboola"]',
  '[class*="thumb"]',
  '[class*="tool"]',
  '#a-font',
  '#a-all-related',
  '#mobiles-buttons-wrapper',
  '#dsq-2',
  '#storyControls',
  '#relartstory',
  '#story-font-size',
  '.articleEmbeddedAdBox',
  '.article-print-url',
  '.banner-area',
  '.entry-meta',
  '.fblike',
  '.footer',
  '.jump',
  '.marginalia',
  '.media-message',
  '.pin-it-button',
  '.relatedSidebar',
  '.resizer',
  '.resize-nav',
  '.servicesList',
  '.sitetitle',
  '.tags-box',
  '.text-size',
  '.thirdPartyRecommendedContent',
  '.ticker',
  '.toolbox',
  '.toplinks',
  '.utilsFloat',
  '.utility-bar-wrap',
  '.viral-grid'
].join(',');

var IMAGE_DTREE = [
  {lower: 100000, bias: 100},
  {lower: 50000, bias: 150},
  {lower: 10000, bias: 150},
  {lower: 3000, bias: 30},
  {lower: 500, bias: 10},
  {lower: 0, bias: -10},
];

/**
 * TODO: is there some nicer way of updating the parentElement? I am not
 * entirely happy that we secretly update other elements here
 */
function applyImageScore(featuresMap, features, image) {
  var imageParent = image.parentElement;
  var parentFeatures = featuresMap.get(imageParent);

  // Boilerplate images are less likely to have supporting text.
  // TODO: rather than an arbitrary amount, use keyword bias and also
  // consider a length based bias. If length based used the greater length
  // of either alt or title, do not just consider alt length, which this
  // branch precludes atm.
  var description = (image.getAttribute('alt') || '').trim();
  if(!description) {
    description = (image.getAttribute('title') || '').trim();
  }

  if(description) {
    features.score += 30;
    parentFeatures.score +=  30;
  }

  if(imageParent.localName == 'figure') {
    var figCaptionNodeList = imageParent.getElementsByTagName('figcaption');
    if(figCaptionNodeList && figCaptionNodeList.length) {
      var firstFigCaption = figCaptionNodeList[0];
      var firstFigCaptionText = (firstFigCaption.textContent || '').trim();
      if(firstFigCaptionText.length) {
        features.score += 30;
        parentFeatures.score += 10;
      }
    }
  }

  if(!image.height || !image.width) {
    features.imageBranch = 1;
    features.score += 100;
    parentFeatures.score += 100;
  } else {
    // TODO: make bias a simple function of area, instead of searching bins
    for(var i = 0, area = image.height * image.width; i < IMAGE_DTREE.length;i++) {
      if(area > IMAGE_DTREE[i].lower) {
        features.imageBranch = i + 2;
        features.score += IMAGE_DTREE[i].bias;
        parentFeatures.score += IMAGE_DTREE[i].bias;
        break;
      }
    }
  }

  featuresMap.set(imageParent, parentFeatures);
}

/**
 * Updates the element's score based on its index within
 * its parent. The closer to the start (the smaller the index),
 * the higher the score. The closer the middle (the mid index),
 * the higher the score.
 */
function applyPositionScore(featuresMap, features, element) {
  var siblingCount = element.parentElement.childElementCount - 1;
  features.previousSiblingCount = 0;
  if(!siblingCount)
    return;
  var previous = element.previousElementSibling;
  if(previous)
    features.previousSiblingCount = featuresMap.get(previous).previousSiblingCount + 1;
  var startRatio = features.previousSiblingCount / siblingCount;
  features.score += 5 - 5 * startRatio;
  var halfCount = siblingCount / 2;
  var middleOffset = Math.abs(features.previousSiblingCount - halfCount);
  features.score += 5 - 5 * middleOffset / halfCount;
}

/**
 * Updates the element's score based on the content
 * of its text nodes.
 */
function applyTextScore(features, element) {
  var cc = features.charCount;
  if(!cc) {
    return;
  }

  // TODO: make score a function of cc and density instead
  // of searching classes

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

/**
 * Extract anchor features. Based on text features
 */
function deriveAnchorFeatures(featuresMap, anchor) {
  var features = featuresMap.get(anchor);
  var cc = features.charCount;
  if(!cc || !anchor.hasAttribute('href'))
    return;
  features.anchorCharCount = cc;
  featuresMap.set(anchor, features);
  var parent = anchor, parentFeatures;
  while(parent = parent.parentElement) {
    parentFeatures = featuresMap.get(parent);
    parentFeatures.anchorCharCount += cc;
    featuresMap.set(parent, parentFeatures);
  }
}

function deriveTextFeatures(featuresMap, node) {
  var element = node.parentElement;
  var features = featuresMap.get(element);
  var value = node.nodeValue;
  features.charCount += value.length;
  featuresMap.set(element, features);
  if(features.charCount) {
    var parent = element, parentFeatures;
    while(parent = parent.parentElement) {
      parentFeatures = featuresMap.get(parent);
      parentFeatures.charCount += features.charCount;
      featuresMap.set(parent, parentFeatures);
    }
  }
}

/**
 * Compares the scores of two elements and returns the element with the higher
 * score. If equal the previous element is returned.
 * TODO: this needs a better name. what is it doing?
 */
function getMaxScore(featuresMap, previous, current) {
  return featuresMap.get(current).score > featuresMap.get(previous).score ?
    current : previous;
}

var RE_TOKEN_SPLIT = /[\s-_]+/g;

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 */
function scoreElement(featuresMap, element) {
  var features = featuresMap.get(element);
  var localName = element.localName;
  applyTextScore(features, element);
  if(localName == 'img') {
    applyImageScore(featuresMap, features, element);
  }
  applyPositionScore(featuresMap, features, element);
  features.score += INTRINSIC_BIAS.get(localName) || 0;
  // TODO: use selectors instead
  var attrTokens = [
    element.getAttribute('class') || '',
    element.getAttribute('id') || '',
    element.getAttribute('itemprop') || '',
    element.getAttribute('name') || '',
    element.getAttribute('role') || ''
  ].join(' ').trim().toLowerCase().split(RE_TOKEN_SPLIT);
  for(var i = 0, len = attrTokens.length; i < len; i++) {
    features.score += ATTRIBUTE_BIAS.get(attrTokens[i]) || 0;
  }
  if(element.previousElementSibling) {
    var prevScore = featuresMap.get(element.previousElementSibling).score;
    features.score += 20 * (prevScore > 0 ? 1 : -1);
  }
  featuresMap.set(element, features);
  var ancestorBias = ANCESTOR_BIAS.get(localName);
  if(ancestorBias) {
    for(var i = 0, descs = element.getElementsByTagName('*'),
      len = descs.length; i < len; i++) {
      updateScore(featuresMap, descs[i], ancestorBias);
    }
  }
  var descendantBias = DESCENDANT_BIAS.get(localName);
  if(descendantBias) {
    updateScore(featuresMap, element.parentElement, descendantBias);
  }
}

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
function transformDocument(doc, options) {
  options = options || {};
  var features = new WeakMap();
  var each = Array.prototype.forEach;
  var blacklisted = doc.body.querySelectorAll(AXIS_BLACKLIST);
  each.call(blacklisted, function (e) { e.remove(); });
  var elements = doc.body.getElementsByTagName('*');
  each.call(elements, function initFeatureMap(e) { features.set(e, {
    score: 0, charCount: 0, anchorCharCount: 0, previousSiblingCount: 0
  });});
  features.set(doc.documentElement, {
    score: -Infinity, charCount: 0, anchorCharCount: 0
  });
  features.set(doc.body, {
    score: -Infinity, charCount: 0, anchorCharCount: 0
  });
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var node = null;
  while(node = it.nextNode()) {
    deriveTextFeatures(features, node);
  }
  var anchors = doc.body.getElementsByTagName('a');
  each.call(anchors, deriveAnchorFeatures.bind(this, features));
  each.call(elements, scoreElement.bind(this, features));
  var max = getMaxScore.bind(this, features);
  var bestElement = Array.prototype.reduce.call(elements, max, doc.body);
  exposeAttributes(bestElement, features, options);
  return bestElement;
}

var EXPOSE_PROPS = [
  {key: 'SHOW_CHAR_COUNT', value: 'charCount'},
  {key: 'SHOW_HAS_COPYRIGHT', value: 'hasCopyrightSymbol'},
  {key: 'SHOW_BULLET_COUNT', value: 'bulletCount'},
  {key: 'SHOW_IMAGE_BRANCH', value: 'imageBranch'},
  {key: 'SHOW_PIPE_COUNT', value: 'pipeCount'},
  {key: 'SHOW_SCORE', value: 'score'},
];

// Exposing attributes for debugging
function exposeAttributes(bestElement, featuresMap, options) {
  var descendants = bestElement.getElementsByTagName('*');
  var each = Array.prototype.forEach;
  for(var i = 0, value, features, e; i < EXPOSE_PROPS.length;i++) {
    if(options[EXPOSE_PROPS[i].key]) {
      value = EXPOSE_PROPS[i].value;
      for(var j = 0, len = descendants.length; j < len;j++) {
        e = descendants[j];
        features = featuresMap.get(e);
        if(features[value]) {
          e.setAttribute(value, features[value]);
        }
      }
    }
  }
}

function updateScore(featuresMap, element, amount) {
  var features = featuresMap.get(element);
  features.score += amount;
  featuresMap.set(element, features);
}

// Public API
exports.calamine = {
  transformDocument: transformDocument
};

}(this));
