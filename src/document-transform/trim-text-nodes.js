// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Carefully trims a document's text nodes, with special handling for
// nodes near inline elements and whitespace sensitive elements such as <pre>
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
			node.nodeValue = node.nodeValue.trim();
		}

		if(!node.nodeValue) {
			node.remove();
		}

		node = iterator.nextNode();
	}
}

this.trimTextNodes = trimTextNodes;

// Return a set of elements that are whitespace sensitive
function getSensitiveSet(document) {
  return new Set(Array.from(document.querySelectorAll('code, code *, ' +
    'pre, pre *, ruby, ruby *, textarea, textarea *, xmp, xmp *')));
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
