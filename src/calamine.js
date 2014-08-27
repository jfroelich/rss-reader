// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var calamine = {};

/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
calamine.transformDocument = function(doc, options) {
  var c = calamine;
  options = options || {};
  c.forEachNode(doc.body, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
    c.removeNode, c.acceptIfShouldRemove);
  c.forEachNode(doc.body, NodeFilter.SHOW_ELEMENT, c.transformShim,
    c.acceptIfShouldTransformShim);
  // Next line under dev
  // c.forEach(doc.body.querySelectorAll('br,hr'), c.testSplitBreaks);
  c.forEachNode(doc.body, NodeFilter.SHOW_TEXT, c.canonicalizeSpace);
  c.forEachNode(doc.body, NodeFilter.SHOW_ELEMENT, c.propagatePreformatted,
    calamine.acceptIfPreformatted);
  c.forEachNode(doc.body, NodeFilter.SHOW_TEXT, c.trimNode);
  c.forEachNode(doc.body, NodeFilter.SHOW_TEXT, c.filterEmptyNode);
  c.filterEmptyElements(doc);
  c.forEachNode(doc.body, NodeFilter.SHOW_TEXT, c.deriveTextFeatures);
  var anchors = doc.body.querySelectorAll('a');
  c.forEach(anchors, c.deriveAnchorFeatures);
  var elements = doc.body.querySelectorAll('*');
  c.forEach(elements, c.deriveSiblingFeatures);
  c.forEach(elements, c.scoreElement);
  c.forEach(elements, c.applySiblingBias);
  if(options.FILTER_ATTRIBUTES) {
    c.forEachNode(doc.body, NodeFilter.SHOW_ELEMENT, c.filterAttributes);
  }
  doc.body.score = -Infinity;
  var bestElement = c.reduce(elements, c.getMaxScore, doc.body);
  if(options.UNWRAP) {
    c.forEachNode(bestElement, NodeFilter.SHOW_ELEMENT, c.unwrap,
      calamine.acceptIfShouldUnwrap.bind(this, bestElement));
  }
  c.forEach(elements, c.exposeAttributes.bind(this, options));
  c.trimElement(bestElement);
  return bestElement;
};

calamine.acceptIfShouldUnwrap = function(bestElement, e) {
  if(e === bestElement) {
    return NodeFilter.FILTER_REJECT;
  }

  if(e.localName == 'a') {
    var href = e.getAttribute('href');
    if(href) {
      href = href.trim();
    }

    if(!href) {
      console.debug('unwrapping nominal anchor %o', e);
      return NodeFilter.FILTER_ACCEPT;
    }

    if(/^\s*javascript\s*:/i.test(href)) {
      console.debug('unwrapping anchor with javascript url %s', href);
      return NodeFilter.FILTER_ACCEPT;
    }
  }

  var descriptor = calamine.getDescriptor(e);
  if(descriptor.unwrappable) {
    return NodeFilter.FILTER_ACCEPT;
  }

  return NodeFilter.FILTER_REJECT;
};

calamine.acceptIfPreformatted = function(element) {
  var descriptor = calamine.getDescriptor(element);
  return NodeFilter['FILTER_' + descriptor.preformatted ? 'ACCEPT' : 'REJECT'];
};

calamine.acceptIfShouldTransformShim = function(element) {
  if(element.localName == 'noembed' || element.localName == 'noscript') {
    return NodeFilter.FILTER_ACCEPT;
  }
  return NodeFilter.FILTER_REJECT;
};

calamine.transformShim = function(element) {
  // TODO: this needs to check contains to avoid
  // processing <noscript><noscript>..</noscript></noscript>

  // The idea is that we either unwrap or remove
  if(element.childNodes.length == 1) {
    console.debug('child node length 1');
    // Very probably a traditional text message
    element.remove();
    return;
  }

  var text = element.innerText || '';

  if(element.childNodes.length < 3 || text.length < 100) {
    // Probably a traditional text message
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

calamine.canonicalizeSpace = function(node) {
  node.nodeValue = node.nodeValue.replace(/&(nbsp|#(xA0|160));/,' ');
};

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
 * Returns true if an element is trimmable, which currently
 * is just BR and empty P
 */
calamine.isTrimmableElement = function(element) {
  return element && element.nodeType == Node.ELEMENT_NODE &&
    (element.localName == 'br' || element.localName === 'p' &&
     element.childNodes.length == 0);
};

/**
 * Parameter to createNodeIterator. Returns NodeFilter.FILTER_ACCEPT for
 * nodes that should be removed.
 */
calamine.acceptIfShouldRemove = function(node) {
  if(node.nodeType == Node.COMMENT_NODE) {
    return NodeFilter.FILTER_ACCEPT;
  }

  var descriptor = calamine.getDescriptor(node);
  if(!descriptor) {
    // console.warn('Removing unknown element %o', node);
    return NodeFilter.FILTER_ACCEPT;
  }

  if(descriptor.blacklisted) {
    // console.debug('Removing blacklisted element %s', node);
    return NodeFilter.FILTER_ACCEPT;
  }

  if(calamine.isTracerImage(node)) {
    //console.debug('Removing tracer image %o', node);
    return NodeFilter.FILTER_ACCEPT;
  }

  if(node.localName != 'noscript' && node.localName != 'noembed' &&
    calamine.isInvisible(node)) {
    return NodeFilter.FILTER_ACCEPT;
  }

  return NodeFilter.FILTER_REJECT;
};

calamine.isTracerImage = function(element) {
  return element.localName == 'img' &&
    (element.width == 1 || element.height == 1);
};

calamine.filterAttributes = function(element) {
  var names = calamine.map(element.attributes, calamine.getAttributeName);
  var removables = names.filter(calamine.isRemovableAttribute);
  var remove = Element.prototype.removeAttribute.bind(element);
  removables.forEach(remove);
};

calamine.isNotBestElement = function(bestElement, element) {
  return bestElement != element;
};

calamine.getAttributeName = function(attribute) {
  return attribute.name;
};

calamine.isRemovableAttribute = function(attributeName) {
  // TODO: allow title? allow alt?

  if('href' == attributeName) {
    return false;
  }

  if('src' == attributeName) {
    return false;
  }

  return true;
};

calamine.getMaxScore = function(previous, current) {

  // current could be undefined due to mutation-while-iterating
  // issues so we check here and default to previous
  if(!current) {
    console.debug('current element undefined in getMaxScore');
    return previous;
  }

  if(!current.hasOwnProperty('score')) {
    return previous;
  }

  if(current.score > previous.score) {
    return current;
  }

  return previous;
};

calamine.exposeAttributes = function(options, element)  {

  // Guard due to issues with mutation during iteration
  if(!element) {
    return;
  }

  if(options.SHOW_BRANCH && element.branch)
    element.setAttribute('branch', element.branch);
  if(options.SHOW_ANCHOR_DENSITY && element.anchorDensity)
    element.setAttribute('anchorDensity', element.anchorDensity.toFixed(2));
  if(options.SHOW_CHAR_COUNT && element.charCount)
    element.setAttribute('charCount', element.charCount);
  if(options.SHOW_COPYRIGHT_COUNT && element.hasCopyrightSymbol)
    element.setAttribute('hasCopyrightSymbol', element.hasCopyrightSymbol);
  if(options.SHOW_DOT_COUNT && element.bulletCount)
    element.setAttribute('bulletCount', element.bulletCount);
  if(options.SHOW_IMAGE_BRANCH && element.imageBranch)
    element.setAttribute('imageBranch', element.imageBranch);
  if(options.SHOW_PIPE_COUNT && element.pipeCount)
    element.setAttribute('pipeCount', element.pipeCount);
  if(options.SHOW_SCORE && element.score)
    element.setAttribute('score', element.score.toFixed(2));
};

/**
 * Tests whether an element is invisible
 */
calamine.isInvisible = function(element) {

  // TODO: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again.
  // Something about emulating how jquery does it?
  // TODO: consider if(element.hidden) ?
  var s = element.style;

  if(s.display == 'none' || s.visibility == 'hidden' ||
    s.visibility == 'collapse') {
    return true;
  }

  var opacity = parseFloat(s.opacity);
  if(opacity < 0.3) {
    console.debug('low opacity element %o', element);
    return true;
  }
  return false;
};

calamine.filterEmptyElements = function(doc) {

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

  // TODO: This needs a lot of cleanup

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

calamine.removeAndReturnParent = function(element) {
  var parentElement = element.parentElement;
  parentElement.removeChild(element);
  return parentElement;
};

calamine.isEmptyLike = function(element) {
  var descriptor = calamine.getDescriptor(element);
  return !element.firstChild && !descriptor.leaf;
};

calamine.testSplitBreaks = function(str) {
  // Trying to break apart break rule elements by block
  // UNDER HEAVY DEVELOPMENT

  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

  // TODO: use the isInline function defined somewhere, do not redefine

  var isInline = calamine.getPolicyProp.bind(this,'inline');

  var insertAfter = function(newElement, oldElement) {
    if(oldElement.nextSibling) {
      oldElement.parentElement.insertBefore(newElement, oldElement.nextSibling);
    } else {
      oldElement.parentElement.appendChild(newElement);
    }
  };

  var peek = function(arr) {
    return arr[arr.length - 1];
  }

  var splitBlock = function(element) {

    var root = element.ownerDocument.body;

    // Find the path from the element to the first blocking element.
    var parent = element.parentElement;
    var path = [parent];
    while(isInline(parent)) {
      parent = parent.parentElement;
      path.push(parent);
    }

    if(peek(path) == root) {
      // We could have inline elements or text siblings
      // We have to create artificial block parents
      //var prev = doc.createElement('p');
      //var next = doc.createElement('p');

      return;
    }

    // Rebuilt the path and previous siblings
    //while(path.length) {
     // parent = path.pop();
    //}
  };

  var breaks = doc.body.getElementsByTagName('br');
  calamine.forEach(breaks, splitBlock);
  return doc.body.innerHTML;
};

calamine.deriveTextFeatures = function(node) {
  var doc = node.ownerDocument;
  var parent = node.parentElement;
  var value = node.nodeValue;

  // TODO: this should be using the copyright character itself as well
  // TODO: this should be acting upon text that normalized the variants
  parent.hasCopyrightSymbol = /&copy;|&#169;|&#xA9;/i.test(value) ? 1 : 0;

  // TODO: this should also be looking for the character itself
  // &#8226, •, &#x2022;
  parent.bulletCount = calamine.countChar(value,'\u2022');

  // TODO: this should also be looking at other expressions of pipes
  parent.pipeCount = calamine.countChar(value,'|');

  // NOTE: we don't care about setting the count in the node itself,
  // just in the parent element path to body

  var charCount = value.length - value.split(/[\s\.]/g).length + 1;

  while(parent != doc.body) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
};

calamine.propagatePreformatted = function(element) {
  if(!element) {
    return;
  }

  calamine.setPreformatted(element);
  // TODO: use querySelectorAll
  var descendants = element.getElementsByTagName('*');
  calamine.forEach(descendants, calamine.setPreformatted);
};

calamine.setPreformatted = function(element) {
  element.preformatted = 1;
};

calamine.trimNode = function(node) {

  if(node.parentElement.preformatted) {
    return;
  }

  if(calamine.isInline(node.previousSibling)) {
    if(!calamine.isInline(node.nextSibling)) {
      // It follows an inline element but does not precede one
      node.nodeValue = node.nodeValue.trimRight();
    }
  } else if(calamine.isInline(node.nextSibling)) {
    // It does not follow an inline element but it does
    // precede one
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    // It does not follow an inline element and it does
    // not precede one
    node.nodeValue = node.nodeValue.trim();
  }
};

// Remove the node if it does not have a value
calamine.filterEmptyNode = function(node) {
  if(!node) {
    return;
  }

  // TODO: should condition be node.nodeValue.length ?

  if(node.nodeValue) {
    return;
  }

  node.remove();
};


// Extract anchor features. Based on charCount from text features
calamine.deriveAnchorFeatures = function(anchor) {

  if(!anchor) {
    return;
  }

  if(!anchor.charCount) {
    return;
  }

  // Anchors without hrefs are considered basic inline elements
  // that can be unwrapped. We ignore such
  // anchors when setting anchorCharCount because
  // the boilerplate signal is stronger for hrefs. Side menus
  // typically use anchors for links, not for inline span effects.

  if(!anchor.hasAttribute('href')) {
    return;
  }

  anchor.anchorCharCount = anchor.charCount;

  var doc = anchor.ownerDocument;
  var parent = anchor.parentElement;

  // Random side thought: if the main function ever receives a
  // document without a body or without a root, is this an infinite
  // loop?

  while(parent != doc.body) {
    parent.anchorCharCount = (parent.anchorCharCount || 0 ) + anchor.charCount;
    parent = parent.parentElement;
  }
};

calamine.deriveSiblingFeatures = function(element) {

  // NOTE: previousSiblingCount has to be cached as each element
  // is visited. Calculating siblingCount could be deferred,
  // except that previousSiblingCount is not calculated if
  // siblingCount is 0.

  // Guard due to mutation-while-iterating issues
  if(!element) {
    return;
  }

  // Extra guard due to mutation-while-iterating issues
  if(!element.parentElement) {
    return;
  }

  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;

  if(!element.siblingCount) {
    return;
  }

  var pes = element.previousElementSibling;
  if(pes) {
    // Basic memoized approach that takes advantage of the fact that
    // pes was already visited and already has a count.
    element.previousSiblingCount = pes.previousSiblingCount + 1;
  }
};

calamine.isJavascriptAnchor = function(anchor) {
  // Guard due to mutation-while-iterating issues
  if(!anchor) {
    return false;
  }
  var href = anchor.getAttribute('href');
  return /^\s*javascript\s*:/i.test(href);
};

//Apply our 'model' to an element. We generate a score that is the
//sum of several terms.
calamine.scoreElement = function(element) {

  if(!element) {
    return;
  }

  element.score = element.score || 0;

  // TODO: anchors beginning with # before resolution are
  // probably table of contents links. We should differentiate
  // See http://plato.stanford.edu/entries/other-minds/
  // where the TOC was missed

  // Idea: rather than applying, we should be trying to
  // just get the score from each function and accumulating
  // it here. However, there is the issue that we implicitly
  // score other elements when scoring the current element
  // which means evil side effects

  calamine.applyTextScore(element);
  calamine.applyImageScore(element);
  calamine.applyPositionScore(element);
  calamine.applyTagNameScore(element);
  calamine.applyAttributeScore(element);
  calamine.applyAncestorBiasScore(element);
  calamine.applyDescendantBiasScore(element);
};

calamine.applyTextScore = function(element) {

  if(!element) {
    return;
  }

  // Elements without a character count, for whatever reason,
  // are not scored
  if(!element.charCount) {
    return;
  }

  var descriptor = calamine.getDescriptor(element);

  if(descriptor && descriptor.leaf) {
    // Leaf elements do not have a text score
    return;
  }

  // Apply character scores
  if(element.hasCopyrightSymbol) {
    element.score -= 40;
  }

  element.score += -20 * (element.bulletCount || 0);
  element.score += -10 * (element.pipeCount || 0);

  // Calculate anchor density and store it as an expando so that
  // it can optionally be exposed later
  element.anchorDensity = element.anchorCharCount / element.charCount;

  // TODO: this could still use a lot of improvement. Maybe look at
  // how any decision tree implementations have done it.

  // NOTE: we store a special branch property just for
  // debugging purposes when exposing attributes

  if(element.charCount > 1000) {
    if(element.anchorDensity > 0.35) {
      element.branch = 1;
      element.score += 50;
    } else if(element.anchorDensity > 0.2) {
      element.branch = 9;
      element.score += 100;
    } else if (element.anchorDensity > 0.1) {
      element.branch = 11;
      element.score += 100;
    } else if(element.anchorDensity > 0.05) {
      element.branch = 12;
      element.score += 250;
    } else {
      element.branch = 2;
      element.score += 300;
    }
  } else if(element.charCount > 500) {
    if(element.anchorDensity > 0.35) {
      element.branch = 3;
      element.score += 30;
    } else if(element.anchorDensity > 0.1) {
      element.branch = 10;
      element.score += 180;
    } else {
      element.branch = 4;
      element.score += 220;
    }
  } else if(element.charCount > 100) {
    if(element.anchorDensity > 0.35) {
      element.branch = 5;
      element.score += -100;
    } else {
      element.branch = 6;
      element.score += 60;
    }
  } else {
    if(element.anchorDensity > 0.35) {
      element.branch = 7;
      element.score -= 200;
    } else if(isFinite(element.anchorDensity)) {
      element.branch = 8;
      element.score += 20;
    } else {
      element.branch = 13;
      element.score += 5;
    }
  }
};

calamine.applyImageScore = function(element) {
  // NOTE: this expects dimensions to be defined for images or it
  // does not behave as well.

  // NOTE: is there some faster or more appropriate way than matches, like
  // element instanceof HTMLImageElement?
  // element instanceof HTMLImageElement works, but apparently there is a strange
  // issue with cross-frame compatibility.

  if(element.localName != 'img') {
    return;
  }

  var root = element.ownerDocument.body;

  var imageDescription = (element.getAttribute('alt') || '').trim();

  if(!imageDescription) {
    imageDescription = (element.getAttribute('title') || '').trim();
  }

  if(imageDescription) {
    // Award those images with alt or title text as being more
    // likely to be content. Boilerplate images are less likely to
    // have supporting text.
    element.score += 30;

    // Reward its parent
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 10;
    }

    // TODO: rather than an arbitrary amount, use keyword bias and also
    // consider a length based bias. If length based used the greater length
    // of either alt or title, do not just consider alt length, which this
    // branch precludes atm.
  }

  // TODO: maybe break this out into its own function

  if(element.parentElement && element.parentElement.matches('figure')) {
    var figCaptionNodeList = element.parentElement.getElementsByTagName('figcaption');
    if(figCaptionNodeList && figCaptionNodeList.length) {
      var firstFigCaption = figCaptionNodeList[0];
      var firstFigCaptionText = firstFigCaption.textContent;
      if(firstFigCaptionText) firstFigCaptionText = firstFigCaptionText.trim();
      if(firstFigCaptionText.length) {
        element.score += 30;
        if(element.parentElement && element.parentElement != root) {
          element.parentElement.score = (element.parentElement.score || 0) + 10;
        }
      }
    }
  }

  // Image branch property is just a helpful debugging property
  // TODO: rather than mutate the score property, it would be nicer to have
  // a separate function that returns a score. That does, however, make it
  // harder to set imageBranch. So the function would need destructuring which
  // we could mimic by returning [score, imageBranch].

  // TODO: is there some nicer way of updating the parentElement? I am not
  // entirely happy that we secretly update other elements here

  var area = calamine.getImageArea(element);

  if(!isFinite(area)) {
    element.imageBranch = 1;
    element.score += 100;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 100;
    }
  } else if(area > 1E5) {

    // TODO: make a decision about whether to use syntax like 1E5

    element.imageBranch = 2;
    element.score += 150;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 150;
    }
  } else if(area > 50000) {
    element.imageBranch = 3;
    element.score += 150;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 150;
    }
  } else if(area > 10000) {
    element.imageBranch = 4;
    element.score += 70;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 70;
    }
  } else if(area > 3000) {
    element.imageBranch = 5;
    element.score += 30;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 10;
    }
  } else if(area > 500) {
    element.imageBranch = 6;
    element.score += 10;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) + 10;
    }
  } else {
    element.imageBranch = 7;
    element.score -= 10;
    if(element.parentElement && element.parentElement != root) {
      element.parentElement.score = (element.parentElement.score || 0) - 10;
    }
  }
};

calamine.applyPositionScore = function(element) {

  // If there are no siblings, then score is not affected
  // TODO: is this right? This is no longer based on actual
  // distance from start but sibling count. But should it be?
  // If there are no siblings then it could still be near
  // start or mid. So this heuristic is messed up. If we were
  // dealing with an actual array of blocks it would make more sense
  // to look at block index. But this is within the hierarchy.
  if(!element.siblingCount) {
    return;
  }

  var prevCount = element.previousSiblingCount || 0;

  // Distance from start
  var startRatio = prevCount / element.siblingCount;
  element.score += 2 - 2 * startRatio;

  // Distance from middle
  var halfCount = element.siblingCount / 2;
  var middleOffset = Math.abs(prevCount - halfCount);
  var middleRatio = middleOffset / halfCount;
  element.score += 2 - 2 * middleRatio;
};

calamine.applyTagNameScore = function(element) {
  var descriptor = calamine.getDescriptor(element);

  // TODO: this check should not be necessary but some elements
  // get through (because white list filtering uses element.matches
  // but this uses element.localName lookup). Once whitespace
  // filtering is refactored, remove this condition
  if(!descriptor) {
    return;
  }

  // NOTE: not all props have a nameBias so use 0 fallback
  element.score += descriptor.nameBias || 0;
};

calamine.applyAttributeScore = function(element) {

  var text = element.getAttribute('id') || '';
  text += ' ';
  text += element.getAttribute('class') || '';
  text = text.trim().toLowerCase();

  if(!text) {
    return;
  }

  var keys = Object.keys(calamine.ID_CLASS_BIAS);
  var sum = calamine.sumAttributeBiases.bind(this, text);
  element.score += keys.reduce(sum, 0);
};

calamine.sumAttributeBiases = function(text, sum, key) {

  if(text.indexOf(key) > -1) {
    return sum + calamine.ID_CLASS_BIAS[key];
  }

  return sum;
};

calamine.applyAncestorBiasScore = function(element) {

  if(!element) {
    return;
  }

  var descriptor = calamine.getDescriptor(element);

  // Not all elements have descriptors
  if(!descriptor) {
    return;
  }

  var bias = descriptor.ancestorBias;

  // Not all elements have ancestor bias
  if(!bias) {
    return;
  }

  // TODO: use querySelectorAll?
  var descendants = element.getElementsByTagName('*');
  var update = calamine.updateDescendantWithAncestorBias.bind(this, bias);
  calamine.forEach(descendants, update);
};

// Private helper for applyAncestorBiasScore
calamine.updateDescendantWithAncestorBias = function(bias, element) {
  element.score = (element.score || 0) + bias;
};

calamine.applyDescendantBiasScore = function(element) {

  // Guard due to mutation while iterating issues
  if(!element) {
    return;
  }

  var descriptor = calamine.getDescriptor(element);

  // Not all elements have a descriptor. They should, because those
  // elements should be filtered out previously by the whitelist test,
  // but at this point in the design it is not guaranteed, so this
  // check is tentatively required.
  if(!descriptor) {
    return;
  }

  var bias = descriptor.descendantBias;

  // Not all descriptors have descendant bias
  if(!bias) {
    return;
  }

  var parent = element.parentElement;

  // Not all elements have parents (due to removal)
  // Ideally we should never see these elements but there are
  // issues with mutation-while-iterating
  if(!parent) {
    return;
  }

  // Avoid scoring of the body element
  if(parent == element.ownerDocument.body) {
    return;
  }

  parent.score = (parent.score || 0) + bias;
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
 * easy to incorporate this into the scoreElement function
 * and deprecate this function. In my head I am thinking of an analogy
 * to something like a YACC lexer that avoids doing peek operations
 * (lookahead parsing). We want something more stream-oriented.
 */
calamine.applySiblingBias = function(element) {
  if(!element) {
    return;
  }

  var elementBias = element.score > 0 ? 5 : -5;
  var sibling = element.previousElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.previousElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
    }
  }

  sibling = element.nextElementSibling;
  if(sibling) {
    sibling.score = sibling.score || 0;
    sibling.score += elementBias;
    sibling = sibling.nextElementSibling;
    if(sibling) {
      sibling.score = sibling.score || 0;
      sibling.score += elementBias;
    }
  }
};

calamine.forEach = function(list, func) {
  if(!list) {
    return;
  }

  Array.prototype.forEach.call(list, func);
};

calamine.filter = function(list, fn) {
  if(!list) {
    return [];
  }

  return Array.prototype.filter.call(list, fn);
};

calamine.map = function(list, fn) {
  if(!list) {
    return [];
  }

  return Array.prototype.map.call(list, fn);
};

calamine.reduce = function(list, func, initialValue) {
  if(!list) {
    return initialValue;
  }

  return Array.prototype.reduce.call(list, func, initialValue);
};

/**
 * Returns the frequency of ch in str.
 */
calamine.countChar = function(str, ch) {

  // I assume this is a hot spot so not using reduce approach nor
  // the split.length-1 approach. See
  // http://jsperf.com/count-the-number-of-characters-in-a-string

  for(var count = -1, index = 0; index != -1; count++) {
    index = str.indexOf(ch, index+1);
  }

  return count;
};

/**
 * A simple helper to use forEach against traversal API.
 *
 * @param element - the root element, only nodes under the root are
 * iterated. The root element itself is not 'under' itself so it is not
 * included in the iteration.
 * @param type - a type, corresponding to NodeFilter types
 * @param func - a function to apply to each node as it is iterated
 * @param filter - an optional filter function to pass to createNodeIterator
 */
calamine.forEachNode = function(element, type, func, filter) {
  var doc = element.ownerDocument,
      node,
      it = doc.createNodeIterator(element, type, filter);
  while(node = it.nextNode()) {
    func(node);
  }
};


/**
 * Removes the element but retains its children.
 */
calamine.unwrap = function(element) {

  // Guard due to mutation while iterating
  if(!element) {
    return;
  }

  // Extra guard to due mutation while iterating, due to
  // remove or unwrap
  if(!element.parentElement) {
    return;
  }

/*
  // TODO: test if this works

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

// Simple helper for passing to iterators like forEach
calamine.removeNode = function(node) {
  if(node) {
    node.remove();
  }
};

calamine.getDescriptor = function(element) {
  // NOTE: element lookup is done using localName (lowercase).
  // Using element.matches provides inconsistent behavior against
  // namespaced names  (e.g. g:plusone, fb:like, l:script)
  // Using element.tagName is uppercase, but includes namespace
  // Maybe tagName is simpler?

  return element && calamine.ELEMENT_POLICY[element.localName];
};

// Simple "private" helper for looking up properties in the policy map
calamine.getPolicyProp = function(prop, key) {
  var desc = calamine.ELEMENT_POLICY[key];
  return desc && desc[prop];
};

calamine.isInline = function(element) {

  // Element may be undefined since the caller does not check
  // if node.nextSibling or node.previousSibling are defined
  // before the call. This is expected.
  if(!element) {
    return false;
  }

  // TODO: why is this condition ever triggered? Is chrome not
  // always renormalizing text nodes after dom mutation? How is it
  // possible for two text nodes to be adjacent?
  if(element.nodeType != Node.ELEMENT_NODE) {
    // This condition definitely happens. It looks like
    // it is always an adjacent text node that contains
    // an empty string.
    // TODO: does this mean it is inline? should this
    // be returning true?
    return false;
  }

  // TODO: random thought, is it possible to just check
  // that element.style.display == 'inline' or something to
  // that effect? Or is that too much deference to native
  // behavior? No, it looks like display is not set at this
  // point

  var desc = calamine.getDescriptor(element);
  return desc.inline;
};


// Element policies name-to-policy map
calamine.ELEMENT_POLICY = {
  a: {
    inline: true,
    nameBias: -1,
    // Only certain anchors are unwrappable
    unwrappable: false
  },
  abbr: {inline: true},
  acronym: {inline: true},
  address: {inline: true, nameBias: -3},
  applet: {blacklisted: true, leaf: true},
  area: {leaf: true},
  article: {nameBias: 100, unwrappable: true},
  aside: {nameBias: -200},
  audio: {leaf: true},
  b: {descendantBias: 1, inline: true},
  base: {blacklisted: true, leaf: true},
  basefont: {blacklisted: true, leaf: true},
  bdi: {inline: true},
  bdo: {inline: true},
  bgsound: {blacklisted: true, leaf: true},
  big: {unwrappable: true},
  blink: {inline: true, unwrappable: true},
  blockquote: {ancestorBias: 10, descendantBias: 3, nameBias: 5},
  body: {unwrappable: true},
  br: {leaf: true},
  button: {blacklisted: true, nameBias: -100},
  canvas: {leaf: true, nameBias: 3},
  caption: {},
  center: {unwrappable: true},
  cite: {inline: true},
  code: {ancestorBias: 10, descendantBias: 2, inline: true, preformatted: true},
  col: {leaf: true},
  colgroup: {unwrappable: true},
  command: {blacklisted: true, leaf: true},
  data: {inline: true, unwrappable: true},
  datalist: {blacklisted: true},
  details: {unwrappable: true},
  dialog: {blacklisted: true},
  dir: {ancestorBias: -5, nameBias: -20},
  dd: {nameBias: -3},
  del: {inline: true},
  dfn: {inline: true},
  div: {ancestorBias: 1, nameBias: 20, unwrappable: true},
  dl: {ancestorBias: -5, nameBias: -10},
  dt: {nameBias: -3},
  em: {descendantBias: 1, inline: true},
  embed: {blacklisted: true, leaf: true},
  fieldset: {blacklisted: true},
  figcaption: {nameBias: 10},
  figure: {nameBias: 10},
  font: {inline: true, unwrappable: true},
  footer: {nameBias: -20, unwrappable: true},
  form: {nameBias: -20, unwrappable: true},
  frame: {blacklisted: true, leaf: true},
  frameset: {blacklisted: true},
  head: {blacklisted: true},
  header: {ancestorBias: -5, nameBias: -5, unwrappable: true},
  help: {unwrappable: true},
  hgroup: {unwrappable: true},
  hr: {leaf: true},
  html: {blacklisted: true, unwrappable: true},
  h1: {descendantBias: 1, nameBias: -2},
  h2: {descendantBias: 1, nameBias: -2},
  h3: {descendantBias: 1, nameBias: -2},
  h4: {descendantBias: 1, nameBias: -2},
  h5: {descendantBias: 1, nameBias: -2},
  h6: {descendantBias: 1, nameBias: -2},
  i: {descendantBias: 1, inline: true},
  iframe: {blacklisted: true, leaf: true},
  ilayer: {unwrappable: true},
  img: {leaf: true},
  input: {blacklisted: true, leaf: true},
  ins: {inline: true},
  insert: {unwrappable: true},
  isindex: {blacklisted: true},
  label: {unwrappable: true},
  layer: {unwrappable: true},
  legend: {unwrappable: true},
  li: {ancestorBias: -3, nameBias: -20},
  link: {blacklisted: true, leaf: true},
  kbd: {inline: true},
  keygen: {},
  main: {nameBias: 100, unwrappable: true},
  mark: {inline: true},
  marquee: {unwrappable: true},
  map: {inline: true},
  math: {blacklisted: true},
  menu: {ancestorBias: -5, blacklisted: true},
  menuitem: {ancestorBias: -5, blacklisted: true},
  meta: {blacklisted: true, leaf: true},
  meter: {inline: true, unwrappable: true},
  multicol: {unwrappable: true},
  nav: {ancestorBias: -20, nameBias: -50},
  nobr: {unwrappable: true},
  noembed: {unwrappable: true},
  noframes: {blacklisted: true},
  noscript: {unwrappable: true},
  object: {blacklisted: true, leaf: true},
  ol: {ancestorBias: -5, nameBias: -20},
  optgroup: {blacklisted: true},
  option: {blacklisted: true, leaf: true},
  output: {blacklisted: true},
  p: {ancestorBias: 10, descendantBias: 5, nameBias: 10},
  param: {blacklisted: true, leaf: true},
  plaintext: {unwrappable: true},
  pre: {ancestorBias: 10, descendantBias: 2, nameBias: 5, preformatted: true},
  progress: {blacklisted: true, leaf: true},
  q: {inline: true},
  rect: {},
  rp: {inline: true},
  rt: {inline: true},
  ruby: {ancestorBias: 5, nameBias: 5, preformatted: true},
  s: {},
  samp: {inline: true},
  script: {blacklisted: true},
  section: {nameBias: 10, unwrappable: true},
  select: {blacklisted: true},
  small: {inline: true, nameBias: -1, unwrappable: true},
  source: {leaf: true},
  spacer: {blacklisted: true},
  span: {descendantBias: 1, inline: true, unwrappable: true},
  strike: {inline: true},
  strong: {descendantBias: 1, inline: true},
  style: {blacklisted: true},
  sub: {descendantBias: 2, inline: true},
  summary: {ancestorBias: 2, descendantBias: 1, nameBias: 5},
  sup: {descendantBias: 2, inline: true},
  svg: {leaf: true},
  table: {ancestorBias: -2},
  tbody: {unwrappable: true},
  td: {nameBias: 3},
  textarea: {blacklisted: true, leaf: true, preformatted: true},
  tfoot: {unwrappable:true},
  th: {nameBias: -3},
  thead: {unwrappable: true},
  time: {descendantBias: 2, inline: true, nameBias: 2},
  title: {blacklisted: true, leaf: true},
  tr: {nameBias: 1},
  track: {leaf:true},
  tt: {inline: true},
  u: {inline: true},
  ul: {ancestorBias: -5, nameBias: -20},
  'var': {inline: true},
  video: {leaf: true},
  wbr: {},
  xmp: {blacklisted: true, preformatted: true}
};

calamine.ID_CLASS_BIAS = {
  about: -35,
  'ad-': -100,
  ads: -50,
  advert: -100,
  article: 100,
  articleheadings: -50,
  attachment: 20,
  author: 20,
  blog: 20,
  body: 50,
  brand: -50,
  breadcrumbs: -20,
  button: -100,
  byline: 20,
  caption: 10,
  carousel: 30,
  column: 10,
  combx: -20,
  comic: 75,
  comment: -300,
  community: -100,
  component: -50,
  contact: -50,
  content: 50,
  contenttools: -50,
  date: -50,
  dcsimg: -100,
  dropdown: -100,
  entry: 50,
  excerpt: 20,
  facebook: -100,
  fn:-30,
  foot: -100,
  footnote: -150,
  google: -50,
  head: -50,
  hentry:150,
  inset: -50,
  insta: -100,
  left: -75,
  legende: -50,
  license: -100,
  link: -100,
  logo: -50,
  main: 50,
  mediaarticlerelated: -50,
  menu: -200,
  menucontainer: -300,
  meta: -50,
  nav: -200,
  navbar: -100,
  page: 50,
  pagetools: -50,
  parse: -50,
  pinnion: 50,
  popular: -50,
  popup: -100,
  post: 50,
  'post-attributes': -50,
  power: -100,
  print: -50,
  promo: -200,
  reading: 100,
  recap: -100,
  relate: -300,
  replies: -100,
  reply: -50,
  retweet: -50,
  right: -100,
  scroll: -50,
  share: -200,
  'share-tools': -100,
  shop: -200,
  shout: -200,
  shoutbox: -200,
  side: -200,
  sig: -50,
  social: -200,
  socialnetworking: -250,
  source:-50,
  sponsor: -200,
  story: 50,
  storytopbar: -50,
  strycaptiontxt: -50,
  stryhghlght: -50,
  strylftcntnt: -50,
  stryspcvbx: -50,
  subscribe: -50,
  summary:50,
  tag: -100,
  tags: -100,
  text: 20,
  time: -30,
  timestamp: -50,
  title: -100,
  tool: -200,
  twitter: -200,
  txt: 50,
  'utility-bar': -50,
  vcard: -50,
  week: -100,
  welcome_form: -50,
  widg: -200,
  zone: -50
};
