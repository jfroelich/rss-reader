// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const WhitespaceTransform = {};

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: replace consecutive spaces with single space

WhitespaceTransform.transform = function WhitespaceTransform$Transform(document) {
  replaceBreakRuleElements(document);
  normalizeWhitespace(document);
  trimTextNodes(document);
};

// TODO: improve this. br is allowed in inline elements
// and this is shoving non-inline p into inline sometimes
// so we need to be able to break the inline context in 
// half somehow
function replaceBreakRuleElements(document) {
  const elements = document.querySelectorAll('br');
  const length = elements.length;
  for(let i = 0; i < length; i++) {
    const element = elements[i];
    const parent = element.parentElement;
    const p = document.createElement('p');
    parent.replaceChild(p, element);
  }
}

// TODO: what other whitespace transformations do we care about?

function normalizeWhitespace(document) {
  const it = document.createNodeIterator(document.documentElement,
    NodeFilter.SHOW_TEXT);
  let node = it.nextNode();
  while(node) {
    node.nodeValue = node.nodeValue.replace(/&nbsp;/g, ' ');
    node = it.nextNode();
  }
}

function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

const INLINE_ELEMENTS = new Set(['a','abbr', 'acronym', 'address',
  'b', 'bdi', 'bdo', 'blink','cite', 'code', 'data', 'del',
  'dfn', 'em', 'font', 'i', 'ins', 'kbd', 'mark', 'map',
  'meter', 'q', 'rp', 'rt', 'samp', 'small', 'span', 'strike',
  'strong', 'sub', 'sup', 'time', 'tt', 'u', 'var'
]);

function isInlineElement(element) {
  return INLINE_ELEMENTS.has(element.localName);
}

const WHITESPACE_SENSITIVE_SELECTOR = 'code, code *, pre, pre *, ' + 
  'ruby, ruby *, xmp, xmp *';

function rejectPreformatted(set, node) {
  return set.has(node.parentElement) ? 
    NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
}

function trimTextNodes(document) {
  // To avoid trimming nodes present within whitespace sensitive
  // elements, such as <pre>, we search for all such elements and 
  // elements within those elements, create a set of distinct 
  // elements, and use this to check if a given text node's parent
  // element falls within that set. Alternatively, we could walk 
  // up the dom each time, but this feels more performant.

  const elements = document.querySelectorAll(
    WHITESPACE_SENSITIVE_SELECTOR);
  const preformatted = new Set(Array.from(elements));
  const iterator = document.createNodeIterator(document.documentElement, 
    NodeFilter.SHOW_TEXT, rejectPreformatted.bind(this, preformatted));

  let node = iterator.nextNode();
  while(node) {
    if(node.previousSibling) {
      if(isElement(node.previousSibling)) {
        if(isInlineElement(node.previousSibling)) {
          if(node.nextSibling) {
            if(isElement(node.nextSibling)) {
              if(!isInlineElement(node.nextSibling)) {
                node.nodeValue = node.nodeValue.trimRight();
              }
            }
          } else {
            node.nodeValue = node.nodeValue.trimRight();
          }
        } else {
         node.nodeValue = node.nodeValue.trim();
        }
      } else {
       if(node.nextSibling) {
          if(isElement(node.nextSibling)) {
            if(isInlineElement(node.nextSibling)) {
            } else {
             node.nodeValue = node.nodeValue.trimRight();
            }
          }
        } else {
          node.nodeValue = node.nodeValue.trimRight();
        }
      }
    } else if(node.nextSibling) {
     if(isElement(node.nextSibling)) {
        if(isInlineElement(node.nextSibling)) {
          node.nodeValue = node.nodeValue.trimLeft();
        } else {
          node.nodeValue = node.nodeValue.trim();
        }
      } else {
        node.nodeValue = node.nodeValue.trimLeft();
      }
    } else {
      node.nodeValue = node.nodeValue.trim();
    }

    if(!node.nodeValue) {
      node.remove();
    }

    node = iterator.nextNode();
  }
}

} // END ANONYMOUS NAMESPACE
