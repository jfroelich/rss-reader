// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// DOM trim lib
lucu.trim = {};

/**
 * Elements which default to display:inline or inline-block
 * NOTE: <div> is treated as an exception and not considered inline
 */
lucu.trim.INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
  'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
  'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
]);

lucu.trim.isInline = function(element) {
  'use strict';
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

  return lucu.trim.INLINE_ELEMENTS.has(element.localName);
};

lucu.trim.isTrimmableElement = function(element) {
  'use strict';
  var name;
  if(!element) return false;
  if(element.nodeType != Node.ELEMENT_NODE) return false;
  name = element.localName;
  if(name == 'br') return true;
  if(name == 'hr') return true;
  if(name == 'p' && !element.firstChild) return true;
  return false;
};

lucu.trim.trimElement = function(element) {
  'use strict';
  var sibling;
  var trimmable = lucu.trim.isTrimmableElement;

  var node = element.firstChild;
  while(trimmable(node)) {
    sibling = node.nextSibling;
    node.remove();
    node = sibling;
  }

  node = element.lastChild;
  while(trimmable(node)) {
    sibling = node.previousSibling;
    node.remove();
    node = sibling;
  }
};

lucu.trim.WHITESPACE_SENSITIVE_ELEMENTS = 'code, code *, pre, pre *, ' + 
  'ruby, ruby *, textarea, textarea *, xmp, xmp *';

// TODO: there is a problem here with SVGAnimatedStrings and I am
// not clear exactly what that is but I occassionally see some
// strange log messages. This might also be related to the perf
// issues. I am guessing it occurs when accessing node.nodeValue
// perhaps for an SVG element, because of some strange thing about
// SVG elements not being considered elements.
lucu.trim.trimNodes = function(document) {
  'use strict';

  var slice = Array.prototype.slice;


  var elements = document.body.querySelectorAll(
    lucu.trim.WHITESPACE_SENSITIVE_ELEMENTS);
  var preformatted = new Set(slice.call(elements));
  var isInline = lucu.trim.isInline;
  var it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
  var node;
  while(node = it.nextNode()) {
    if(preformatted.has(node.parentElement)) {
      continue;
    }

    if(isInline(node.previousSibling)) {
      if(!isInline(node.nextSibling)) {
        node.nodeValue = node.nodeValue.trimRight();
      }
    } else if(isInline(node.nextSibling)) {
      node.nodeValue = node.nodeValue.trimLeft();
    } else {
      node.nodeValue = node.nodeValue.trim();
    }
  }
};
