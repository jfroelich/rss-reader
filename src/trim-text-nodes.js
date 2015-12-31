// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Carefully trims a document's text nodes, with special handling for
// nodes near inline elements and whitespace sensitive elements such as <pre>
// TODO: this is still causing an issue where there is no space adjacent
// to an inline element, e.g. a<em>b</em> is rendered as ab

// TODO: i am still observing trim errors in the output that I attribute to
// this function, so something is still wrong with it, requires testing
// of specific cases

function trimTextNodes(document) {

  const sensitives = getSensitiveSet(document);
  const iterator = document.createNodeIterator(
    document.documentElement, NodeFilter.SHOW_TEXT);
  let node = iterator.nextNode();
  while(node) {

    if(sensitives.has(node.parentElement)) {
      node = iterator.nextNode();
      continue;
    }

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
      // In this branch, we have a text node that has no siblings, which is
      // generally a text node within an inline element.
      // It feels like we want to full trim here, but we actually do not want
      // to trim, because it causes a funky display error where text following
      // an inline element's text is immediately adjacent to the inline
      // text. Not full-trimming here leaves trailing whitespace in the inline
      // element, which avoids the issue. I suppose, alternatively, we could
      // introduce a single space after the element, but that seems strange.
      node.nodeValue = node.nodeValue.trimLeft();
    }

    if(!node.nodeValue) {
      node.remove();
    }

    node = iterator.nextNode();
  }
}

this.trimTextNodes = trimTextNodes;

// These elements are whitespace sensitive
const SENSITIVE_ELEMENTS = [
  'code',
  'code *',
  'pre',
  'pre *',
  'ruby',
  'ruby *',
  'textarea',
  'textarea *',
  'xmp',
  'xmp *'
];

const SENSITIVE_ELEMENTS_SELECTOR = SENSITIVE_ELEMENTS.join(',');

// Return a set of elements that are whitespace sensitive
function getSensitiveSet(document) {
  const elements = document.querySelectorAll(
    SENSITIVE_ELEMENTS_SELECTOR);
  return new Set(Array.from(elements));
}

const INLINE_ELEMENTS = new Set([
  'a',
  'abbr',
  'acronym',
  'address',
  'b',
  'bdi',
  'bdo',
  'blink',
  'cite',
  'code',
  'data',
  'del',
  'dfn',
  'em',
  'font',
  'i',
  'ins',
  'kbd',
  'mark',
  'map',
  'meter',
  'q',
  'rp',
  'rt',
  'samp',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'sup',
  'time',
  'tt',
  'u',
  'var'
]);

function isInlineElement(element) {
  return INLINE_ELEMENTS.has(element.localName);
}

function isElement(node) {
  return node.nodeType === Node.ELEMENT_NODE;
}

} // END ANONYMOUS NAMESPACE
