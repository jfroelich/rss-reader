// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * The calamine module provides functions for removing boilerplate content
 * In other words, applying lotion to soothe NLP shingles. The principle
 * and sole 'public' function is transformDocument.
 */
var calamine = {};

/**
 * Filter that accepts empty text nodes
 */
calamine.acceptIfEmpty = function(node) {
  return node.nodeValue ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
};

/**
 * Filter that accepts elements that can be unwrapped.
 */
calamine.acceptIfShouldUnwrap = function(bestElement, e) {
  if(e === bestElement) {
    return NodeFilter.FILTER_REJECT;
  }
  if(e.localName == 'a') {
    var href = (e.getAttribute('href') || '').trim();
    return !href || /^\s*javascript\s*:/i.test(href) ?
      NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
  }
  var descriptor = calamine.ELEMENT_POLICY.get(e.localName);
  return descriptor.unwrappable ? NodeFilter.FILTER_ACCEPT :
    NodeFilter.FILTER_REJECT;
};

calamine.applyAncestorBias = function(featuresMap, descriptor, element) {
  // Downward bias. Affects all descendants
  var bias = descriptor.ancestorBias;
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
};

calamine.applyAttributeBias = function(features, element) {
  var tokens = ((element.id || '') + ' ' + (element.className || '')).trim().
    toLowerCase().split(calamine.RE_TOKEN_SPLIT);
  for(var i = 0, len = tokens.length; i < len; i++) {
    features.score += calamine.LEXICON_BIAS.get(tokens[i]) || 0;
  }
};

calamine.applyDescendantBias = function(featuresMap, descriptor, element) {
  // Upward bias. Affects only the immediate parent of this element.
  var bias = descriptor.descendantBias;
  if(!bias) {
    return;
  }
  var parent = element.parentElement;
  // guaranteed defined by calamine.prescore
  var parentFeatures = featuresMap.get(parent);
  // guaranteed defined by calamine.prescore
  parentFeatures.score += bias;
  featuresMap.set(parent, parentFeatures);
};


/**
 * NOTE: expects defined dimensions
 * TODO: is there some nicer way of updating the parentElement? I am not
 * entirely happy that we secretly update other elements here
 */
calamine.applyImageScore = function(featuresMap, features, image) {

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

  var area = calamine.getImageArea(image);
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
};

/**
 * Updates the element's score based on its index within
 * its parent. The closer to the start (the smaller the index),
 * the higher the score. The closer the middle (the mid index),
 * the higher the score.
 */
calamine.applyPositionScore = function(features, element) {
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
};

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
calamine.applySiblingBias = function(featuresMap, element) {

  var features = featuresMap.get(element) || {};
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
};

/**
 * Updates the element's score based on the content
 * of its text nodes.
 */
calamine.applyTextScore = function(features, descriptor, element) {
  var cc = features.charCount;
  if(!cc || descriptor.leaf) {
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
};

/**
 * Replace variations of the space character with the ' ' character
 * in every text node's nodeValue.
 *
 * TODO: rather than mutate text I should just have smarter queries
 * that consider variations
 */
calamine.canonicalizeSpaces = function(doc) {
  var pattern = /&;(nbsp|#(xA0|160));/g;
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, function replace(node) {
    node.nodeValue = node.nodeValue.replace(pattern,' ');
  });
};

/**
 * Creates a Set of preformatted elements, including descendants.
 */
calamine.collectPreformatted = function(doc) {
  return new WeakSet(Array.prototype.slice.call(doc.body.querySelectorAll(
    'code, code *, pre, pre *, ruby, ruby *, textarea, textarea *, xmp, xmp *'
  )));
};

/**
 * Returns the frequency of ch in str.
 * See http://jsperf.com/count-the-number-of-characters-in-a-string
 */
calamine.countChar = function(str, ch) {
  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }
  return count;
};

/**
 * Extract anchor features. Based on charCount from text features
 */
calamine.deriveAnchorFeatures = function(featuresMap, anchor) {
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
};

/**
 * Calculates and stores two sibling properties: the
 * number of siblings, and the number of preceding siblings
 * in document order.
 */
calamine.deriveSiblingFeatures = function(featuresMap, element) {
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
};

calamine.deriveTextFeatures = function(doc, featuresMap) {
  var reCopyright = /&copy;|&#169;|&#xA9;/i;
  var reWhitespace = /\s+/g;
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, function derive(node) {
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
    features.bulletCount += calamine.countChar(node.nodeValue,'\u2022');
    // TODO: this should also be looking at other expressions of pipes
    features.pipeCount = features.pipeCount || 0;
    features.pipeCount += calamine.countChar(node.nodeValue, '|');
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
};

calamine.ELEMENT_POLICY = new Map([
['a', {inline: true, nameBias: -1}],
['abbr', {inline: true}],
['acronym', {inline: true}],
['address', {inline: true, nameBias: -3}],
['applet', {blacklisted: true, leaf: true}],
['area', {leaf: true}],
['article', {nameBias: 100, unwrappable: true}],
['aside', {nameBias: -200}],
['audio', {leaf: true}],
['b', {descendantBias: 1, inline: true}],
['base', {blacklisted: true, leaf: true}],
['basefont', {blacklisted: true, leaf: true}],
['bdi', {inline: true}],
['bdo', {inline: true}],
['bgsound', {blacklisted: true, leaf: true}],
['big', {unwrappable: true}],
['blink', {inline: true, unwrappable: true}],
['blockquote', {ancestorBias: 10, descendantBias: 3, nameBias: 5}],
['body', {unwrappable: true}],
['br', {leaf: true}],
['button', {blacklisted: true, nameBias: -100}],
['canvas', {leaf: true, nameBias: 3}],
['caption', {}],
['center', {unwrappable: true}],
['cite', {inline: true}],
['code', {ancestorBias: 10, descendantBias: 2, inline: true}],
['col', {leaf: true}],
['colgroup', {unwrappable: true}],
['command', {blacklisted: true, leaf: true}],
['data', {inline: true, unwrappable: true}],
['datalist', {blacklisted: true}],
['details', {unwrappable: true}],
['dialog', {blacklisted: true}],
['dir', {ancestorBias: -5, nameBias: -20}],
['dd', {nameBias: -3}],
['del', {inline: true}],
['dfn', {inline: true}],
['div', {ancestorBias: 1, nameBias: 20, unwrappable: true}],
['dl', {ancestorBias: -5, nameBias: -10}],
['dt', {nameBias: -3}],
['em', {descendantBias: 1, inline: true}],
['embed', {blacklisted: true, leaf: true}],
['fieldset', {blacklisted: true}],
['figcaption', {nameBias: 10}],
['figure', {nameBias: 10}],
['font', {inline: true, unwrappable: true}],
['footer', {nameBias: -20, unwrappable: true}],
['form', {nameBias: -20, unwrappable: true}],
['frame', {blacklisted: true, leaf: true}],
['frameset', {blacklisted: true}],
['head', {blacklisted: true}],
['header', {ancestorBias: -5, nameBias: -5, unwrappable: true}],
['help', {unwrappable: true}],
['hgroup', {unwrappable: true}],
['hr', {leaf: true}],
['html', {blacklisted: true, unwrappable: true}],
['h1', {descendantBias: 1, nameBias: -2}],
['h2', {descendantBias: 1, nameBias: -2}],
['h3', {descendantBias: 1, nameBias: -2}],
['h4', {descendantBias: 1, nameBias: -2}],
['h5', {descendantBias: 1, nameBias: -2}],
['h6', {descendantBias: 1, nameBias: -2}],
['i', {descendantBias: 1, inline: true}],
['iframe', {blacklisted: true, leaf: true}],
['ilayer', {unwrappable: true}],
['img', {leaf: true}],
['input', {blacklisted: true, leaf: true}],
['ins', {inline: true}],
['insert', {unwrappable: true}],
['isindex', {blacklisted: true}],
['label', {unwrappable: true}],
['layer', {unwrappable: true}],
['legend', {unwrappable: true}],
['li', {ancestorBias: -3, nameBias: -20}],
['link', {blacklisted: true, leaf: true}],
['kbd', {inline: true}],
['keygen', {}],
['main', {nameBias: 100, unwrappable: true}],
['mark', {inline: true}],
['marquee', {unwrappable: true}],
['map', {inline: true}],
['math', {blacklisted: true}],
['menu', {ancestorBias: -5, blacklisted: true}],
['menuitem', {ancestorBias: -5, blacklisted: true}],
['meta', {blacklisted: true, leaf: true}],
['meter', {inline: true, unwrappable: true}],
['multicol', {unwrappable: true}],
['nav', {ancestorBias: -20, nameBias: -50}],
['nobr', {unwrappable: true}],
['noembed', {unwrappable: true}],
['noframes', {blacklisted: true}],
['noscript', {unwrappable: true}],
['object', {blacklisted: true, leaf: true}],
['ol', {ancestorBias: -5, nameBias: -20}],
['optgroup', {blacklisted: true}],
['option', {blacklisted: true, leaf: true}],
['output', {blacklisted: true}],
['p', {ancestorBias: 10, descendantBias: 5, nameBias: 10}],
['param', {blacklisted: true, leaf: true}],
['plaintext', {unwrappable: true}],
['pre', {ancestorBias: 10, descendantBias: 2, nameBias: 5}],
['progress', {blacklisted: true, leaf: true}],
['q', {inline: true}],
['rect', {}],
['rp', {inline: true}],
['rt', {inline: true}],
['ruby', {ancestorBias: 5, nameBias: 5}],
['s', {}],
['samp', {inline: true}],
['script', {blacklisted: true}],
['section', {nameBias: 10, unwrappable: true}],
['select', {blacklisted: true}],
['small', {inline: true, nameBias: -1, unwrappable: true}],
['source', {leaf: true}],
['spacer', {blacklisted: true}],
['span', {descendantBias: 1, inline: true, unwrappable: true}],
['strike', {inline: true}],
['strong', {descendantBias: 1, inline: true}],
['style', {blacklisted: true}],
['sub', {descendantBias: 2, inline: true}],
['summary', {ancestorBias: 2, descendantBias: 1, nameBias: 5}],
['sup', {descendantBias: 2, inline: true}],
['svg', {leaf: true}],
['table', {ancestorBias: -2}],
['tbody', {unwrappable: true}],
['td', {nameBias: 3}],
['textarea', {blacklisted: true, leaf: true}],
['tfoot', {unwrappable:true}],
['th', {nameBias: -3}],
['thead', {unwrappable: true}],
['time', {descendantBias: 2, inline: true, nameBias: 2}],
['title', {blacklisted: true, leaf: true}],
['tr', {nameBias: 1}],
['track', {leaf:true}],
['tt', {inline: true}],
['u', {inline: true}],
['ul', {ancestorBias: -5, nameBias: -20}],
['var', {inline: true}],
['video', {leaf: true}],
['wbr', {}],
['xmp', {blacklisted: true}]
]);

/**
 * Sets attributes of the element that reflect some of the
 * internal metrics (expando properties) stored for the
 * element, according to whether the attribute should be
 * exposed in options
 */
calamine.exposeAttributes = function(options, featuresMap, element)  {
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
};

/**
 * Simple decorator that works with array-like objects
 * such as NodeList
 */
calamine.filter = function(list, fn) {
  return Array.prototype.filter.call(list, fn);
};

/**
 * Removes attributes from the element unless they are not
 * removable.
 *
 * TODO: allow title? allow alt?
 * NOTE: confirmed hotspot, hence plain loop
 */
calamine.filterAttributes = function(element) {
  var attributes = element.attributes, name;
  var index = attributes.length;
  while(index--) {
    name = attributes[index].name;
    if(name == 'src' || name == 'href') {
      continue;
    }
    element.removeAttribute(name);
  }
};

/**
 * Removes elements that are empty, such as <p></p>,
 * from the document.
 *
 * The process is iterative. For example, given
 * <p><p></p></p>, the inner paragraph would be
 * removed, leading to a new document state of <p></p>,
 * which happens to also meet the empty criteria,
 * which is then also removed. Iteration continues
 * up to the body element (exclusive) of the document.
 */
calamine.filterEmptyElements = function(doc) {

  // TODO: This needs a lot of cleanup

  // Remove all empty-like elements from the document. If removing
  // an element would change the state of the element's parent to also
  // meet the empty-like criteria, then the parent is also removed, and
  // so forth, up the hierarchy, but stopping before doc.body.

  // TODO: there is a specific edge case not being handled
  // where certain elements, e.g. anchors, that do not contain
  // any child nodes, should be considered empty. And this must
  // be recursive as well, up the tree.
  // In the case of <ul><li><a></a></li></ul>, the result should
  // be that the entire subtree is removed.
  // Because this case is not currently handled, and because we
  // remove other nodes, this leads to some funny looking junk
  // areas of content (e.g. a list of empty bullet points)
  // This gets trickier because the logic, in the current impl,
  // has to be in a couple places. in isEmptyLike, an anchor without
  // a firstChild should be considered empty. That should be handled
  // right now but for some odd reason it is not. Then once any element
  // is removed and we check its parent, its parent should go through
  // the same logic, which does not seem to happen, even though
  // the logic is plainly there to do that.

  // TODO: removes should happen only once on the shallowest
  // parent. If this were called on a live doc we would be causing
  // several unecessary reflows. For example, in the case of
  // <div><p></p><p></p></div>, there are 3 remove operations,
  // when only 1 needed to occur. To do this, this needs
  // to be fundamentally refactored. Removes should not occur
  // on the first pass over the elements. This, btw, would remove the
  // ugliness of using a map function with a side effet. Instead, start by
  // identifying all of the empty leaves. Then, for each leaf, traverse
  // upwards to find the actual element to remove. Be cautious
  // about simply checking that parent.childElementCount == 1 to find
  // a removable parent because it is false in the case that two
  // or more empty-leaves share the same parent. The criteria instead is
  // that a parent is removable if all of its children are removable.
  // So we need to go up 1, then query all direct children. But that is
  // kind of redundant since we already identified the children, so that
  // still might need improvement.

  var elements = doc.body.getElementsByTagName('*');
  var emptyLikeElements = calamine.filter(elements, calamine.isEmptyLike);

  // TODO: just add children that should be removed to the stack insead of
  // removing them and adding their parents to the stack.

  // Remove all the empty children and shove all the parents on the stack
  var parents = emptyLikeElements.map(calamine.removeAndReturnParent);
  var stack = parents.filter(calamine.isNotRoot);

  var parent, grandParent;

  while(stack.length) {
    parent = stack.pop();

    if(parent.firstChild) {
      // There are other nodes/elements in the parent after
      // the child was removed (when building the stack),
      // so do not remove the parent.
      continue;
    }

    // Grab a reference to the grand parent before removal
    // because after removal it is undefined
    grandParent = parent.parentElement;
    parent.remove();

    // If there was no grand parent (how would that ever happen?)
    // or the grand parent is the root, then do not add the new
    // grand parent to the stack
    if(!grandParent || grandParent == doc.body) {
      continue;
    }

    stack.push(grandParent);
  }
};

/**
 * Simple decorator that accepts array-like objects
 * such as NodeList or arguments.
 */
calamine.forEach = function(list, func) {
  Array.prototype.forEach.call(list, func);
};

/**
 * A simple helper to use forEach against traversal API.
 *
 * TODO: maybe reorder parameters to make filter required and before
 * func, to make order more intuitive (natural).
 *
 * TODO: use func.call and support thisArg
 *
 * @param element - the root element, only nodes under the root are
 * iterated. The root element itself is not 'under' itself so it is not
 * included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
calamine.forEachNode = function(element, type, func, filter) {
  var doc = element.ownerDocument, node,
    it = doc.createNodeIterator(element, type, filter);
  while(node = it.nextNode()) {
    func(node);
  }
};

/**
 * Returns the area of an image, in pixels. If the image's dimensions are
 * undefined, then returns undefined. If the image's dimensions are
 * greater than 800x600, then the area is clamped.
 */
calamine.getImageArea = function(element) {
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
};

/**
 * Compares the scores of two elements and returns the element with the higher
 * score. If equal the previous element is returned.
 * TODO: this needs a better name. what is it doing?
 */
calamine.getMaxScore = function(featuresMap, previous, current) {

  var previousFeatures = featuresMap.get(previous) || {};
  var currentFeatures = featuresMap.get(current) || {};

  if(!currentFeatures.hasOwnProperty('score')) {
    return previous;
  }

  //if(!previousFeatures.hasOwnProperty('score')) {
  //  return current;
  //}

  if(currentFeatures.score > previousFeatures.score) {
    return current;
  }

  return previous;
};

/**
 * Returns true if the element is empty-like and therefore suitable for pruning
 */
calamine.isEmptyLike = function(element) {
  var descriptor = calamine.ELEMENT_POLICY.get(element.localName);
  return !element.firstChild && !descriptor.leaf;
};

/**
 * Returns true if the element is inline. This works
 * according to the element's local policy, not its style. calamine
 * cannot use style because foreign documents do not appear to
 * have all style values computed, and in particular, the
 * display variable is sometimes not set.
 */
calamine.isInline = function(element) {

  // Element may be undefined since the caller does not check
  // if node.nextSibling or node.previousSibling are defined
  // before the call. This is expected.
  if(!element) {
    return false;
  }

  // This condition definitely happens, not exactly
  // sure how or why
  // TODO: does this mean it is inline? should this
  // be returning true?
  if(element.nodeType != Node.ELEMENT_NODE) {
    return false;
  }

  var desc = calamine.ELEMENT_POLICY.get(element.localName);
  return desc.inline;
};

/**
 * Tests whether an element is invisible
 */
calamine.isInvisible = function(element) {

  // TODO: this is alarmingly slow. My best guess is that
  // element.style is lazily computed, or that opacity
  // calc is slow

  // Look at how jquery implemented :hidden? Maybe it is fast?

/*
// From jquery
// NOTE: they also check display === 'none'
jQuery.expr.filters.hidden = function( elem ) {
  return elem.offsetWidth <= 0 || elem.offsetHeight <= 0;
};
*/

  // TODO: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again.
  // Something about emulating how jquery does it?
  // TODO: consider if(element.hidden) ?
  var s = element.style;
  if(s.display === 'none') {
    return true;
  }
  if(s.visibility === 'hidden' || s.visibility === 'collapse') {
    return true;
  }
  var opacity = parseFloat(s.opacity);
  return opacity < 0.3;
};

/**
 * Returns true if the element is not the body element
 *
 * TODO: rename to isNotBody and simplify
 */
calamine.isNotRoot = function(element) {
  if(!element) {
    return true;
  }

  var doc = element.ownerDocument;
  if(!doc) {
    return true;
  }

  var root = doc.body;
  if(!root) {
    return true;
  }

  return root != element;
};

/**
 * Returns true if the image appears as a tracer image.
 */
calamine.isTracerImage = function(image) {
  return image.width == 1 || image.height == 1;
};

/**
 * Returns true if an element is trimmable, which currently
 * is just BR and empty P
 */
calamine.isTrimmableElement = function(element) {
  return element && element.nodeType == Node.ELEMENT_NODE &&
    (element.localName == 'br' || (element.localName == 'p' &&
    !element.firstChild));
};

calamine.LEXICON_BIAS = new Map([
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

calamine.prescore = function(featuresMap, element) {
  var features = featuresMap.get(element);
  features.score = 0;
  featuresMap.set(element, features);
};

calamine.RE_TOKEN_SPLIT = /[\s-_]+/g;

/**
 * Simple decorator that accepts array-like objects
 * such as NodeList
 */
calamine.reduce = function(list, func, initialValue) {
  return Array.prototype.reduce.call(list, func, initialValue);
};

/**
 * Detaches the element and returns its parent
 * element (prior to detachment).
 */
calamine.removeAndReturnParent = function(element) {
  var parentElement = element.parentElement;
  parentElement.removeChild(element);
  return parentElement;
};

calamine.removeBlacklistedElements = function(doc) {

  // This could be improved, just quick and dirty  for now
  // NOTE: if necessary this can be made static or even
  // just a raw string

  var blacklist = [];
  calamine.ELEMENT_POLICY.forEach(function(value, key) {
    if(value.blacklisted) {
      blacklist.push(key);
    }
  });
  var blacklistSelector = blacklist.join(',');

  // Would this work?
  //var selector = Array.prototype.join.call(
  // calamine.ELEMENT_POLICY.values(), ',');

  calamine.forEach(doc.body.querySelectorAll(blacklistSelector),
    calamine.removeNode);
};

calamine.removeComments = function(doc) {
  calamine.forEachNode(doc.body, NodeFilter.SHOW_COMMENT, calamine.removeNode);
};

calamine.removeEmptyNodes = function(doc) {
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, calamine.removeNode,
    calamine.acceptIfEmpty);
};

calamine.removeInvisibleElements = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  var invisibles = calamine.filter(elements, function(element) {
    if(element.localName == 'noscript' || element.localName == 'noembed') {
      return false;
    }

    return calamine.isInvisible(element);
  });
  calamine.forEach(invisibles, calamine.removeNode);
};

/**
 * Simple helper for passing to iterators like forEach
 */
calamine.removeNode = function(node) {
  // TODO: would node ever be undefined here?
  if(node) {
    node.remove();
  } else {
    console.debug('undefined node');
  }
};

calamine.removeTracerImages = function(doc) {
  var images = doc.body.getElementsByTagName('img');
  var tracers = calamine.filter(images, calamine.isTracerImage);
  tracers.forEach(calamine.removeNode);
};

calamine.removeUnknownElements = function(doc) {
  var elements = doc.body.getElementsByTagName('*');
  var unknowns = calamine.filter(elements, function(e) {
    return !calamine.ELEMENT_POLICY.get(e.localName);
  });
  unknowns.forEach(calamine.removeNode);
};

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 * TODO: support 'picture' element
 */
calamine.scoreElement = function(featuresMap, element) {

  var descriptor = calamine.ELEMENT_POLICY.get(element.localName);
  // prescore ensures all elements mapped and with score property
  // so features and features.score are both guaranteed defined
  var features = featuresMap.get(element);
  calamine.applyTextScore(features, descriptor, element);
  calamine.applyImageScore(featuresMap, features, element);
  calamine.applyPositionScore(features, element);
  features.score += descriptor.nameBias || 0;
  calamine.applyAttributeBias(features, element);
  featuresMap.set(element, features);
  calamine.applyAncestorBias(featuresMap, descriptor, element);
  calamine.applyDescendantBias(featuresMap, descriptor, element);
};

calamine.transformShims = function(doc) {
  var shims = doc.body.querySelectorAll('noscript, noembed');
  calamine.forEach(shims, calamine.transformShim);
};

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
calamine.transformDocument = function(doc, options) {
  var c = calamine;
  var features = new WeakMap();
  options = options || {};
  c.removeComments(doc);
  c.removeBlacklistedElements(doc);
  c.removeUnknownElements(doc);
  c.removeTracerImages(doc);
  //c.removeInvisibleElements(doc);
  c.transformShims(doc);
  c.canonicalizeSpaces(doc);
  c.trimNodes(doc);
  c.removeEmptyNodes(doc);
  c.filterEmptyElements(doc);
  c.deriveTextFeatures(doc, features);
  var anchors = doc.body.getElementsByTagName('a');
  c.forEach(anchors, c.deriveAnchorFeatures.bind(this, features));
  var elements = doc.body.getElementsByTagName('*');
  c.forEach(elements, c.deriveSiblingFeatures.bind(this, features));
  c.forEach(elements, c.prescore.bind(this, features));
  c.forEach(elements, c.scoreElement.bind(this, features));
  c.forEach(elements, c.applySiblingBias.bind(this, features));
  if(options.FILTER_ATTRIBUTES) {
    c.forEach(elements, c.filterAttributes);
  }

  features.set(doc.body, {score: -Infinity});
  var scoreComparator = c.getMaxScore.bind(this, features);
  var bestElement = c.reduce(elements, scoreComparator, doc.body);
  if(options.UNWRAP) {
    c.forEachNode(bestElement, NodeFilter.SHOW_ELEMENT, c.unwrap,
      c.acceptIfShouldUnwrap.bind(this, bestElement));
  }
  var expose = c.exposeAttributes.bind(this, options, features);
  c.forEachNode(bestElement, NodeFilter.SHOW_ELEMENT, expose);
  c.trimElement(bestElement);
  return bestElement;
};


/**
 * Unwraps or removes noscript-like elements.
 */
calamine.transformShim = function(element) {
  // TODO: this needs to check contains to avoid
  // processing <noscript><noscript>..</noscript></noscript>
  if(element.childNodes.length < 3 || element.innerText.length < 100) {
    element.remove();
    return;
  }
  // TODO: is visibility a clue?
  // Otherwise, it is probably a template that contains possibly important
  // content (like the entire article in the case of cbsnews) so we just
  // unwrap it. We must do something with it, because we disable the
  // javascript that would normally expose its content on load.
  calamine.unwrap(element);
};

/**
 * Removes leading and trailing white-space-like
 * child elements from the element
 */
calamine.trimElement = function(element) {
  var node = element.firstChild;
  var sibling;
  while(calamine.isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }
  node = element.lastChild;
  while(calamine.isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
};

/**
 * Trims a node's nodeValue property. Behavior
 * varies based on whether the node is adjacent
 * to inline elements.
 */
calamine.trimNode = function(preformattedParents, node) {

  if(preformattedParents.has(node.parentElement)) {
    return;
  }

  if(calamine.isInline(node.previousSibling)) {
    if(!calamine.isInline(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimRight();
    }
  } else if(calamine.isInline(node.nextSibling)) {
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    node.nodeValue = node.nodeValue.trim();
  }
};

calamine.trimNodes = function(doc) {
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT,
    calamine.trimNode.bind(this, calamine.collectPreformatted(doc)));
};

/**
 * Removes the element but retains its children in its place
 */
calamine.unwrap = function(element) {
  /*
  // TODO: test if this works instead of below

  var doc = element.ownerDocument;
  var frag = doc.createDocumentFragment();
  var next = element.nextSibling;
  var parent = element.parentElement;
  element.remove();
  while(element.firstChild) {
    frag.appendChild(element.firstChild);
  }
  if(next) {
    // TODO: arg order?
    parent.insertBefore(next, frag);
  } else {
    parent.appendChild(frag);
  }
  */

  while(element.firstChild) {
    element.parentElement.insertBefore(element.firstChild, element);
  }

  element.remove();
};
