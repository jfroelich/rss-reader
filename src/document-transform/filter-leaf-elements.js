// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// These element names are never considered leaves
const exceptions = new Set([
	'area',
	'audio',
	'br',
	'canvas',
	'col',
	'hr',
	'iframe',
	'img',
	'source',
	'svg',
	'track',
	'video'
]);

// Elements containing only these text node values are still leaves
const trivialTexts = new Set([
	'',
	'\n',
	'\n\t',
	'\n\t\t',
	'\n\t\t\t'
]);

// Prunes leaf elements from the document. Leaf elements are those
// elements that do not contain sub elements, such as <p></p>, or elements
// that only contain other leaf-like elements but are not leaf-like, such as
// the outer paragraph in <p id="outer"><p id="nested-inner"></p></p>.
// The document element (e.g. <html></html>) and the document body are never
// considered leaves.
// Certain elements are treated differently. For example, <img> is never
// considered a leaf even though it has no nested elements or text.
// Elements that contain only trivial text nodes are still considered leaves,
// such as <p>\n</p>

// TODO: this could still use improvement. it is revisiting and
// re-evaluating children sometimes.
// TODO: i would like to do this without recursion for better perf
// TODO: does the resulting set of leaves contain leaves within
// leaves? i want to avoid removing leaves within leaves.
// TODO: test cases
// TODO: i would like to do this without having a visitor function and
// an isLeaf function that also visits, it feels wrong.
// TODO: if we treat the document as a DAG, we can use graph principles,
// and process the document as if it were a graph. maybe we need a graph
// library.

function filterLeafElements(document) {
	const leaves = new Set();

	visit(leaves,
		document.body,
		document.documentElement);

	for(let leaf of leaves) {
		// console.debug('Leaf: ', leaf.outerHTML);
		leaf.remove();
	}
}

this.filterLeafElements = filterLeafElements;

function visit(leaves, bodyElement, element) {
	const childNodes = element.childNodes;
	const childNodeCount = childNodes.length;
	for(let i = 0, cursor; i < childNodeCount; i++) {
		cursor = childNodes[i];
		if(cursor.nodeType === Node.ELEMENT_NODE) {
			if(isLeaf(bodyElement, cursor)) {
				leaves.add(cursor);
			} else {
				visit(leaves, bodyElement, cursor);
			}
		}
	}
}

function isLeaf(bodyElement, element) {
	if(element === bodyElement)
		return false;
	if(exceptions.has(element.localName))
		return false;

	const childNodes = element.childNodes;
	const childCount = childNodes.length;
	for(let i = 0, child; i < childCount; i++) {
		child = childNodes[i];
		if(child.nodeType === Node.TEXT_NODE) {
			if(!trivialTexts.has(child.nodeValue)) {
				return false;
			}
		} else if(child.nodeType === Node.ELEMENT_NODE) {
			if(!isLeaf(bodyElement, child)) {
				return false;
			}
		} else {
			return false;
		}
	}

	return true;
}

} // END ANONYMOUS NAMESPACE
