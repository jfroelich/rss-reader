// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * The calamine module provides functions for removing boilerplate content
 * In other words, applying lotion to soothe NLP shingles.
 *
 * TODO: specifically target 'share' subsection better
 * TODO: specifically target 'comments' subsection better
 * TODO: look more into shadow dom manipulation? or is that
 * the role of sanitize?
 * TODO: support 'picture' element
 */
(function calamineWrapper(exports) {
'use strict';

var RE_COPYRIGHT = /&(copy|#169|#xA9);/i;
var RE_WHITESPACE = /\s/g;
var RE_TOKEN_SPLIT = /[\s-_]+/g;

var TYPE_BIAS = new Map([
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
TODO: now that we do direct hashed lookup instead of a contains
search these need to be refactored to specific words
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


var IMAGE_DTREE = [
  {lower: 100000, bias: 100},
  {lower: 50000, bias: 150},
  {lower: 10000, bias: 150},
  {lower: 3000, bias: 30},
  {lower: 500, bias: 10},
  {lower: 0, bias: -10},
];

/**
 * NOTE: expects defined dimensions
 * TODO: is there some nicer way of updating the parentElement? I am not
 * entirely happy that we secretly update other elements here
 */
function applyImageScore(featuresMap, features, image) {
  var imageParent = image.parentElement;
  var parentFeatures = featuresMap.get(imageParent);

  // Award those images with alt or title text as being more
  // likely to be content. Boilerplate images are less likely to
  // have supporting text.
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
    parentFeatures.score +=  10;
  }

  // TODO: maybe break this out into its own function
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

  var area = 0;
  // TODO: use offsetWidth and offsetHeight instead?
  if(image.width && image.height) {
    area = image.width * image.height;
    // clamp to 800x600
    // TODO: do we even care about the upper bound?
    if(area > 360000) {
      area = 360000;
    }
  }

  if(!area) {
    features.imageBranch = 1;
    features.score += 100;
    parentFeatures.score += 100;
  } else {
    for(var i = 0; i < IMAGE_DTREE.length;i++) {
      if(area > IMAGE_DTREE[i].lower) {
        features.imageBranch = i + 2;
        features.score += IMAGE_DTREE[i].bias;
        parentFeatures.score += IMAGE_DTREE[i].bias;
        break;
      }
    }
  }

  // features is updated in the map in scoreElement
  // but the parentElement is not so do it here
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

  // Always set a  value here
  features.previousSiblingCount = 0;

  // If there are no siblings, then score is not affected
  if(!siblingCount) {
    return;
  }

  var previous = element.previousElementSibling;
  if(previous) {
    features.previousSiblingCount = featuresMap.get(previous).previousSiblingCount + 1;
  }

  // Distance from start
  var startRatio = features.previousSiblingCount / siblingCount;
  var startBias = 5 - 5 * startRatio;

  // Distance from middle
  var halfCount = siblingCount / 2;
  var middleOffset = Math.abs(features.previousSiblingCount - halfCount);
  var middleBias = 5 - 5 * middleOffset / halfCount;

  features.score += startBias + middleBias;
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

  if(features.hasCopyrightSymbol) {
    features.score -= 40;
  }
  features.score += -20 * (features.bulletCount || 0);
  features.score += -10 * (features.pipeCount || 0);

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
 * Returns the frequency of ch in str.
 * See http://jsperf.com/count-the-number-of-characters-in-a-string
 */
function countChar(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }
  return count;
}

/**
 * Extract anchor features. Based on charCount from text features
 */
function deriveAnchorFeatures(featuresMap, anchor) {
  var features = featuresMap.get(anchor);
  var cc = features.charCount;
  if(!cc || !anchor.hasAttribute('href')) {
    return;
  }
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
  if(!features.hasCopyrightSymbol) {
    features.hasCopyrightSymbol = RE_COPYRIGHT.test(value);
  }
  features.bulletCount += countChar(value,'\u2022');
  features.pipeCount += countChar(value, '|');

  // TODO: does whitespace even matter that much?
  //features.charCount += value.length - value.split(RE_WHITESPACE).length + 1;
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
  var previousFeatures = featuresMap.get(previous);
  var currentFeatures = featuresMap.get(current);

  if(currentFeatures.score > previousFeatures.score) {
    return current;
  }

  return previous;
}

function removeTargetedSections(doc) {
  // NOTES: this function is more a temporary measure to deal with
  // unwanted subsections. Since we are selecting best elements and
  // not filtering blocks this helps reduce boilerplate.
  // Just ugly-as-hell brute-force empirical filtering
  var targetedIds = ['a-font','a-share-h','a-all-related','addshare',
    'social-top', 'social-bottom', 'disqus_thread', 'storyControls',
    'a-comments','relartstory','cnn_sharebar1','comments-container',
    'disqus-wrapper','story-font-size'];
  targetedIds.forEach(function(id) {
    var element = doc.getElementById(id);
    if(element) {
      element.remove();
    }
  });

  var repeatedIds = ['toolbar-sharing'];
  repeatedIds.forEach(function(id) {
    var element = doc.getElementById(id);
    while(element) {
      element.remove();
      element = doc.getElementById(id);
    }
  });

  var targetedClasses = ['a-share', 'advert-txt', 'comment-count-block',
    'dsq-postid','shareTree', 'sharetools-story', 'addthis_toolbox',
    'social-bookmarking-module', 'pin-it-button','cnn_strybtntools',
    'c_sharebar_cntr','toplinks','sitetitle','share-help',
    'social-links','social-count','marginalia','util-bar-flyout-share',
    'utility-bar-wrap','social-tools','social-buttons',
    'share-tools-wrapper','blox-social-tools-horizontal'];
  var each = Array.prototype.forEach;
  targetedClasses.forEach(function(className) {
    var elements = doc.body.getElementsByClassName(className);
    each.call(elements, function(element) {
      if(element) {
        element.remove();
      }
    });
  });
}

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 */
function scoreElement(featuresMap, element) {
  var features = featuresMap.get(element);

  // Apply a bias based on the text of the element
  applyTextScore(features, element);

  // Apply a bias for images
  if(element.localName == 'img') {
    applyImageScore(featuresMap, features, element);
  }

  // Apply a bias based on the location of the element
  applyPositionScore(featuresMap, features, element);

  // Apply a bias based on the type of the element
  features.score += TYPE_BIAS.get(element.localName) || 0;

  // Apply a bias based on the text of some of the attributes
  var attributeText = [
    element.getAttribute('id') || '',
    element.getAttribute('name') || '',
    element.getAttribute('class') || ''
  ].join('').trim().toLowerCase();

  var attributeText = ((element.id || '') + ' ' + (element.className || ''));
  attributeText = attributeText.trim().toLowerCase();
  var attributeTokens = attributeText.split(RE_TOKEN_SPLIT);
  for(var i = 0, len = attributeTokens.length; i < len; i++) {
    features.score += ATTRIBUTE_BIAS.get(attributeTokens[i]) || 0;
  }

  // Contiguity bias - apply a bias based on the preceding element's score
  if(element.previousElementSibling) {
    var prevScore = featuresMap.get(element.previousElementSibling).score;
    features.score += prevScore > 0 ? 5 : -5;
  }

  // Update the features of this element in the map
  featuresMap.set(element, features);

  // Propagate a small bias to descendant elements
  var ancestorBias = ANCESTOR_BIAS.get(element.localName);
  if(ancestorBias) {
    for(var i = 0, descs = element.getElementsByTagName('*'),
      len = descs.length; i < len; i++) {
      updateScore(featuresMap, descs[i], ancestorBias);
    }
  }

  // Propagate a small bias to the parent element
  var descendantBias = DESCENDANT_BIAS.get(element.localName);
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

  features.set(doc.documentElement, {
    score: -Infinity,
    charCount: 0,
    anchorCharCount: 0
  });

  features.set(doc.body, {
    score: -Infinity,
    charCount: 0,
    anchorCharCount: 0
  });

  removeTargetedSections(doc);


  var elements = doc.body.getElementsByTagName('*');
  var each = Array.prototype.forEach;
  each.call(elements, function initFeatureMap(e) {
    features.set(e, {
      score: 0,
      hasCopyrightSymbol: false,
      pipeCount: 0,
      bulletCount: 0,
      charCount: 0,
      anchorCharCount: 0,
      previousSiblingCount: 0
    });
  });

  var textIterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  var textNode = null;
  while(textNode = textIterator.nextNode()) {
    deriveTextFeatures(features, textNode);
  }

  var anchors = doc.body.getElementsByTagName('a');
  each.call(anchors, deriveAnchorFeatures.bind(this, features));
  each.call(elements, scoreElement.bind(this, features));

  // TODO: using reduce over the elements collection involves map
  // lookups for all the elements per call. Because all elements are
  // in the map, it would be better to just iterate the map's entries
  // and find the max that way. Then we could maybe deprecate the
  // reduce and getMaxScore methods
  var maxScore = getMaxScore.bind(this, features);
  var reduce = Array.prototype.reduce;
  var bestElement = reduce.call(elements, maxScore, doc.body);

  exposeAttributes(bestElement, features, options);
  return bestElement;
}

function exposeAttributes(bestElement, featuresMap, options) {

  var props = [
    {key: 'SHOW_CHAR_COUNT', value: 'charCount'},
    {key: 'SHOW_HAS_COPYRIGHT', value: 'hasCopyrightSymbol'},
    {key: 'SHOW_BULLET_COUNT', value: 'bulletCount'},
    {key: 'SHOW_IMAGE_BRANCH', value: 'imageBranch'},
    {key: 'SHOW_PIPE_COUNT', value: 'pipeCount'},
    {key: 'SHOW_SCORE', value: 'score'},
  ];

  // Exposing attributes for debugging
  var descendants = bestElement.getElementsByTagName('*');
  var each = Array.prototype.forEach;

  for(var i = 0, key, value, features; i < props.length;i++) {
    key = props[i].key;
    if(!options[key])
      continue;
    value = props[i].value;
    // TODO: this is probably a bug
    each.call(descendants, function(e) {
      features = featuresMap.get(e);
      if(features[value]) {
        e.setAttribute(value, features[value]);
      }
    });
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
