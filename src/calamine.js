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
 */
(function calamineWrapper(exports) {
'use strict';

var ELEMENT_POLICY = new Map([
['a', {nameBias: -1}],
['address', {nameBias: -3}],
['article', {nameBias: 100}],
['aside', {nameBias: -200}],
['b', {descendantBias: 1}],
['blockquote', {ancestorBias: 10, descendantBias: 3, nameBias: 5}],
['canvas', {nameBias: 3}],
['code', {ancestorBias: 10, descendantBias: 2}],
['dir', {ancestorBias: -5, nameBias: -20}],
['dd', {nameBias: -3}],
['div', {ancestorBias: 1, nameBias: 20}],
['dl', {ancestorBias: -5, nameBias: -10}],
['dt', {nameBias: -3}],
['em', {descendantBias: 1}],
['figcaption', {nameBias: 10}],
['figure', {nameBias: 10}],
['footer', {nameBias: -20}],
['form', {nameBias: -20}],
['header', {ancestorBias: -5, nameBias: -5}],
['h1', {descendantBias: 1, nameBias: -2}],
['h2', {descendantBias: 1, nameBias: -2}],
['h3', {descendantBias: 1, nameBias: -2}],
['h4', {descendantBias: 1, nameBias: -2}],
['h5', {descendantBias: 1, nameBias: -2}],
['h6', {descendantBias: 1, nameBias: -2}],
['i', {descendantBias: 1}],
['li', {ancestorBias: -3, nameBias: -20}],
['main', {nameBias: 100}],
['nav', {ancestorBias: -20, nameBias: -50}],
['ol', {ancestorBias: -5, nameBias: -20}],
['p', {ancestorBias: 10, descendantBias: 5, nameBias: 10}],
['pre', {ancestorBias: 10, descendantBias: 2, nameBias: 5}],
['ruby', {ancestorBias: 5, nameBias: 5}],
['section', {nameBias: 10}],
['small', {nameBias: -1}],
['span', {descendantBias: 1}],
['strong', {descendantBias: 1}],
['sub', {descendantBias: 2}],
['summary', {ancestorBias: 2, descendantBias: 1, nameBias: 5}],
['sup', {descendantBias: 2}],
['table', {ancestorBias: -2}],
['td', {nameBias: 3}],
['th', {nameBias: -3}],
['time', {descendantBias: 2, nameBias: 2}],
['tr', {nameBias: 1}],
['ul', {ancestorBias: -5, nameBias: -20}]
]);

var LEXICON_BIAS = new Map([
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

var RE_TOKEN_SPLIT = /[\s-_]+/g;

// Downward bias. Affects all descendants
function applyAncestorBias(featuresMap, descriptor, element) {
  var bias = descriptor && descriptor.ancestorBias;
  if(!bias) {
    return;
  }

  // TODO: for some reason, this lookup is horrible performance. This
  // seems to be the primary reason that scoreElement is slow
  // getElementsByTagName is awkwardly slow here
  var descendants = element.getElementsByTagName('*');
  var length = descendants.length;
  var descendant, descFeatures;
  for(var i = 0; i < length; i++) {
    descendant = descendants[i];
    descFeatures = featuresMap.get(descendant);
    descFeatures.score += bias;
    featuresMap.set(descendant, descFeatures);
  }
}

function applyAttributeBias(features, element) {
  // Random side thought. What if I just did getElementsByClassName
  // for each LEXICON_BIAS term?
  var tokens = ((element.id || '') + ' ' + (element.className || '')).trim().
    toLowerCase().split(RE_TOKEN_SPLIT);
  for(var i = 0, len = tokens.length; i < len; i++) {
    features.score += LEXICON_BIAS.get(tokens[i]) || 0;
  }
}

/**
 * Upward bias. Affects only the immediate parent of this element.
 */
function applyDescendantBias(featuresMap, descriptor, element) {
  var bias = descriptor && descriptor.descendantBias;
  if(!bias) {
    return;
  }
  var parent = element.parentElement;
  var parentFeatures = featuresMap.get(parent);
  parentFeatures.score += bias;
  featuresMap.set(parent, parentFeatures);
}

function applyElementBias(features, descriptor) {
  features.score += (descriptor && descriptor.nameBias) || 0;
}

/**
 * NOTE: expects defined dimensions
 * TODO: is there some nicer way of updating the parentElement? I am not
 * entirely happy that we secretly update other elements here
 */
function applyImageScore(featuresMap, features, image) {

  if(image.localName != 'img') {
    return;
  }

  var imageParent = image.parentElement;

  // Guaranteed to be in map by prescore
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
    siblingFeatures = featuresMap.get(sibling);
    siblingFeatures.score += bias;
    featuresMap.set(sibling, siblingFeatures);

    sibling = sibling.previousElementSibling;
    if(sibling) {
      siblingFeatures = featuresMap.get(sibling);
      siblingFeatures.score += bias;
      featuresMap.set(sibling, siblingFeatures);
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    siblingFeatures = featuresMap.get(sibling);
    siblingFeatures.score += bias;
    featuresMap.set(sibling, siblingFeatures);

    sibling = sibling.nextElementSibling;
    if(sibling) {
      siblingFeatures = featuresMap.get(sibling);
      siblingFeatures.score += bias;
      featuresMap.set(sibling, siblingFeatures);
    }
  }
}

/**
 * Updates the element's score based on the content
 * of its text nodes.
 */
function applyTextScore(features, descriptor, element) {
  var cc = features.charCount;
  if(!cc || (descriptor && descriptor.leaf)) {
    return;
  }

  if(features.hasCopyrightSymbol) {
    features.score -= 40;
  }
  features.score += -20 * (features.bulletCount || 0);
  features.score += -10 * (features.pipeCount || 0);

  var density = features.anchorCharCount / cc;
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
  var features = featuresMap.get(anchor) || {};
  if(!features.charCount || !anchor.hasAttribute('href')) {
    return;
  }
  features.anchorCharCount = features.charCount;
  featuresMap.set(anchor, features);
  var parent = anchor, parentFeatures;
  while(parent = parent.parentElement) {
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
  var features = featuresMap.get(element) || {};
  features.siblingCount = element.parentElement.childElementCount - 1;
  features.previousSiblingCount = 0;
  if(features.siblingCount) {
    var pes = element.previousElementSibling;
    if(pes) {
      // TODO: this could be improved, because it is guaranteed defined
      // since walking in document order
      var pesFeatures = featuresMap.get(pes) || {};
      pesFeatures.previousSiblingCount = pesFeatures.previousSiblingCount || 0;
      features.previousSiblingCount = pesFeatures.previousSiblingCount + 1;
    }
  }
  featuresMap.set(element, features);
}

var reCopyright = /&(copy|#169|#xA9);/i;
var reWhitespace = /\s+/g;

function deriveTextFeatures(doc, featuresMap) {
  forEachNode(doc.body, NodeFilter.SHOW_TEXT, function derive(node) {
    var element = node.parentElement;
    var features = featuresMap.get(element) || {};

    if(!features.hasCopyrightSymbol) {
      // TODO: check for the copyright character itself?
      // TODO: check unicode variants?
      features.hasCopyrightSymbol = reCopyright.test(node.nodeValue);
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
      node.nodeValue.split(reWhitespace).length + 1

    featuresMap.set(element, features);
    if(!features.charCount) {
      return;
    }

    var parent = element, parentFeatures;
    while(parent = parent.parentElement) {
      parentFeatures = featuresMap.get(parent) || {};
      parentFeatures.charCount = parentFeatures.charCount || 0;
      parentFeatures.charCount += features.charCount;
      featuresMap.set(parent, parentFeatures);
    }
  });
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
 * A simple helper to use forEach against traversal API.
 *
 * TODO: maybe reorder parameters to make filter required and before
 * func, to make order more intuitive (natural).
 *
 *
 * @param element - the root element, only nodes under the root are
 * iterated. The root element itself is not 'under' itself so it is not
 * included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
function forEachNode(element, type, func, filter) {
  var doc = element.ownerDocument, node,
    it = doc.createNodeIterator(element, type, filter);
  while(node = it.nextNode()) {
    func(node);
  }
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

    // TODO: this clamping really should be done in the caller
    // and not here.

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
  var previousFeatures = featuresMap.get(previous) || {};
  var currentFeatures = featuresMap.get(current) || {};

  if(!currentFeatures.hasOwnProperty('score')) {
    return previous;
  }

  if(currentFeatures.score > previousFeatures.score) {
    return current;
  }

  return previous;
}

function prescore(featuresMap, element) {
  var features = featuresMap.get(element);
  features.score = 0;
  featuresMap.set(element, features);
}


/**
 * Simple helper for passing to iterators like forEach
 */
function removeNode(node) {
  node.remove();
}

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 * TODO: support 'picture' element
 */
function scoreElement(featuresMap, element) {
  var descriptor = ELEMENT_POLICY.get(element.localName);
  var features = featuresMap.get(element);
  applyTextScore(features, descriptor, element);
  applyImageScore(featuresMap, features, element);
  applyPositionScore(features, element);
  applyElementBias(features, descriptor);
  applyAttributeBias(features, element);
  featuresMap.set(element, features);
  applyAncestorBias(featuresMap, descriptor, element);
  applyDescendantBias(featuresMap, descriptor, element);
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

  // TODO: Move the each.call back into here
  deriveTextFeatures(doc, features);
  each.call(anchors, deriveAnchorFeatures.bind(this, features));
  each.call(elements, deriveSiblingFeatures.bind(this, features));
  each.call(elements, prescore.bind(this, features));
  each.call(elements, scoreElement.bind(this, features));
  each.call(elements, applySiblingBias.bind(this, features));
  features.set(doc.body, {score: -Infinity});
  var bestElement = reduce.call(elements, getMaxScore.bind(this, features),
    doc.body);

  exposeAttributes(options, features, bestElement);
  // TODO: use descendants of bestElement via gebtn, not a node iterator
  forEachNode(bestElement, NodeFilter.SHOW_ELEMENT,
    exposeAttributes.bind(this, options, features));
  return bestElement;
}

// Public API
exports.calamine = {
  transformDocument: transformDocument
};

}(this));
