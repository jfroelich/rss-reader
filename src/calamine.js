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
(function (exports) {
'use strict';

var forEach = Array.prototype.forEach;
var reduce = Array.prototype.reduce;


var INTRINSIC_BIAS = new Map([
  ['article',100],
  ['main',100],
  ['blockquote',10],
  ['code', 10],
  ['div', 10],
  ['figcaption', 10],
  ['figure', 10],
  ['ilayer', 10],
  ['layer', 10],
  ['p', 10],
  ['pre', 10],
  ['ruby', 10],
  ['section', 10],
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
  ['header', -20],
  ['li', -20],
  ['ol', -20],
  ['ul', -20],
  ['aside', -100],
  ['footer', -100],
  ['nav', -100]
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

/*
TODO: if we refactor to use selectors we could revert to using
contains efficiently using *= css wildcard. However, we would have
to lose custom scores and instead use about 3 to 6 selectors each
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

var BLACKLIST = [
  'aside',
  '[id*="_ad_"]',
  '[id*="-ad"]',
  '[id*="-buttons-"]',
  '[id*="comment"]',
  '[id*="correction"]',
  '[id*="disqus"]',
  '[id*="dsq"]',
  '[id*="-font"]',
  '[id*="gigya"]',
  '[id*="most-read"]',
  '[id*="most-watched"]',
  '[id*="ndntabs"]',
  '[id*="promotion"]',
  '[id*="-related"]',
  '[id*="share"]',
  '[id*="signup"]',
  '[id*="social"]',
  '[id*="top_stories"]',
  '[class*="-actions"]',
  '[class*="-ad"]',
  '[class*="AdBox"]',
  '[class*="adjacent"]',
  '[class*="also-on"]',
  '[class*="adv"]',
  '[class*="addthis"]',
  '[class*="banner-"]',
  '[class*="best-of"]',
  '[class*="comment"]',
  '[class*="-control"]',
  '[class*="dsq"]',
  '[class*="fan"]',
  '[class*="gallery"]',
  '[class*="googleAds"]',
  '[class*="-issues-"]',
  '[class*="links"]',
  '[class*="fyre"]',
  '[class*="-meta"]',
  '[class*="more-like"]',
  '[class*="most-recent"]',
  '[class*="-nav"]',
  '[class*="pin-it"]',
  '[class*="-print-"]',
  '[class*="promotion"]',
  '[class*="relate"]',
  '[class*="resize"]',
  '[class*="share"]',
  '[class*="sharing"]',
  '[class*="skyscraper"]',
  '[class*="social"]',
  '[class*="sociab"]',
  '[class*="-subscribe"]',
  '[class*="taboola"]',
  '[class*="-tags"]',
  '[class*="thumb"]',
  '[class*="recommended"]',
  '[class*="tool"]',
  '[class*="viral"]',
  '[name*="adblade"]',
  '#storyControls',
  '#relartstory',
  '.comment-viz',
  '.fblike',
  '.fb-root',
  '.articleTools',
  '.footer',
  '.jump',
  '.marginalia',
  '.media-message',
  '#respond',
  '.servicesList',
  '.sitetitle',
  '.tags-box',
  '.text-size',
  '.textSize',
  '.ticker',
  '.toolbox',
  '.utilsFloat',
  '.utility-bar-wrap'
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
 * Updates the element's score based on its index within
 * its parent. The closer to the start (the smaller the index),
 * the higher the score. The closer the middle (the mid index),
 * the higher the score.
 */
function applyPositionScore(featuresMap, features, element) {
  var siblingCount = element.parentElement.childElementCount - 1;
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

function applySelectorBias(doc, features, selector, bias) {
  var elements = doc.body.querySelectorAll(selector);
  for(var i = 0, f, element, len = elements.length; i < len; i++) {
    element = elements[i];
    f = features.get(element);
    f.score += bias;
    features.set(element, f);
  }
}

function asAttributeSelector(str) {
  return '[id*="'+str+'"],[class*="'+str+'"]';
}

/**
 * Initializes the features map for all elements
 */
function createFeatures(doc, elements) {
  var features = new Map();
  forEach.call(elements, function initBasicFeatures(e) {
    features.set(e, {
      score: 0, charCount: 0, anchorCharCount: 0, previousSiblingCount: 0
    });
  });
  features.set(doc.documentElement,
    {score: -Infinity, charCount: 0, anchorCharCount: 0});
  features.set(doc.body,
    {score: -Infinity, charCount: 0, anchorCharCount: 0});
  return features;
}

/**
 * Extract anchor features. Based on text features
 */
function deriveAnchorFeatures(featuresMap, anchor) {
  var features = featuresMap.get(anchor);
  var cc = features.charCount;

  if(!cc)
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

function deriveTextFeatures(doc, featuresMap) {
  var it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var element, node, features, parent, pFeatures;
  while(node = it.nextNode()) {
    element = node.parentElement;
    features = featuresMap.get(element);
    features.charCount += node.nodeValue.length;
    featuresMap.set(element, features);
    if(features.charCount) {
      parent = element;
      while(parent = parent.parentElement) {
        pFeatures = featuresMap.get(parent);
        pFeatures.charCount += features.charCount;
        featuresMap.set(parent, pFeatures);
      }
    }
  }
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

function remove(n) {
  n.remove();
}


function applyIntrinsicBias(name, features) {
  var bias = INTRINSIC_BIAS.get(name) || 0;
  features.score += bias;
}

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 */
function scoreElement(featuresMap, element) {
  var features = featuresMap.get(element);
  var localName = element.localName;

  // Score elements based on the element itself
  features.score += INTRINSIC_BIAS.get(localName) || 0;

  // TODO: make score a function of cc and density instead
  // of searching classes
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

  applyPositionScore(featuresMap, features, element);

  // TODO: use selectors instead?
  var attrTokens = [
    element.getAttribute('class') || '',
    element.getAttribute('id') || '',
    element.getAttribute('itemprop') || '',
    element.getAttribute('name') || '',
    element.getAttribute('role') || ''
  ].join(' ').trim().toLowerCase().split(RE_TOKEN_SPLIT);
  var numTokens = attrTokens.length;
  for(var i = 0; i < numTokens; i++) {
    features.score += ATTRIBUTE_BIAS.get(attrTokens[i]) || 0;
  }

  if(element.previousElementSibling) {
    // Contiguity bias
    var prevScore = featuresMap.get(element.previousElementSibling).score;
    features.score += 20 * (prevScore > 0 ? 1 : -1);
  }

  featuresMap.set(element, features);

  // TODO: move this into transformDocument iteration over
  // elements NodeList
  var descendantBias = DESCENDANT_BIAS.get(localName);
  if(descendantBias) {
    var pFeatures = featuresMap.get(element.parentElement);
    pFeatures.score += descendantBias;
    featuresMap.set(element.parentElement, pFeatures);
  }
}

/**
 * TODO: is there some nicer way of updating the parentElement? I am not
 * entirely happy that we secretly update other elements here
 */
function scoreImage(featuresMap, image) {

  var features = featuresMap.get(image);
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
        parentFeatures.score += 30;
      }
    }
  }

  // imageBranch is for debugging

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

  featuresMap.set(image, features);
  featuresMap.set(imageParent, parentFeatures);
}

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
function transformDocument(doc, options) {
  options = options || {};

  // Pre filtering. Certain elements or elements with certain attribute
  // values are expressly ignored.
  forEach.call(doc.body.querySelectorAll(BLACKLIST), remove);

  // Feature extraction in preparation for later analysis
  var elements = doc.body.getElementsByTagName('*');
  var features = createFeatures(doc, elements);
  deriveTextFeatures(doc, features);
  forEach.call(doc.body.querySelectorAll('a[href]'),
    deriveAnchorFeatures.bind(this, features));

  // TODO: improve perf
  // Descendant bias. Text is more or less likely to be boilerplate if
  // these elements are present in a text node's path (from root)
  applySelectorBias(doc, features, 'p *', 10);
  applySelectorBias(doc, features, 'ol *, ul *', -5);
  applySelectorBias(doc, features, 'header *,footer *,nav *', -50);

  // Scoring of images. Based of image size, alt/title text, and
  // associated caption text. Also affects the score of each
  // image's parent
  var images = doc.body.getElementsByTagName('img');
  forEach.call(images, scoreImage.bind(this, features));

  // Other biases, such as position, number of characters, and ratio
  // of anchor-text characters to non-anchor-text characters.
  forEach.call(elements, scoreElement.bind(this, features));

  // Find the best element
  var result = reduce.call(elements,
    getMaxScore.bind(this, features), doc.body);

  // Optionally expose some debugging information into the DOM
  exposeAttributes(result, features, options);

  return result;
}

// Public API
exports.calamine = {
  transformDocument: transformDocument
};

}(this));
