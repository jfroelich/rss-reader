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

var ATTRIBUTE_BIAS = new Map([
  ['about', -35],
  ['ad', -100],
  ['ads', -50],
  ['advert', -100],
  ['article', 100],
  ['articleheadings', -50],
  ['attachment', 20],
  ['author', 20],
  ['blog', 20],
  ['body', 50],
  ['brand', -50],
  ['breadcrumbs', -20],
  ['button', -100],
  ['byline', 20],
  ['caption', 10],
  ['carousel', 30],
  ['column', 10],
  ['combx', -20],
  ['comic', 75],
  ['comment', -300],
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
  ['social', -200],
  ['socialnetworking', -250],
  ['source',-50],
  ['sponsor', -200],
  ['story', 50],
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
  if(imageParent.matches('figure')) {
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

  var area = getImageArea(image);
  if(!isFinite(area)) {
    features.imageBranch = 1;
    features.score += 100;
    parentFeatures.score += 100;
  } else if(area > 100000) {
    features.imageBranch = 2;
    features.score += 150;
    parentFeatures.score += 150;
  } else if(area > 50000) {
    features.imageBranch = 3;
    features.score += 150;
    parentFeatures.score += 150;
  } else if(area > 10000) {
    features.imageBranch = 4;
    features.score += 70;
    parentFeatures.score += 70;
  } else if(area > 3000) {
    features.imageBranch = 5;
    features.score += 30;
    parentFeatures.score += 30;
  } else if(area > 500) {
    features.imageBranch = 6;
    features.score += 10;
    parentFeatures.score += 10;
  } else {
    features.imageBranch = 7;
    features.score -= 10;
    parentFeatures.score -= 10;
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
function applyPositionScore(features, element) {
  // If there are no siblings, then score is not affected
  // TODO: is this right? This is no longer based on actual
  // distance from start but sibling count. But should it be?
  // If there are no siblings then it could still be near
  // start or mid. So this heuristic is messed up. If we were
  // dealing with an actual array of blocks it would make more sense
  // to look at block index. But this is within the hierarchy.
  if(!features.siblingCount) {
    return;
  }
  var prevCount = features.previousSiblingCount || 0;
  // Distance from start
  var startRatio = prevCount / features.siblingCount;
  features.score += 2 - 2 * startRatio;

  // Distance from middle
  var halfCount = features.siblingCount / 2;
  var middleOffset = Math.abs(prevCount - halfCount);
  var middleRatio = middleOffset / halfCount;
  features.score += 2 - 2 * middleRatio;
}

/**
 * Propagate scores to nearby siblings. Look up to 2 elements
 * away in either direction. The idea is that content generally
 * follows content, and boilerplate generally follows boilerplate.
 * Contiguous blocks should get promoted by virture of their
 * context.
 * TODO: refactor as online in order to fold into score element
 * TODO: instead of biasing the siblings based on the element,
 * bias the element itself based on its siblings. Rather, only
 * bias the element itself based on its prior sibling. That way,
 * we can bias while iterating more easily because we don't have to
 * abide the requirement that nextSibling is scored. Then it is
 * easy to incorporate this into the score function
 * and deprecate this function. In my head I am thinking of an analogy
 * to something like a YACC lexer that avoids doing peek operations
 * (lookahead parsing). We want something more stream-oriented.
 */
function applySiblingBias(featuresMap, element) {
  var features = featuresMap.get(element);
  var siblingFeatures;
  var bias = features.score > 0 ? 5 : -5;
  var sibling = element.previousElementSibling;
  if(sibling) {
    updateScore(featuresMap, sibling, bias);
    sibling = sibling.previousElementSibling;
    if(sibling) {
      updateScore(featuresMap, sibling, bias);
    }
  }
  sibling = element.nextElementSibling;
  if(sibling) {
    updateScore(featuresMap, sibling, bias);
    sibling = sibling.nextElementSibling;
    if(sibling) {
      updateScore(featuresMap, sibling, bias);
    }
  }
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
  if(!features.charCount || !anchor.hasAttribute('href')) {
    return;
  }
  features.anchorCharCount = features.charCount;
  featuresMap.set(anchor, features);
  var parent = anchor, parentFeatures;
  while(parent = parent.parentElement) {
    // we have to use || {} because this can walk above doc.body
    parentFeatures = featuresMap.get(parent) || {};
    parentFeatures.anchorCharCount = (parentFeatures.anchorCharCount || 0) +
      features.anchorCharCount;
    featuresMap.set(parent, parentFeatures);
  }
}

/**
 * Calculates and stores two sibling properties: the
 * number of siblings, and the number of preceding siblings
 * in document order.
 */
function deriveSiblingFeatures(featuresMap, element) {
  var features = featuresMap.get(element);
  features.siblingCount = element.parentElement.childElementCount - 1;
  features.previousSiblingCount = 0;
  if(features.siblingCount) {
    var pes = element.previousElementSibling;
    if(pes) {
      // TODO: this could be improved
      // if pes exists, pesFeatures guaranteed defined when walking in
      // document order
      var pesFeatures = featuresMap.get(pes);
      pesFeatures.previousSiblingCount = pesFeatures.previousSiblingCount || 0;
      features.previousSiblingCount = pesFeatures.previousSiblingCount + 1;
    }
  }
  featuresMap.set(element, features);
}

function deriveTextFeatures(featuresMap, node) {
  var element = node.parentElement;
  var features = featuresMap.get(element);

  if(!features.hasCopyrightSymbol) {
    // TODO: check for the copyright character itself?
    // TODO: check unicode variants?
    features.hasCopyrightSymbol = RE_COPYRIGHT.test(node.nodeValue);
  }

  // TODO: this should also be looking for the character itself
  // &#8226,•, &#x2022;
  features.bulletCount = features.bulletCount || 0;
  features.bulletCount += countChar(node.nodeValue,'\u2022');
  // TODO: this should also be looking at other expressions of pipes
  features.pipeCount = features.pipeCount || 0;
  features.pipeCount += countChar(node.nodeValue, '|');
  features.charCount = features.charCount || 0;
  features.charCount += node.nodeValue.length -
    node.nodeValue.split(RE_WHITESPACE).length + 1;
  featuresMap.set(element, features);
  if(!features.charCount) {
    return;
  }

  var parent = element, parentFeatures;
  while(parent = parent.parentElement) {
    // NOTE: because this walks above body we need || {}
    // That should be improved
    parentFeatures = featuresMap.get(parent) || {};
    parentFeatures.charCount = parentFeatures.charCount || 0;
    parentFeatures.charCount += features.charCount;
    featuresMap.set(parent, parentFeatures);
  }
}

/**
 * Sets attributes of the element that reflect some of the
 * internal metrics (expando properties) stored for the
 * element, according to whether the attribute should be
 * exposed in options
 */
function exposeAttributes(options, featuresMap, element)  {
  var features = featuresMap.get(element);
  if(!features)
    return;
  if(options.SHOW_CHAR_COUNT && features.charCount)
    element.setAttribute('charCount', features.charCount);
  if(options.SHOW_COPYRIGHT_COUNT && features.hasCopyrightSymbol)
    element.setAttribute('hasCopyrightSymbol', features.hasCopyrightSymbol);
  if(options.SHOW_DOT_COUNT && features.bulletCount)
    element.setAttribute('bulletCount', features.bulletCount);
  if(options.SHOW_IMAGE_BRANCH && features.imageBranch)
    element.setAttribute('imageBranch', features.imageBranch);
  if(options.SHOW_PIPE_COUNT && features.pipeCount)
    element.setAttribute('pipeCount', features.pipeCount);
  // TODO: why toFixed? what was i thinking here?
  if(options.SHOW_SCORE && features.score)
    element.setAttribute('score', features.score.toFixed(2));
}

/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 */
function getImageArea(element) {
  // TODO: use offsetWidth and offsetHeight instead?
  if(element.width && element.height) {
    var area = element.width * element.height;
    // TODO: this clamping really should be done in the caller and not here.
    // Clamp to 800x600
    if(area > 360000) {
      area = 360000;
    }

    return area;
  }

  return 0;
}

/**
 * Compares the scores of two elements and returns the element with the higher
 * score. If equal the previous element is returned.
 * TODO: this needs a better name. what is it doing?
 */
function getMaxScore(featuresMap, previous, current) {
  var previousFeatures = featuresMap.get(previous);
  var currentFeatures = featuresMap.get(current);

  if(!currentFeatures.hasOwnProperty('score')) {
    return previous;
  }

  if(currentFeatures.score > previousFeatures.score) {
    return current;
  }

  return previous;
}

function prescore(featuresMap, element) {
  var features = {
    score: 0
  };
  featuresMap.set(element, features);
}

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 */
function scoreElement(featuresMap, element) {
  var features = featuresMap.get(element);

  applyTextScore(features, element);

  if(element.localName == 'img') {
    applyImageScore(featuresMap, features, element);
  }

  applyPositionScore(features, element);

  // Apply a bias based on the type of element
  features.score += TYPE_BIAS.get(element.localName) || 0;

  // Apply a bias based on the text of the id or class attributes
  var attributeText = ((element.id || '') + ' ' + (element.className || ''));
  attributeText = attributeText.trim().toLowerCase();
  var attributeTokens = attributeText.split(RE_TOKEN_SPLIT);
  for(var i = 0, len = attributeTokens.length; i < len; i++) {
    features.score += ATTRIBUTE_BIAS.get(attributeTokens[i]) || 0;
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
  var each = Array.prototype.forEach;
  var reduce = Array.prototype.reduce;
  var anchors = doc.body.getElementsByTagName('a');
  var elements = doc.body.getElementsByTagName('*');

  // Store all elements in the features map with a score of 0
  // This avoids having every map lookup doing a null check
  each.call(elements, prescore.bind(this, features));

  var textNode = null;
  var textIterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  while(textNode = textIterator.nextNode()) {
    deriveTextFeatures(features, textNode);
  }

  each.call(anchors, deriveAnchorFeatures.bind(this, features));
  each.call(elements, deriveSiblingFeatures.bind(this, features));

  each.call(elements, scoreElement.bind(this, features));
  each.call(elements, applySiblingBias.bind(this, features));
  features.set(doc.body, {score: -Infinity});
  var bestElement = reduce.call(elements, getMaxScore.bind(this, features),
    doc.body);

  var descendants = bestElement.getElementsByTagName('*');
  exposeAttributes(options, features, bestElement);
  each.call(descendants, exposeAttributes.bind(this, options, features));

  return bestElement;
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
