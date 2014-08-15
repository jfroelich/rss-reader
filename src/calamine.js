// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var calamine = {};

/**
 * Returns a DocumentFragment with some boilerplate removed
 */
calamine.transformDocument = function(doc, options) {

  // It is the caller's responsibility to set doc

  // TODO: apparently this should be a more proper check based on
  // arguments.length or typeof options == 'undefined'?
  options = options || {};

  // Unlike doc, doc.body is important to check because a valid
  // doc could lack a body element.
  if(!doc.body) {
    console.warn('Missing body element in document %o', doc);
    return;
  }

  var elements = doc.body.querySelectorAll('*');

  // Filter comment nodes, including conditional comments.
  calamine.forEachNode(doc.body, NodeFilter.SHOW_COMMENT, calamine.removeNode);

  // Filter blacklisted elements
  var blacklistedElements = doc.body.querySelectorAll(calamine.SELECTOR_BLACKLIST);
  calamine.forEach(blacklistedElements, calamine.filterBlacklistedElement);

  // Filter unknown elements
  calamine.forEach(elements, calamine.filterNonWhitelistedElement);

  // Filter certain images
  var images = doc.body.querySelectorAll('img');
  calamine.forEach(images, calamine.filterImage);

  // Unwrap noscript elements. This must occur before filtering
  // invisible elements to properly handle template-unhiding tricks.
  // NOTE: this unfortunately causes boilerplate to appear in content
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

  TODO: combine anchorsWithHref with anchors query below for
  deriving anchor features
  */
  var anchorsWithHref = doc.body.querySelectorAll('a[href]');
  var scriptAnchors = calamine.filter(anchorsWithHref,
    calamine.isJavascriptAnchor);
  scriptAnchors.forEach(calamine.unwrapElement);

  // Marks code/pre elements as whitespaceImportant and then marks all
  // direct and indirect descendant elements as whiteSpaceImportant.
  // Propagating this property from the top down (cascading) enables
  // the trimNode function to quickly determine whether its nodeValue is
  // trimmable, as opposed to having the trimNode function search each
  // text node's axis (path from root) for the presence of a pre/code element.
  var whitespaceImportantElements = doc.body.querySelectorAll('code, pre');
  calamine.forEach(whitespaceImportantElements,
    calamine.cascadeWhitespaceImportant);

  // TODO: Replace &#160; and &nbsp; (and any other such entities) with space
  // before trimming
  // this transform should actually be its own explicit step. Along with transforms
  // for other purposes. For example, when deriving text features, I am not always
  // counting variations of the features. I think this should be called something
  // like normalization or canonicalization

  // TODO: if not whitespace important condense whitespace
  // e.g. nodeValue = nodeValue.replace(/\s+/g,' ');

  // Trim text nodes. If the text node is between two inline elements, it is not
  // trimmed. If the text node follows an inline element, it is right trimmed. If
  // the text node precedes an ineline element, it is left trimmed. Otherwise the
  // nodeValue is fully trimmed.

  // Then, if the nodeValue is empty, remove the node.
  // TODO: make node removal a separate step
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, calamine.trimNode);

  // TODO: cleanup the whitespaceImportant expando? Would that be something done
  // here or elsewhere?

  calamine.filterEmptyElements(doc);

  // Feature extraction operations

  // Extract text features for text nodes and then propagate those properties
  // upward in the dom (up to root)
  // TODO: support <body>text</body> (text under root node)
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT,
    calamine.deriveTextFeatures);

  var anchors = doc.body.getElementsByTagName('a');
  calamine.forEach(anchors, calamine.deriveAnchorFeatures);

  calamine.forEach(elements, calamine.deriveAttributeFeatures);
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

  // Prepare the body element for later aggregation when
  // using the find-best-element technique

  var bestElement = calamine.reduce(elements,
    calamine.getHigherScoringElement, doc.body);

  if(options.UNWRAP_UNWRAPPABLES) {

    // The best element could be something we would prefer to unwrap
    // but the current approach relies on using the element as the
    // return value so we unwrap everything but the best element.

    var unwrappables = doc.body.querySelectorAll(
      calamine.SELECTOR_UNWRAPPABLE);
    var notBest = calamine.isNotBestElement.bind(this, bestElement);
    var lessBest = calamine.filter(unwrappables, notBest);
    lessBest.forEach(calamine.unwrapElement);
  }

  // TODO: trim the element. E.g. remove leading or trailing
  // <br> elements and such. Look at the old sanitizer code
  // that was doing trim document

  // TODO: instead of binding the function, pass it as a thisArg. So
  // forEach needs to accept a thisArg and exposeAttributes need to
  // access it instead of a partial?
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

  // NOTE: is there a better way to get a list of the attributes for
  // an element? I just want the names, not name value pairs.
  // Object.keys?
  var removables = calamine.filter(element.attributes,
    calamine.isRemovableAttribute);
  var names = removables.map(calamine.getAttributeName);
  names.forEach(Element.prototype.removeAttribute.bind(element));
};

calamine.isNotBestElement = function(bestElement, element) {
  return bestElement != element;
};

calamine.getAttributeName = function(attribute) {
  return attribute.name;
};

calamine.isRemovableAttribute = function(attribute) {

  // TODO: allow title? allow alt?

  var name = attribute.name;

  if('href' == name) {
    return false;
  }

  if('src' == name) {
    return false;
  }

  return true;
};

calamine.getHigherScoringElement = function(previous, current) {

  // current could be undefined due to mutation-while-iterating
  // issues so we check here and default to previous
  if(!current) {
    return previous;
  }

  // TODO: do we need to check the presence of the score property?
  // are we comparing undefineds sometimes? Review how > works
  // with undefined.

  // Favor previous in case of a tie, so use > not >=
  return current.score > previous.score ? current : previous;
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

  // TODO: now that I think about it parsesInt might be bad. E.g. parsing
  // 0.1 could result in 0 or something to that effect? Or would it reslt
  // in NaN? Nail down the behavior of it.
  // TODO: this should not really just be absolutely invisible, but also
  // nearly-invisible. More like opacity < 0.3, where 0.3 is the assumed
  // threshold where text becomes non-visible
  var opacity = parseInt(element.style.opacity);
  if(opacity === 0) {
    return true;
  }

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

calamine.cascadeWhitespaceImportant = function(element) {
  if(!element) {
    return;
  }

  calamine.setWhitespaceImportant(element);
  var descendants = element.getElementsByTagName('*');
  calamine.forEach(descendants, calamine.setWhitespaceImportant);
}

calamine.setWhitespaceImportant = function(element) {
  element.whitespaceImportant = 1;
};

calamine.trimNode = function(node) {

  // If whitespace is important then we do not trim
  if(node.parentElement.whitespaceImportant) {
    return;
  }

  // A node is either sandwiched between inline elements
  // or just preceding one or just trailing one

  // NOTE: are we actually just looking up the function
  // to use here? like a factory? E.g. get a function that
  // returns String.prototype.x (or undefined), and then call
  // that function?

  var isInline = calamine.isInline;
  if(isInline(node.previousSibling)) {
    if(!isInline(node.nextSibling)) {
      // It follows an inline element but does not precede one
      // so only trim the right side
      node.nodeValue = node.nodeValue.trimRight();
    } else {
      // It is sandwiched and should not be modified
    }
  } else if(isInline(node.nextSibling)) {
    // It does not follow an inline element but it does
    // precede one so only trim the left side
    node.nodeValue = node.nodeValue.trimLeft();
  } else {
    // It does not follow an inline element and it does
    // not precede one, so trim both sides
    node.nodeValue = node.nodeValue.trim();
  }

  // NOTE: the name of this function is misleading. There
  // is a blatant non-obvious side effect here.

  // TODO: think of a way to move this out of here or/ make the side
  // effect more explict. I just don't like the idea of having to do
  // a second pass. I also don't like the intermediate data structure
  if(!node.nodeValue) {
    node.remove();
  }
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

calamine.deriveAttributeFeatures = function(element) {

  if(!element) {
    return;
  }

  // Store id and class attribute values
  // TODO: this is dumb. Why not just score before removing attributes
  // and avoid this step entirely? The section of the scoring code that
  // scores based on attributes can do the lookup at that point
  var text = (element.getAttribute('id') || '');
  text += ' ';
  text += (element.getAttribute('class') || '');
  text = text.trim().toLowerCase();

  if(text) {
    element.attributeText = text;
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
  var href = anchor.getAttribute('href');

  // Side note: re.test accepts undefined/null and
  // returns false, which still yields the desired result

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

  // NOTE: this expects dimensions to be defined for images or it
  // does not behave as well.

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

  // TODO: use if statements here to improve readability
  // TODO: use temp variables here to improve readability

  // Distance from start
  element.score += element.siblingCount ?
    2 - 2 * element.previousSiblingCount / element.siblingCount : 0;

  // Distance from middle
  element.score += element.siblingCount ?
    2 - 2 * (Math.abs(element.previousSiblingCount - (element.siblingCount / 2) ) /
      (element.siblingCount / 2) )  : 0;
};

calamine.applyTagNameScore = function(element) {

  var bias = calamine.TAG_NAME_BIAS[element.localName];

  element.score += bias || 0;
};

calamine.lookupIdClassBias = function(key) {
  return calamine.ID_CLASS_BIAS[key];
};

calamine.applyAttributeScore = function(element) {

  if(!element.attributeText) {
    return;
  }

  var text = element.attributeText;
  var summer = calamine.sumAttributeBiases.bind(this, text);

  element.score += calamine.ID_CLASS_KEYS.reduce(summer, 0);

  // TODO: propagate partial attribute text bias to children, in the same
  // way that certain ancestor elements bias their children? After all,
  // <article/> should be nearly equivalent to <div id="article"/> ? Does
  // this encroach on tag name bias though?
};

calamine.sumAttributeBiases = function(text, sum, key, index) {

  //var containsKey = text.indexOf(key) > -1;
  //var delta = containsKey ? calamine.ID_CLASS_VALUES[index] : 0;
  //return sum + delta;

  // TODO: is there something like string.contains that is
  // more boolean? We don't care about the index, maybe it would
  // be more semantically accurate

  if(text.indexOf(key) > -1) {
    return sum + calamine.ID_CLASS_VALUES[index];
  }

  return sum;
};

calamine.applyAncestorBiasScore = function(element) {
  var bias = calamine.ANCESTOR_BIASES[element.localName];

  if(!bias) {
    return;
  }

  var descendants = element.getElementsByTagName('*');
  var update = calamine.updateDescendantWithAncestorBias.bind(this, bias);
  calamine.forEach(descendants, update);
};

// Private helper
calamine.updateDescendantWithAncestorBias = function(bias, element) {
  element.score = (element.score || 0) + bias;
};

calamine.applyDescendantBiasScore = function(element) {
  var bias = calamine.DESCENDANT_BIASES[element.localName];

  if(!bias) {
    return;
  }

  var parent = element.parentElement;

  if(!parent) {
    return;
  }

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

  if(element.matches(calamine.SELECTOR_WHITELIST)) {
    return;
  }

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



/*

// TODO: maybe instead of all these separate objects
// I should just store one super structure? Something like:

calamine.ELEMENT_PROPERTIES = {
  a: {
    ancestorBias: 1,
    descendantBias: 1,
    nameBias: 3,
    leafLike: 0,
    inline: 1,
    blacklisted: 0,
    allowedAttributes: {
      href: 1
    }
  },
  b: {
    etc:
  },
  etc

};
*/

calamine.ANCESTOR_BIASES = {
  blockquote: 10,
  code: 10,
  div: 1,
  dl: -5,
  header: -5,
  li: -3,
  nav: -20,
  ol: -5,
  p: 10,
  pre: 10,
  table: -2,
  ul: -5
};

calamine.DESCENDANT_BIASES = {
  b: 1,
  blockquote: 3,
  code: 2,
  em: 1,
  h1: 1,
  h2: 1,
  h3: 1,
  h4: 1,
  h5: 1,
  h6: 1,
  i: 1,
  p: 5,
  pre: 2,
  span: 1,
  strong: 1,
  sub: 2,
  sup: 2,
  time: 2
};

calamine.TAG_NAME_BIAS = {
  a: -1,
  address: -3,
  article: 100,
  aside: -200,
  blockquote: 3,
  button: -100,
  dd: -3,
  div: 20,
  dl: -10,
  dt: -3,
  figcaption: 10,
  figure: 10,
  footer: -20,
  font: 0,
  form: -20,
  header: -5,
  h1: -2,
  h2: -2,
  h3: -2,
  h4: -2,
  h5: -2,
  h6: -2,
  li: -20,
  nav: -50,
  ol: -20,
  p: 10,
  pre: 3,
  section: 10,
  small: -1,
  td: 3,
  time: -3,
  tr: 1,
  th: -3,
  ul: -20
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

// These next two variables are created on the ASSUMPTION that it yields
// better performance regardless of whether the performance is even bad
// in the first place. Never tested perf. This might be stupid.
calamine.ID_CLASS_KEYS = Object.keys(calamine.ID_CLASS_BIAS);
calamine.ID_CLASS_VALUES = calamine.ID_CLASS_KEYS.map(calamine.lookupIdClassBias);

// NOTE: not currently in use. Keeping around as a note in the event I want to do
// minimization as one of the transformations on remote html data.
// Based on https://github.com/kangax/html-minifier/blob/gh-pages/src/htmlminifier.js
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

calamine.SELECTOR_LEAF = 'applet,audio,br,canvas,embed,frame,hr,iframe,'+
  'img,object,video';

calamine.SELECTOR_INLINE = 'a,abbr,acronym,b,bdo,big,blink,cite,code,dfn,'+
  'em,kbd,i,q,samp,small,span,strong,sub,sup,tt,var';

// TODO: use array and join to make this more editable/readable?
calamine.SELECTOR_UNWRAPPABLE = 'a:not([href]),article,big,blink,'+
  'body,center,details,div,font,form,help,html,insert,label,'+
  'legend,nobr,noscript,section,small,span,tbody,thead';

// TODO: separate this into multiple lines for easier maintenance
calamine.SELECTOR_BLACKLIST = 'applet,base,basefont,button,'+
  'command,datalist,dialog,embed,fieldset,frame,frameset,'+
  'html,head,iframe,input,legend,link,math,meta,noframes,'+
  'object,option,optgroup,output,param,script,select,style,'+
  'textarea,title';

// Allowed elements
// NOTE: elements not in this list, such as custom elements
// will be removed. Normal elements with a namespace may also be
// removed.
calamine.SELECTOR_WHITELIST =
  'a,'+
  'abbr,'+
  'acronym,'+
  'address,'+
  'applet,'+
  'area,'+
  'article,'+
  'aside,'+
  'audio,'+
  'b,'+
  'base,'+
  'basefont,'+
  'bdi,'+
  'bdo,'+
  'big,'+
  'blockquote,'+
  'br,'+
  'button,'+
  'canvas,'+
  'caption,'+
  'center,'+
  'cite,'+
  'code,'+
  'col,'+
  'colgroup,'+
  'command,'+
  'data,'+
  'datalist,'+
  'details,'+
  'dialog,'+
  'dir,'+
  'dd,'+
  'del,'+
  'dfn,'+
  'div,'+
  'dl,'+
  'dt,'+
  'em,'+
  'embed,'+
  'entry,'+
  'fieldset,'+
  'figcaption,'+
  'figure,'+
  'font,'+
  'footer,'+
  'form,'+
  'frame,'+
  'frameset,'+
  'head,'+
  'header,'+
  'help,'+
  'hgroup,'+
  'hr,'+
  'html,'+
  'h1,'+
  'h2,'+
  'h3,'+
  'h4,'+
  'h5,'+
  'h6,'+
  'i,'+
  'iframe,'+
  'img,'+
  'input,'+
  'ins,'+
  'insert,'+
  'inset,'+
  'label,'+
  'legend,'+
  'li,'+
  'link,'+
  'kbd,'+
  'main,'+
  'mark,'+
  'map,'+
  'math,'+
  'menu,'+
  'menuitem,'+
  'meta,'+
  'meter,'+
  'nav,'+
  'nobr,'+
  'noframes,'+
  'noscript,'+
  'object,'+
  'ol,'+
  'option,'+
  'optgroup,'+
  'output,'+
  'p,'+
  'param,'+
  'pre,'+
  'progress,'+
  'q,'+
  'rect,'+
  'rp,'+
  'rt,'+
  'ruby,'+
  's,'+
  'samp,'+
  'script,'+
  'section,'+
  'select,'+
  'small,'+
  'span,'+
  'strike,'+
  'strong,'+
  'style,'+
  'st1,'+
  'sub,'+
  'summary,'+
  'sup,'+
  'svg,'+
  'table,'+
  'tbody,'+
  'td,'+
  'textarea,'+
  'tfood,'+
  'th,'+
  'thead,'+
  'time,'+
  'title,'+
  'tr,'+
  'track,'+
  'tt,'+
  'u,'+
  'ul,'+
  'var,'+
  'video,'+
  'wbr';
