// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var calamine = {};

/**
 * Returns a DocumentFragment with some boilerplate removed
 */
calamine.transformDocument = function(doc, options) {
  options = options || {};

  if(!doc.body) {
    console.warn('Missing body element in document %o', doc);
    return;
  }

  var elements = doc.body.querySelectorAll('*');
  var anchors = doc.body.querySelectorAll('a');
  calamine.forEachNode(doc.body, NodeFilter.SHOW_COMMENT, calamine.removeNode);
  var blacklistedElements = doc.body.querySelectorAll(calamine.SELECTOR_BLACKLIST);
  calamine.forEach(blacklistedElements, calamine.filterBlacklistedElement);
  calamine.forEach(elements, calamine.filterNonWhitelistedElement);
  var images = doc.body.querySelectorAll('img');
  calamine.forEach(images, calamine.filterImage);
  var noscripts = doc.body.querySelectorAll('noscript');
  calamine.forEach(noscripts, calamine.unwrapElement);
  var invisibles = calamine.filter(elements, calamine.isInvisible);
  invisibles.forEach(calamine.removeNode);

  // Not yet implemented
  // BUGGY: in process of fixing
  // calamine.forEach(doc.body.querySelectorAll('br,hr'), calamine.testSplitBreaks);

  /*
  One possible issue with this is that is screws over the anchor
  density metric. Maybe a better tactic would be to just empty
  the href value in this case? Or remove the href attribute?
  Removing the href attribute would mean that anchor desntiy would
  still be effected.  The function in derive-anchor-features just
  requires the presence of the href attribute to derive
  anchorCharCount. Therefore the best best would be to set it
  to empty?
  But then this leads to the problem if the anchor makes it through
  the gauntlet, in that we end up presenting bad anchors to the viewer
  Maybe we could later filter out empty href attributes? That isn't
  just normal minification that has a semantic effect on the text so
  it would be important.
  Or we could remove the has-href check in derive-anchor-features?
  */
  var scriptAnchors = calamine.filter(anchors, calamine.isJavascriptAnchor);
  scriptAnchors.forEach(calamine.unwrapElement);

  // TODO: the above might be what is causing text from links to appear
  // without delimiting whitespace. Maybe I need to insert a text node
  // spacer following each unwrapped anchor?

  // Marks code/pre elements as whitespaceImportant and then marks all
  // direct and indirect descendant elements as whiteSpaceImportant.
  // Propagating this property from the top down (cascading) enables
  // the trimNode function to quickly determine whether its nodeValue is
  // trimmable, as opposed to having the trimNode function search each
  // text node's axis (path from root) for the presence of a pre/code element.
  var preformatted = doc.body.querySelectorAll(calamine.SELECTOR_PREFORMATTED);
  calamine.forEach(preformatted, calamine.propagatePreformatted);

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // this transform should actually be its own explicit step. Along with transforms
  // for other purposes. For example, when deriving text features, I am not always
  // counting variations of the features. I think this should be called something
  // like normalization or canonicalization

  // Side thought: Why mutate? Why not just expand the query to account for variations?
  // This is a similar thought about element removal, unwrapping, etc. Why modify
  // the original if we are returning a representation of the original?

  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, calamine.trimNode);
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, calamine.filterEmptyNode);

  calamine.filterEmptyElements(doc);

  // Feature extraction operations

  // Extract text features for text nodes and then propagate those properties
  // upward in the dom (up to root)
  // TODO: support <body>text</body> (text under root node)
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT,
    calamine.deriveTextFeatures);

  calamine.forEach(anchors, calamine.deriveAnchorFeatures);

  calamine.forEach(elements, calamine.deriveSiblingFeatures);

  // Score
  calamine.forEach(elements, calamine.scoreElement);

  // NOTE: this next function must be separate (tentatively) because
  // it is based on a ratio of neigboring scores, which mean the
  // score must have settled, which is not done until the first
  // pass completes. so we have to have a separate pass, or we
  // have to redesign applySibBias a different way. E.g. use some
  // constant score.
  // I also want to redesign applySibBias so it is more 'online'
  // in the sense that it only needs to react to the scores of
  // elements preceding or above it in depth-first-search order.
  // Once the above two tasks are tackled then the call to
  // applySiblingBias can be done as a part of scoreElement in
  // the first pass, making scoring a one pass approach
  calamine.forEach(elements, calamine.applySiblingBias);

  // Post processing and best element identification
  if(options.FILTER_ATTRIBUTES) {
    calamine.forEach(elements, calamine.filterAttributes);
  }

  // Score the root element in preparation for finding the
  // best element.
  doc.body.score = -Infinity;

  var bestElement = calamine.reduce(elements,
    calamine.getMaxScore, doc.body);

  if(options.UNWRAP_UNWRAPPABLES) {

    // The best element could be something we would prefer to unwrap
    // but the current approach relies on using the element as the
    // return value so we unwrap everything but the best element.

    // TODO: Special query to unwrap anchors without href values
    // a:not([href])


    // Unwrap everything else
    var unwrappables = doc.body.querySelectorAll(
      calamine.SELECTOR_UNWRAPPABLE);
    var notBest = calamine.isNotBestElement.bind(this, bestElement);
    var lessBest = calamine.filter(unwrappables, notBest);
    lessBest.forEach(calamine.unwrapElement);
  }

  // TODO: trim the element. E.g. remove leading or trailing
  // <br> elements and such. Look at the old sanitizer code
  // that was doing trim document

  var expose = calamine.exposeAttributes.bind(this, options);
  calamine.forEach(elements, expose);

  if(options.HIGHLIGHT_MAX_ELEMENT) {
    if(bestElement) {
      bestElement.style.border = '2px solid green';
    }
  }

  // TODO: cleanup expando properties before returning?

  return calamine.createFragment(doc, bestElement);
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
    return previous;
  }

  // Some elements may not have a score
  if(!current.hasOwnProperty('score')) {
    return previous;
  }

  // Favor previous in case of equal score
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
  if(options.SHOW_COPYRIGHT_COUNT && element.copyrightCount)
    element.setAttribute('copyrightCount', element.copyrightCount);
  if(options.SHOW_DOT_COUNT && element.dotCount)
    element.setAttribute('dotCount', element.dotCount);
  if(options.SHOW_IMAGE_BRANCH && element.imageBranch)
    element.setAttribute('imageBranch', element.imageBranch);
  if(options.SHOW_PIPE_COUNT && element.pipeCount)
    element.setAttribute('pipeCount', element.pipeCount);
  if(options.SHOW_SCORE && element.score)
    element.setAttribute('score', element.score.toFixed(2));
};

// TODO: think of a better name here. createFragment is maybe
// too specific to the type of result to return, in the event this
// is changed in the future. Or maybe just delete this and move
// it back into transformDocument
calamine.createFragment = function(doc, bestElement) {

  var results = doc.createDocumentFragment();
  var append = Node.prototype.appendChild.bind(results);

  if(bestElement == doc.body) {
    //Array.prototype.forEach.call(doc.body.childNodes, append);
    calamine.forEach(doc.body.childNodes, append);
  } else {
    results.appendChild(bestElement);
  }

  return results;
};

/**
 * Whether an element is invisible
 */
calamine.isInvisible = function(element) {

  // Guard due to remove-while-iterating issues
  if(!element) {
    return false;
  }

  // NOTE: element.offsetWidth < 1 || element.offsetHeight < 1; ??
  // saw that somewhere, need to read up on offset props again.
  // Something about emulating how jquery does it?

  if(element.style.display == 'none') {
    return true;
  }

  if(element.style.visibility == 'hidden') {
    return true;
  }

  if(element.style.visibility == 'collapse') {
    return true;
  }

  // TODO: this should not really just be absolutely invisible, but also
  // nearly-invisible. More like opacity < 0.3, where 0.3 is the assumed
  // threshold where text becomes non-visible
  var opacity = parseFloat(element.style.opacity);
  if(opacity === 0) {
    return true;
  }

  // TODO: consider if(element.hidden) ?

  return false;
};

calamine.filterEmptyElements = function(doc) {
  // TODO: This needs a lot of cleanup

  // NOTE: the :empty pseudoselector does not produce the
  // desired behavior so we have to roll our own

  // Now remove all empty-like elements from the document. If removing
  // an element would change the state of the element's parent to also
  // meet the empty-like criteria, then the parent is also removed, and
  // so forth, up the hierarchy, but stopping before doc.body.

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

  // NOTE: stack.length might have a really surprising issue, I forget
  // exactly but there is possibly something unexpected regarding
  // popping elements from an array until it is empty, like,
  // the length gets incorrectly updated or something. Something I was
  // reading on stackoverflow about emptying arrays.

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

    // If there was no parent (how would that ever happen?)
    // or the parent is the root, then do not add the new
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
  return !element.firstChild &&
    !element.matches(calamine.SELECTOR_LEAF);
};

calamine.testSplitBreaks = function(str) {
  // Trying to break apart break rule elements by block
  // UNDER HEAVY DEVELOPMENT

  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

  // TODO: use the isInline function defined somewhere, do not redefine
  var isInline = function(element) {
    return element.matches('a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
      'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var');
  };

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
  var body = doc.body;
  var parent = node.parentElement;
  var value = node.nodeValue;

  // TODO: this should be using the copyright character itself as well
  // TODO: this should be acting upon text that normalized the variants
  // TODO: this should be discrete not continuous
  parent.copyrightCount = /[\u00a9]|&copy;|&#169;/i.test(
    value) ? 1 : 0;

  // TODO: this should also be looking for the dot character itself
  parent.dotCount = calamine.countChar(value,'\u2022');

  // TODO: this should also be looking at other expressions of pipes
  parent.pipeCount = calamine.countChar(value,'|');

  // NOTE: we don't care about setting the count in the node itself
  // just in the parent element path to body

  var charCount = value.length - value.split(/[\s\.]/g).length + 1;

  while(parent != body) {
    parent.charCount = (parent.charCount || 0) + charCount;
    parent = parent.parentElement;
  }
};

calamine.propagatePreformatted = function(element) {
  if(!element) {
    return;
  }

  calamine.setPreformatted(element);
  var descendants = element.getElementsByTagName('*');
  calamine.forEach(descendants, calamine.setPreformatted);
}

calamine.setPreformatted = function(element) {
  element.preformatted = 1;
};

calamine.trimNode = function(node) {

  // If whitespace is important then we do not trim
  if(node.parentElement.preformatted) {
    return;
  }

  // A node is either sandwiched between inline elements
  // or just preceding one or just trailing one

  // NOTE: are we actually just looking up the function
  // to use here? like a factory? E.g. get a function that
  // returns String.prototype.trimX, and then call
  // that function?
  if(calamine.isInline(node.previousSibling)) {
    if(!calamine.isInline(node.nextSibling)) {
      // It follows an inline element but does not precede one
      // so only trim the right side
      node.nodeValue = node.nodeValue.trimRight();
    } else {
      // It is sandwiched and should not be modified
    }
  } else if(calamine.isInline(node.nextSibling)) {
    // It does not follow an inline element but it does
    // precede one so only trim the left side
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    // It does not follow an inline element and it does
    // not precede one, so trim both sides
    node.nodeValue = node.nodeValue.trim();
  }
};

// Remove the node if it does not have a value
calamine.filterEmptyNode = function(node) {
  if(!node) {
    return;
  }

  // TODO: think more about what happens if
  // node value is something like '0'
  // e.g. should condition include node.nodeValue.length ?

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

  // Guard due to mutation-while-iterating issues
  if(!element) {
    return;
  }

  // Extra guard due to mutation-while-iterating issues
  if(!element.parentElement) {
    return;
  }

  // Cache a count of siblings and a count of prior siblings
  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;

  // If there are no siblings, then there are obviously no previous
  // siblings, so we are done
  if(!element.siblingCount) {
    return;
  }

  // TODO: this could actually be improved by recognizing that
  // this function is called in document order over the elements at the
  // same level. Therefore we could easily just check if there
  // a previous sibling. If there is not, then we know the
  // previous sibling count is 0. If there is, then we know the
  // previousSiblingCount is just 1 + the previous
  // previousSiblingCount
  // One less inner loop would be nice.
  // It also makes the call more 'online' in that the back-history
  // buffer of recently processed elements could be 'smaller'
  // (of course, the entire doc is in mem so splitting hairs)

  var sibling = element.previousElementSibling;
  while(sibling) {
    element.previousSiblingCount++;
    sibling = sibling.previousElementSibling;
  }
};

calamine.isJavascriptAnchor = function(anchor) {

  // Guard due to mutation-while-iterating issues
  if(!anchor) {
    return false;
  }

  var href = anchor.getAttribute('href');

  // NOTE: this returns the desired result even
  // if href is undefined
  return /^\s*javascript\s*:/i.test(href);
};

//Apply our 'model' to an element. We generate a score that is the
//sum of several terms.
calamine.scoreElement = function(element) {

  if(!element) {
    return;
  }

  element.score = element.score || 0;

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

  if(!element.charCount) {
    return;
  }

  if(element.matches(calamine.SELECTOR_LEAF)) {
    return;
  }

  element.score += -20 * (element.copyrightCount || 0);
  element.score += -20 * (element.dotCount || 0);
  element.score += -10 * (element.pipeCount || 0);

  // Calculate anchor density and store it as an expando
  element.anchorDensity = element.anchorCharCount / element.charCount;

  // TODO: this could still use a lot of improvement. Maybe look at
  // how any decision tree implementations have done it.

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
      // BUG: duplicate branch id
      element.branch = 8;
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

  if(!element.matches('img')) {
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
  var descriptor = calamine.ELEMENT[element.localName];

  // All elements should have passed through the whilelist
  // filter by the time this function is called so this check
  // should not be necessary, but apparently some elements
  // somehow are remaining? Ok it is the elements with
  // namespaces. Wait a sec, why the hell is localName including
  // the namespace now? And how are they making it past the
  // white list filter?
  if(!descriptor) {
    //console.warn('No descriptor for %o with local name %s', element, element.localName);
    return;
  }

  // NOTE: not all props have a nameBias so use 0 fallback
  element.score += descriptor.nameBias || 0;
};

calamine.applyAttributeScore = function(element) {

  var text = (element.getAttribute('id') || '');
  text += ' ';
  text += (element.getAttribute('class') || '');
  text = text.trim().toLowerCase();

  if(!text) {
    return;
  }

  // TODO: rather than bind and create the sum function,
  // use the thisArg parameter to reduce and change
  // sumAttributeBiases to access it
  var sum = calamine.sumAttributeBiases.bind(this, text);
  var keys = Object.keys(calamine.ID_CLASS_BIAS);

  element.score += keys.reduce(sum, 0);

  // TODO: propagate partial attribute text bias to children, in the same
  // way that certain ancestor elements bias their children? After all,
  // <article/> should be nearly equivalent to <div id="article"/> ? Does
  // this encroach on tag name bias though?
};

calamine.sumAttributeBiases = function(text, sum, key, index) {

  // TODO: is there something like string.contains that is
  // more boolean? We don't care about the index, maybe it would
  // be more semantically accurate

  if(text.indexOf(key) > -1) {
    return sum + calamine.ID_CLASS_BIAS[key];
  }

  return sum;
};

calamine.applyAncestorBiasScore = function(element) {

  if(!element) {
    return;
  }

  var descriptor = calamine.ELEMENT[element.localName];

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

  var descriptor = calamine.ELEMENT[element.localName];

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
 *
 * TODO: instead of biasing the siblings based on the element,
 * bias the element itself based on its siblings. Rather, only
 * bias the element itself based on its prior sibling. That way,
 * we can bias while iterating more easily because we don't have to
 * abide the requirement that nextSibling is scored. Then it is
 * easy to incorporate this into the scoreElement function
 * and deprecate this function. In my head I am thinking of an analogy
 * to something like a YACC lexer that avoids doing peek operations
 * (lookahead parsing). We want something more stream-oriented.
 *
 * Want an 'online' approach (not in the Internet sense)
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

calamine.filterImage = function(image) {

  // Guard against mutation-while-iterating issues
  if(!image) {
    return;
  }

  var source = image.getAttribute('src');
  if(source) {
    source = source.trim();
  }

  // Remove sourceless images. Technically we should never encounter such
  // images, and this filter's purpose is closer to minifying than
  // filtering for statistical reasons. I also am not clear how browsers
  // react to sourceless images, and whether behavior varies. I assume such
  // images would never be displayed and not affect layout. It would be
  // something to eventually learn about.
  if(!source) {
    image.remove();
    return;
  }

  // NOTE: I assume that tracker images are not a good indicator of whether
  // the containing element is boilerplate. They seem to be randomly
  // distributed. I admit my sample size is pretty small and this could turn
  // out to be incorrect, but I am fairly confident for now.
  // I suppose another way to look at it however, since we are not testing
  // both dimensions at once, is that another common technique before CSS
  // was widespread was the whole 1px width trick to simulate box-shadow. In that
  // sense, if the ratio of the image is something like 1px to 1000px or 1000px to
  // 1px, such images are indicators of section boundaries. I am not sure of the
  // strength of the indication. It might be a heuristic kind of like what
  // MS VIPS paper mentioned.

  // Remove one-dimensional images. Typically these are tracker images that
  // are a part of boilerplate.
  if(image.width === 1 || image.height === 1) {
    image.remove();
    return;
  }
};

calamine.filterBlacklistedElement = function(element) {

  if(!element) {
    return;
  }

  var doc = element.ownerDocument;
  if(!doc) {
    return;
  }

  if(!doc.contains(element)) {
    return;
  }

  element.remove();
};

calamine.filterNonWhitelistedElement = function(element) {

  if(!element) {
    return;
  }

  var doc = element.ownerDocument;
  if(!doc) {
    return;
  }

  if(!doc.contains(element)) {
    return;
  }

  // TODO: change this to use localName. For consistency. This causes
  // a strange side effect where custom namespaced elements are allowed through
  // and therefore not removed (e.g. g:plusone, fb:like, l:script)

  var descriptor = calamine.ELEMENT[element.localName];

  if(descriptor) {
    return;
  }

  //if(element.matches(calamine.SELECTOR_WHITELIST)) {
  //  return;
  //}

  console.debug('Removing unknown element %o', element);

  element.remove();
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

  var it = element.ownerDocument.createNodeIterator(
    element, type, filter);
  var node = it.nextNode();
  while(node) {
    func(node);
    node = it.nextNode();
  }
};

/**
 * Returns true if the node is a defined element that
 * is considered inline. Elements by default behave
 * according to either "display: block" or "display: inline". This can be changed
 * by CSS but we ignore that and use basic assumptions. In other words,
 * <p> is not inline and <span> is inline.
 *
 * Note: divs are technically inline, but are frequently used instead as blocks, so
 * divs are not considered inline.
 *
 * TODO: rename to something like isDefaultInlineElement
 * TODO: why are we checking if node is defined here?
 * TODO: why are we checking if node is an element? When is this ever called on
 * nodes and not elements?
 */
calamine.isInline = function(node) {

  // NOTE: this is called from within trimNode which is
  // handling nodes, which may be adjacent to other nodes
  // somehow (despite presumably being normalized), so
  // we have to check that the node passed here is
  // an element

  // TODO: random thought, is it possible to just check
  // that element.style.display == 'inline' or something to
  // that effect? Or is that too much deference to native
  // behavior?

  return node && node.nodeType == Node.ELEMENT_NODE &&
    node.matches(calamine.SELECTOR_INLINE);
};

/**
 * Removes the element but retains its children.
 */
calamine.unwrapElement = function(element) {
  // We have to check element is defined since this is called every iteration
  // and a prior iteration may have somehow removed the element.

  // We check if parent element is defined just in case this is somehow
  // called on an element that was removed.
  // This function can work on detached nodes, but only if those nodes still have a
  // parentElement defined. The root element/node of a detached hierarchy does not
  // have a parentElement, but its children do have parents despite being deatched
  // from the main document.
  // NOTE: detachment can be tested easily, albeit inefficiently, by using
  // doc.body.contains(element).

  // NOTE: this function is not currently designed to perform well on
  // attached nodes, because it causes a reflow per move (per iteration
  // of the while loop below). It could be improved by moving the child
  // nodes into a DocumentFragment and then by replacing the original parent
  // with the fragment, which would cause fewer reflows. It could probably
  // be further improved by detaching the element itself first, then
  // building the fragment, and then inserting the fragment in the place
  // of the element (which means we need to store a reference to prev or
  // next sibling and also a reference to the parent element prior to
  // removing the element).

  if(element && element.parentElement) {
    while(element.firstChild) {
      element.parentElement.insertBefore(element.firstChild, element);
    }

    element.remove();
  }
};

// A simple helper for passing to iterators like forEach
calamine.removeNode = function(node) {
  // TODO: can i use Node/Element.prototype.remove instead?

  // This uses the new node.remove function instead of
  // node.parentNode.removeChild(node).
  if(node) {
    node.remove();
  }
};

calamine.lookupElementProp = function(prop, key) {
  var desc = calamine.ELEMENT[key];
  return desc && desc[prop];
};

calamine.ELEMENT = {
  a: {
    inline: true,
    nameBias: -1
  },
  abbr: {
    inline: true
  },
  acronym: {
    inline: true
  },
  address: {
    inline: true,
    nameBias: -3
  },
  applet: {
    blacklisted: true,
    leaf: true
  },
  area: {},
  article: {
    nameBias: 100,
    unwrappable: true
  },
  aside: {
    nameBias: -200
  },
  audio: {
    leaf: true
  },
  b: {
    descendantBias: 1,
    inline: true
  },
  base: {
    blacklisted: true
  },
  basefont: {
    blacklisted: true
  },
  bdi: {
    inline: true
  },
  bdo: {
    inline: true
  },
  bgsound: {
    blacklisted: true
  },
  big: {
    unwrappable: true
  },
  blink: {
    inline: true,
    unwrappable: true
  },
  blockquote: {
    ancestorBias: 10,
    descendantBias: 3,
    nameBias: 5
  },
  body: {
    unwrappable: true
  },
  br: {
    leaf: true
  },
  button: {
    blacklisted: true,
    nameBias: -100
  },
  canvas: {
    leaf: true
  },
  caption: {},
  center: {
    unwrappable: true
  },
  cite: {
    inline: true
  },
  code: {
    ancestorBias: 10,
    descendantBias: 2,
    inline: true,
    preformatted: true
  },
  col: {},
  colgroup: {},
  command: {
    blacklisted: true
  },
  data: {},
  datalist: {
    blacklisted: true
  },
  details: {
    unwrappable: true
  },
  dialog: {
    blacklisted: true
  },
  dir: {},
  dd: {
    nameBias: -3
  },
  del: {
    inline: true
  },
  dfn: {
    inline: true
  },
  div: {
    ancestorBias: 1,
    nameBias: 20,
    unwrappable: true
  },
  dl: {
    ancestorBias: -5,
    nameBias: -10
  },
  dt: {
    nameBias: -3
  },
  em: {
    descendantBias: 1,
    inline: true
  },
  embed: {
    blacklisted: true,
    leaf: true
  },
  entry: {},
  fieldset: {
    blacklisted: true
  },
  figcaption: {
    nameBias: 10
  },
  figure: {
    nameBias: 10
  },
  font: {
    unwrappable: true
  },
  footer: {
    nameBias: -20,
    unwrappable: true
  },
  form: {
    nameBias: -20,
    unwrappable: true
  },
  frame: {
    blacklisted: true,
    leaf: true
  },
  frameset: {
    blacklisted: true
  },
  head: {
    blacklisted: true
  },
  header: {
    ancestorBias: -5,
    nameBias: -5,
    unwrappable: true
  },
  help: {
    unwrappable: true
  },
  hgroup: {},
  hr: {
    leaf: true
  },
  html: {
    blacklisted: true,
    unwrappable: true
  },
  h1: {
    descendantBias: 1,
    nameBias: -2
  },
  h2: {
    descendantBias: 1,
    nameBias: -2
  },
  h3: {
    descendantBias: 1,
    nameBias: -2
  },
  h4: {
    descendantBias: 1,
    nameBias: -2
  },
  h5: {
    descendantBias: 1,
    nameBias: -2
  },
  h6: {
    descendantBias: 1,
    nameBias: -2
  },
  i: {
    descendantBias: 1,
    inline: true
  },
  iframe: {
    blacklisted: true,
    leaf: true
  },
  ilayer: {
    // TODO: treat like div?
  },
  img: {
    leaf: true
  },
  input: {
    blacklisted: true
  },
  ins: {
    inline: true
  },
  insert: {
    unwrappable: true
  },
  inset: {},
  label: {
    unwrappable: true
  },
  layer: {
    // TODO: treat like div?
    unwrappable: true
  },
  legend: {
    // NOTE: should legend not be blacklisted?
    unwrappable: true,
    blacklisted: true
  },
  li: {
    ancestorBias: -3,
    nameBias: -20
  },
  link: {
    blacklisted: true
  },
  kbd: {
    inline: true
  },
  keygen: {},
  main: {},
  mark: {},
  marquee: {},
  map: {},
  math: {
    blacklisted: true
  },
  menu: {},
  menuitem: {},
  meta: {
    blacklisted: true
  },
  meter: {},
  multicol: {},
  nav: {
    ancestorBias: -20,
    nameBias: -50
  },
  nobr: {
    unwrappable: true
  },
  noembed: {},
  noframes: {
    blacklisted: true
  },
  noscript: {
    unwrappable: true
  },
  object: {
    blacklisted: true,
    leaf: true
  },
  ol: {
    ancestorBias: -5,
    nameBias: -20
  },
  optgroup: {
    blacklisted: true
  },
  option: {
    blacklisted: true
  },
  output: {
    blacklisted: true
  },
  p: {
    ancestorBias: 10,
    descendantBias: 5,
    nameBias: 10
  },
  param: {
    blacklisted: true,
    leaf: true
  },
  plaintext: {
    // TODO: is plaintext whitespace important?
    unwrappable: true
  },
  pre: {
    ancestorBias: 10,
    descendantBias: 2,
    nameBias: 5,
    preformatted: true
  },
  progress: {},
  q: {
    inline: true
  },
  rect: {},
  rp: {},
  rt: {},
  ruby: {
    ancestorBias: 5,
    nameBias: 5,
    preformatted: true
  },
  s: {},
  samp: {
    inline: true
  },
  script: {
    blacklisted: true
  },
  section: {
    nameBias: 10,
    unwrappable: true
  },
  select: {
    blacklisted: true
  },
  small: {
    inline: true,
    nameBias: -1,
    unwrappable: true
  },
  spacer: {
    blacklisted: true
  },
  span: {
    descendantBias: 1,
    inline: true,
    unwrappable: true
  },
  strike: {
    inline: true
  },
  strong: {
    descendantBias: 1,
    inline: true
  },
  style: {
    blacklisted: true
  },
  // fairly certain this should not be an allowed element?
  st1: {
    inline: true,
    unwrappable: true
  },
  sub: {
    descendantBias: 2,
    inline: true
  },
  summary: {
    ancestorBias: 2,
    descendantBias: 1,
    nameBias: 5
  },
  sup: {
    descendantBias: 2,
    inline: true
  },
  svg: {
    leaf: true
  },
  table: {
    ancestorBias: -2
  },
  tbody: {
    unwrappable: true
  },
  td: {
    nameBias: 3
  },
  textarea: {
    blacklisted: true
  },
  tfood: {},
  th: {
    nameBias: -3
  },
  thead: {
    unwrappable: true
  },
  time: {
    descendantBias: 2,
    inline: true,
    nameBias: 2
  },
  title: {
    blacklisted: true
  },
  tr: {
    nameBias: 1
  },
  track: {},
  tt: {
    inline: true
  },
  u: {
    inline: true
  },
  ul: {
    ancestorBias: -5,
    nameBias: -20
  },
  'var': {
    inline: true
  },
  video: {
    leaf: true
  },
  wbr: {}
};

calamine.ELEMENT_KEYS = Object.keys(calamine.ELEMENT);
calamine.SELECTOR_PREFORMATTED = calamine.ELEMENT_KEYS.filter(
  calamine.lookupElementProp.bind(this, 'preformatted')).join(',');
calamine.SELECTOR_LEAF = calamine.ELEMENT_KEYS.filter(
  calamine.lookupElementProp.bind(this, 'leaf')).join(',');
calamine.SELECTOR_INLINE = calamine.ELEMENT_KEYS.filter(
  calamine.lookupElementProp.bind(this, 'inline')).join(',');
calamine.SELECTOR_UNWRAPPABLE = calamine.ELEMENT_KEYS.filter(
  calamine.lookupElementProp.bind(this, 'unwrappable')).join(',');
calamine.SELECTOR_BLACKLIST = calamine.ELEMENT_KEYS.filter(
  calamine.lookupElementProp.bind(this, 'blacklisted')).join(',');
calamine.SELECTOR_WHITELIST = calamine.ELEMENT_KEYS.join(',');

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
  carousel: 30,
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

// NOTE: not currently in use. Keeping around as a note in the event I want to do
// minimization as one of the transformations on remote html data.
// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
// TODO: use ECMA6 Set?
calamine.BOOLEAN_ATTRIBUTES = {
  allowfullscreen: 1,
  async: 1,
  autofocus: 1,
  autoplay: 1,
  checked: 1,
  compact: 1,
  controls: 1,
  declare: 1,
  'default': 1,
  defaultchecked: 1,
  defaultmuted: 1,
  defaultselected: 1,
  defer: 1,
  disable: 1,
  draggable: 1,
  enabled: 1,
  formnovalidate: 1,
  hidden:1,
  indeterminate:1,
  inert: 1,
  ismap: 1,
  itemscope: 1,
  loop: 1,
  multiple: 1,
  muted: 1,
  nohref: 1,
  noresize: 1,
  noshade: 1,
  novalidate: 1,
  nowrap: 1,
  open: 1,
  pauseonexit: 1,
  readonly: 1,
  required: 1,
  reversed: 1,
  scoped: 1,
  seamless: 1,
  selected: 1,
  sortable: 1,
  spellcheck: 1,
  translate: 1,
  truespeed: 1,
  typemustmatch: 1,
  visible: 1
};
