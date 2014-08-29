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
 * A filter that accepts anchors that can be used as factors
 * in scoring.
 */
calamine.acceptIfAnalyzableAnchor = function(textFeatures, element) {
  // Anchors without hrefs are considered basic inline elements that can be
  // unwrapped. We ignore such anchors when setting anchorCharCount because
  // the boilerplate signal is stronger for hrefs. Side menus typically use
  // anchors for links, not for inline span effects.

  var entry = textFeatures.get(element);
  var charCount = 0;
  if(entry && entry.hasOwnProperty('charCount')) {
    charCount = entry.charCount;
  }

  // TODO: this could not be improved, just use || !entry || !entry.charCount
  // there is no need to even have a charCount var or set it

  return element.localName != 'a' || !charCount || !element.hasAttribute('href') ?
    NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
};

/**
 * Filter that accepts empty text nodes
 */
calamine.acceptIfEmpty = function(node) {
  return node.nodeValue ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
};

/**
 * Parameter to createNodeIterator that accepts nodes that should be removed.
 */
calamine.acceptIfRemovable = function(node) {
  if(node.nodeType == Node.COMMENT_NODE) {
    return NodeFilter.FILTER_ACCEPT;
  }

  var descriptor = calamine.getDescriptor(node);
  if(!descriptor || descriptor.blacklisted || calamine.isTracerImage(node)) {
    return NodeFilter.FILTER_ACCEPT;
  }

  // Testing to see if this is the perf culprit
  //if(node.localName != 'noscript' && node.localName != 'noembed' &&
  //  calamine.isInvisible(node)) {
  //  return NodeFilter.FILTER_ACCEPT;
  //}

  return NodeFilter.FILTER_REJECT;
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
  var descriptor = calamine.getDescriptor(e);
  return descriptor.unwrappable ? NodeFilter.FILTER_ACCEPT :
    NodeFilter.FILTER_REJECT;
};


calamine.RE_TOKEN_SPLIT = /[\s-_]+/g;


/**
 * NOTE: expects defined dimensions
 */
calamine.applyImageScore = function(element) {

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

/**
 * Updates the element's score based on its index within
 * its parent. The closer to the start (the smaller the index),
 * the higher the score. The closer the middle (the mid index),
 * the higher the score.
 */
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
calamine.applySiblingBias = function(element) {
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

/**
 * Updates the element's score based on the content
 * of its text nodes.
 */
calamine.applyTextScore = function(features, element) {

  // features is the entry from the featuresMap. Guaranteed
  // defined.

  if(features.hasCopyrightSymbol) {
    element.score -= 40;
  }
  element.score += -20 * (features.bulletCount || 0);
  element.score += -10 * (features.pipeCount || 0);

  // features.charCount is guaranteed defined because the
  // caller checked it before calling this function

  var cc = features.charCount;
  var density = element.anchorCharCount / cc;
  if(cc > 1000) {
    if(density > 0.35) {
      element.score += 50;
    } else if(density > 0.2) {
      element.score += 100;
    } else if (density > 0.1) {
      element.score += 100;
    } else if(density > 0.05) {
      element.score += 250;
    } else {
      element.score += 300;
    }
  } else if(cc > 500) {
    if(density > 0.35) {
      element.score += 30;
    } else if(density > 0.1) {
      element.score += 180;
    } else {
      element.score += 220;
    }
  } else if(cc > 100) {
    if(density > 0.35) {
      element.score += -100;
    } else {
      element.score += 60;
    }
  } else {
    if(density > 0.35) {
      element.score -= 200;
    } else if(isFinite(density)) {
      element.score += 20;
    } else {
      element.score += 5;
    }
  }
};

/**
 * Replace variations of the space character with the ' ' character
 * in the node's value.
 */
calamine.canonicalizeSpace = function(node) {
  node.nodeValue = node.nodeValue.replace(/&(nbsp|#(xA0|160));/,' ');
};

/**
 * Builds a WeakSet of elements that are preformatted, including
 * descendants of preformatted elements.
 *
 * TODO: WeakSet added in Chrome 36, ensure min version in manifest.json
 */
calamine.collectPreformatted = function(doc) {
  var set = new WeakSet();

  // TODO: maybe it is simple enough here to just inline
  // the selector string and move it out of the policy map

  // TODO: is there a way to query for children of such elements
  // instead of doing a call to getElementsByTagName and an innerloop?
  // That would be even simpler, and I think there is. (e.g. pre, pre *)

  // TODO: at some point the assumption that pre-collecting these elements
  // is faster than repeated calls to isDescendantOf(anyPreformattedElement)
  // needs to be tested

  // TODO: does WeakSet.prototype.add work like Array.prototype.push? Could
  // we just use add.apply(elements)? Or would it work if we used
  // set = new WeakSet(elements) ?
  var elements = doc.body.querySelectorAll(calamine.SELECT_PREFORMATTED);
  for(var i = 0, len = elements.length, element; i < len; i++) {
    element = elements[i];
    set.add(element);
    for(var j = 0, descendants = element.getElementsByTagName('*'),
      dlen = descendants.length; j < dlen; j++) {
      set.add(descendants[j]);
    }
  }

  return set;
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
calamine.deriveAnchorFeatures = function(features, anchor) {

  // At the moment this is only updated to use the new charCount
  // features, it still needs more revision to also use anchorCharCount

  // This only gets called if there is a charCount for the anchor element
  // so entry is guaranteed defined
  var entry = features.get(anchor);
  var charCount = entry.charCount || 0;

  // This is temp (see next comment)
  anchor.anchorCharCount = charCount;

  var doc = anchor.ownerDocument;
  var parent = anchor.parentElement;
  while(parent != doc.body) {
    // Temporarily we are leaving anchorCharCount expando in here. Also,
    // instead of a features we should be using a full
    // elementFeatureMap for any type of feature, text or anchor or
    // whatever. Will come back to that

    var pEntry = features.get(parent);
    if(pEntry) {
      parent.anchorCharCount += charCount;
    } else {
      parent.anchorCharCount = charCount;
    }

    parent = parent.parentElement;
  }
};

/**
 * Calculates and stores two sibling properties: the
 * number of siblings, and the number of preceding siblings
 * in document order.
 */
calamine.deriveSiblingFeatures = function(element) {
  element.siblingCount = element.parentElement.childElementCount - 1;
  element.previousSiblingCount = 0;
  if(!element.siblingCount) {
    return;
  }
  var pes = element.previousElementSibling;
  if(pes) {
    element.previousSiblingCount = pes.previousSiblingCount + 1;
  }
};

/**
 * Calculates and stores properties in the parent element
 * of the onde based on the text content of the node.
 * Expects a text node
 *
 * TODO: rename parameter to textNode to better qualify its
 * parameter
 */
/*calamine.deriveTextFeatures = function(node) {
  var doc = node.ownerDocument;
  var parent = node.parentElement;
  var value = node.nodeValue;
  // TODO: check for the copyright character itself?
  // TODO: check unicode variants?
  parent.hasCopyrightSymbol = /&copy;|&#169;|&#xA9;/i.test(value) ? 1 : 0;
  // TODO: this should also be looking for the character itself
  // &#8226,•, &#x2022;
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
};*/

// This new implementation builds a WeakMap
calamine.deriveTextFeatures = function(doc) {
  var map = new WeakMap();
  calamine.forEachNode(doc.body, NodeFilter.SHOW_TEXT, function(node) {
    var parent = node.parentElement;
    var entry = map.get(parent) || {};

    if(!entry.hasCopyrightSymbol) {
      // We only bother to check if the flag is not yet true for the parent
      // TODO: check for the copyright character itself?
      // TODO: check unicode variants?
      if(/&copy;|&#169;|&#xA9;/i.test(node.nodeValue)) {
        entry.hasCopyrightSymbol = true;
      }
    }

    // TODO: this should also be looking for the character itself
    // &#8226,•, &#x2022;
    var bulletCount = calamine.countChar(node.nodeValue,'\u2022');
    if(entry.bulletCount) {
      // Add in the new count
      entry.bulletCount += bulletCount;
    } else if(bulletCount) {
      // Define the new count
      entry.bulletCount = bulletCount;
    }

    // TODO: this should also be looking at other expressions of pipes
    var pipeCount = calamine.countChar(node.nodeValue, '|');
    if(entry.pipeCount) {
      entry.pipeCount += pipeCount;
    } else if(pipeCount) {
      entry.pipeCount = pipeCount;
    }

    var charCount = node.nodeValue.length -
      node.nodeValue.split(/[\s\.]/g).length + 1;

    if(entry.charCount) {
      entry.charCount += charCount;
    } else if(charCount) {
      entry.charCount = charCount;
    }

    map.set(parent, entry);

    if(!charCount) {
      return;
    }

    // Propagate charCount up to body
    parent = parent.parentElement;
    while(parent && parent != doc.body) {
      var pEntry = map.get(parent);
      if(pEntry) {
        if(pEntry.charCount) {
          pEntry.charCount += charCount;
        } else {
          pEntry.charCount = charCount;
        }

        map.set(parent, pEntry);
      } else {
        map.set(parent, { charCount: charCount});
      }

      parent = parent.parentElement;
    }
  });

  return map;
};


/**
 * Element policies name-to-policy map
 */
calamine.ELEMENT_POLICY = {
  a: {inline: true, nameBias: -1},
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

/**
 * Sets attributes of the element that reflect some of the
 * internal metrics (expando properties) stored for the
 * element, according to whether the attribute should be
 * exposed in options
 */
calamine.exposeAttributes = function(options, element)  {
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
 * Simple decorator that works with array-like objects
 * such as NodeList
 */
calamine.filter = function(list, fn) {
  if(!list) {
    return [];
  }

  return Array.prototype.filter.call(list, fn);
};

/**
 * Removes attributes from the element unless they are not
 * removable.
 */
calamine.filterAttributes = function(element) {
  // NOTE: confirmed hotspot, hence plain loop
  // TODO: allow title? allow alt?
  var attributes = element.attributes, node;
  var counter = attributes.length;
  while(counter--) {
    node = attributes[counter];
    if(node.name != 'href' && node.name != 'src') {
      element.removeAttribute(node.name);
    }
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

/**
 * Simple decorator that accepts array-like objects
 * such as NodeList or arguments.
 */
calamine.forEach = function(list, func) {
  // TODO: delete if this does not cause errors
  //if(!list) {
  //  console.debug('forEach list is undefined');
  //  return;
  //}

  Array.prototype.forEach.call(list, func);
};

/**
 * A simple helper to use forEach against traversal API.
 *
 * TODO: maybe reorder parameters to make filter required and before
 * func, to make order more intuitive (natural).
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
 * Looks up the policy for the element according to its local name. Returns
 * undefined if no policy exists.
 */
calamine.getDescriptor = function(element) {
  // NOTE: element lookup is done using localName (lowercase).
  // Using element.matches provides inconsistent behavior against
  // namespaced names  (e.g. g:plusone, fb:like, l:script)
  // Using element.tagName is uppercase, but includes namespace
  // Maybe tagName is simpler?

  return element && calamine.ELEMENT_POLICY[element.localName];
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
 */
calamine.getMaxScore = function(previous, current) {

  // TODO: this needs a better name. what is it doing?

  // current could be undefined due to mutation-while-iterating
  // issues so we check here and default to previous
  // TODO: deprecate
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

/**
 * Returns true if the element is empty-like and therefore suitable for pruning
 */
calamine.isEmptyLike = function(element) {
  var descriptor = calamine.getDescriptor(element);
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

/**
 * Tests whether an element is invisible
 */
calamine.isInvisible = function(element) {

  // TODO: this is alarmingly slow. My best guess is that
  // element.style is lazily computed, or that opacity
  // calc is slow

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
 * Returns true if the element is template-like. This is
 * completely unrelated to HTML5 templates. This relates to
 * tactics that exist in the wild pre-HTML5, such as
 * <noscript hidden>content</noscript> that are unwrapped
 * using javascript on load.
 */
calamine.isTemplateLike = function(element) {
  return element.localName == 'noembed' || element.localName == 'noscript' ?
    NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
};

/**
 * Returns true if the element appears as a tracer image.
 */
calamine.isTracerImage = function(element) {
  return element.localName == 'img' &&
    (element.width == 1 || element.height == 1);
};

/**
 * Returns true if an element is trimmable, which currently
 * is just BR and empty P
 */
calamine.isTrimmableElement = function(element) {
  return element && element.nodeType == Node.ELEMENT_NODE &&
    (element.localName == 'br' || element.localName == 'p' &&
    !element.firstChild);
};

/**
 * A dictionary of terms and biases.
 *
 * TODO: the new attribute scoring function splits
 * by - character so need to exclude it
 * TODO: reconsider overlap
 */
calamine.LEXICON_BIAS = {
  about: -35,
  ad: -100,
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
  utility: -50,
  vcard: -50,
  week: -100,
  welcome: -50,
  widg: -200,
  zone: -50
};

/**
 * Pre-calculated, singleton keys array
 */
calamine.LEXICON_BIAS_KEYS = Object.keys(calamine.LEXICON_BIAS);

/**
 * Simple decorator that accepts array-like objects
 * such as NodeList
 */
calamine.reduce = function(list, func, initialValue) {
  if(!list) {
    return initialValue;
  }

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

/**
 * Simple helper for passing to iterators like forEach
 */
calamine.removeNode = function(node) {
  // TODO: would node ever be undefined here?
  if(node) {
    node.remove();
  }
};

calamine.SELECT_PREFORMATTED = Object.keys(calamine.ELEMENT_POLICY).filter(function(e) {
  var p = calamine.ELEMENT_POLICY[e];
  return p && p.preformatted;
}).join(',');

/**
 * Apply our 'model' to an element. We generate a score that is the
 * sum of several terms.
 */
calamine.scoreElement = function(featuresMap, element) {
  element.score = element.score || 0;

  var descriptor = calamine.getDescriptor(element);
  var features = featuresMap.get(element) || {};

  if(features.charCount && !descriptor.leaf) {
    calamine.applyTextScore(features, element);
  }

  calamine.applyImageScore(element);
  calamine.applyPositionScore(element);

  // Score based on tag name
  element.score += descriptor.nameBias || 0;

  // Attribute scoring
  var tokens = ((element.id || '') + ' ' + (element.className || '')).trim().
    toLowerCase().split(calamine.RE_TOKEN_SPLIT);
  for(var i = 0, len = tokens.length; i < len; i++) {
    element.score += calamine.LEXICON_BIAS[tokens[i]] || 0;
  }

  // Downward bias. Affects all descendants
  var ancestorBias = descriptor.ancestorBias;
  if(ancestorBias) {
    var descendants = element.getElementsByTagName('*');
    for(var i = 0, len = descendants.length, descendant; i < len; i++) {
      descendant = descendants[i];
      descendant.score = (descendant.score || 0) + ancestorBias;
    }
  }

  // Upward bias. Affects only the immediate parent of this element.
  var descendantBias = descriptor.descendantBias;
  if(descendantBias) {
    var parent = element.parentElement;
    if(parent.hasOwnProperty('score')) {
      parent.score += descendantBias;
    } else {
      parent.score = descendantBias;
    }
  }
};

/**
 * Under development. Transform <br> into
 * containing block
 */
calamine.testSplitBreaks = function(str) {
  // Trying to break apart break rule elements by block
  // UNDER HEAVY DEVELOPMENT

  if(!str) return;

  var doc = document.implementation.createHTMLDocument();
  doc.body.innerHTML = str;

  // TODO: use the isInline function defined somewhere, do not redefine

  var isInline = calamine.isInline;

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


/**
 * Returns the best element of the document. Does some mutation
 * to the document.
 */
calamine.transformDocument = function(doc, options) {
  var c = calamine;
  var loop = c.forEachNode;
  options = options || {};
  loop(doc.body, NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
    c.removeNode, c.acceptIfRemovable);
  loop(doc.body, NodeFilter.SHOW_ELEMENT, c.transformShim, c.isTemplateLike);
  // c.forEach(doc.body.querySelectorAll('br,hr'), c.testSplitBreaks);
  loop(doc.body, NodeFilter.SHOW_TEXT, c.canonicalizeSpace);

  var preformatted = calamine.collectPreformatted(doc);
  loop(doc.body, NodeFilter.SHOW_TEXT, c.trimNode.bind(this, preformatted));

  loop(doc.body, NodeFilter.SHOW_TEXT, c.removeNode, c.acceptIfEmpty);
  c.filterEmptyElements(doc);

  var features = calamine.deriveTextFeatures(doc);

  loop(doc.body, NodeFilter.SHOW_ELEMENT,
    c.deriveAnchorFeatures.bind(this, features),
    c.acceptIfAnalyzableAnchor.bind(this, features));
  loop(doc.body, NodeFilter.SHOW_ELEMENT, c.deriveSiblingFeatures);
  loop(doc.body, NodeFilter.SHOW_ELEMENT, c.scoreElement.bind(this, features));
  loop(doc.body, NodeFilter.SHOW_ELEMENT, c.applySiblingBias);
  if(options.FILTER_ATTRIBUTES) {
    loop(doc.body, NodeFilter.SHOW_ELEMENT, c.filterAttributes);
  }

  doc.body.score = -Infinity;
  var elements = doc.body.querySelectorAll('*');
  var bestElement = c.reduce(elements, c.getMaxScore, doc.body);
  if(options.UNWRAP) {
    loop(bestElement, NodeFilter.SHOW_ELEMENT, c.unwrap,
      c.acceptIfShouldUnwrap.bind(this, bestElement));
  }
  loop(bestElement, NodeFilter.SHOW_ELEMENT,
    c.exposeAttributes.bind(this, options));
  c.trimElement(bestElement);
  return bestElement;
};

/**
 * Unwraps or removes noscript-like elements.
 */
calamine.transformShim = function(element) {
  // TODO: this needs to check contains to avoid
  // processing <noscript><noscript>..</noscript></noscript>
  var text = element.innerText || '';
  if(element.childNodes.length < 3 || text.length < 100) {
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

/**
 * Removes the element but retains its children.
 */
calamine.unwrap = function(element) {
  // TODO: deprecate this check (after testing while commented)
  //if(!element.parentElement) {
  // console.debug('undefined parentElement in unwrap');
  //  return;
  //}

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
