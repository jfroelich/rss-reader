// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function trimDocument(document) {
  'use strict';
  trimElement(document);
}

function isTrimmableElement(element) {
  'use strict';
  var name;
  if(!element) return false;
  if(element.nodeType != Node.ELEMENT_NODE) return false;
  name = element.localName;
  if(name == 'br') return true;
  if(name == 'hr') return true;
  if(name == 'p' && !element.firstChild) return true;
  return false;
}

function trimElement(element) {
  'use strict';
  var sibling;

  var node = element.firstChild;
  while(isTrimmableElement(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = element.lastChild;
  while(isTrimmableElement(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
}

function trimNodes(document) {
  'use strict';

  const WHITESPACE_SENSITIVE_ELEMENTS = 'code, code *, pre, pre *, ' + 
    'ruby, ruby *, textarea, textarea *, xmp, xmp *';
  const elements = document.body.querySelectorAll(
    WHITESPACE_SENSITIVE_ELEMENTS);
  const preformatted = new Set(Array.prototype.slice.call(elements));
  const iterator = document.createNodeIterator(document.body, 
    NodeFilter.SHOW_TEXT);
  let node;
  while(node = iterator.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    // TODO: i think the bug regarding removing too many spaces
    // may be occurring here, where we do not consider 
    // consecutive text nodes?

    // Because we unwrap certain inline elements like <em>, 
    // which would cause consecutive text nodes to occur and 
    // not be merged? Because technically, observing two 
    // text nodes in a row is a browser parsing error in 
    // dom generation

    // My current guess is that the error arises from not re-normalizing
    // nodes after modifying the dom (not calling node.normalize)
    // which leads to the possibility of adjacent text nodes

    if(isInlineElement(node.previousSibling)) {
      if(!isInlineElement(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInlineElement(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }
}

function isInlineElement(element) {
  'use strict';

  // NOTE: div is an exception
  const INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
    'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
    'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
    'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
    'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
  ]);

  // Element may be undefined since the caller does not check
  // if node.nextSibling or node.previousSibling are defined
  // before the call.
  // TODO: maybe this is responsibility of caller
  if(!element) {
    return false;
  }

  // This condition definitely happens, not exactly sure how or why
  // TODO: does this mean it is inline? should this be returning true?
  if(element.nodeType != Node.ELEMENT_NODE) {
    return false;
  }

  return INLINE_ELEMENTS.has(element.localName);
}
