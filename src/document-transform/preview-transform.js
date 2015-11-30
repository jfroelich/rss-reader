// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: apply the blacklist filter after calamine instead of before
// maybe the blacklist filter should only flag elements instead
// of doing dom modification at first, and then do deferred manipulation?
// or maybe Calamine should be modified to include the blacklist filtering
// because it fits into original goal of boilerplate classification and
// removal (instead of just identifying a best element)

// NOTE: const variables in block scope are leaked if not in strict mode,
// therefore, we must use a global strict mode

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const filter = Array.prototype.filter;

// TODO: use dependency injection in previewTransform

// Applies a series of transformations to a document in preparation
// for displaying the document in a view. Defined in global scope
this.previewTransform = function _previewTransform(
	applyCalamineFunction,
	filterLeaves,
	document) {

	transformFrameElements(document);
	transformNoscripts(document);
	filterBlacklistedElements(document);

	// TODO: applyCalamineFunction depends on applyCalamineAttributeScore,
	// but do i specify that here, or do I also require specifying it
	// as a dependency to this function?

	applyCalamineFunction(applyCalamineAttributeScore, document, false);

	filterComments(document);

	const hiddenExceptions = new Set(['noembed']);
	filterHiddenElements(document, hiddenExceptions, 0.3);

	filterTracerImages(document);
	replaceBreakRuleElements(document);
	normalizeWhitespace(document);
	trimTextNodes(document);
	transformScriptAnchors(document);
	unwrapInlineElements(document);

	const retainableAttributes = new Set(['href', 'src']);
	filterAttributes(document, retainableAttributes);

	filterLeaves(document);
	unwrapSingletonLists(document);
	trimDocument(document);
};

// Inspects a document for the presence of a frameset and lack of a body
// element, and then removes the frameset and generates a body consisting
// of either noframes content or an error message.
function transformFrameElements(document) {

	let body = document.querySelector('body');
	const frameset = document.querySelector('frameset');
	if(!body && frameset) {
		const noframes = frameset.querySelector('noframes');
		body = document.createElement('body');
		if(noframes) {
			body.innerHTML = noframes.innerHTML;
		} else {
			body.textContent = 'Unable to display document due to frames.';
		}

		document.documentElement.appendChild(body);
		frameset.remove();
	}
}

// Due to content-loading tricks, noscript requires special handling
// e.g. nbcnews.com

function transformNoscripts(document) {
	const noscripts = document.querySelectorAll('noscript');
	const numNoscripts = noscripts.length;
	let noscript = null;
	for(let i = 0; i < numNoscripts; i++) {
		noscript = noscripts[i];
		// console.debug('Unwrapping noscript %s', noscript.outerHTML);
		//DOMUtils.unwrap(noscript);

		// The default behavior is now to remove
		// NOTE: because we are using a static node list generated
		// by querySelectorAll, noscript is guaranteed defined even
		// though we are doing mutation during iteration
		noscript.remove();
	}
}

// Removes all comments
// TODO: process IE conditional comments?
function filterComments(document) {
	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_COMMENT);
	let comment = it.nextNode();
	while(comment) {
		comment.remove();
		comment = it.nextNode();
	}
}

// Removes hidden elements
// @param exceptions {Set} a set of string names of elements never considered
// hidden
// @param minOpacity {float} elements with a lesser opacity are considered
// hidden
function filterHiddenElements(document, exceptions, minOpacity) {

	minOpacity = minOpacity || 0.0;

	// Using NodeIterator avoids visiting detached subtrees
	const iterator = document.createNodeIterator(
		document.documentElement, NodeFilter.SHOW_ELEMENT);
	let element = iterator.nextNode();
	let style = null;
	let opacity = 0.0;
	const isHidden = isHiddenElement.bind(null, exceptions, minOpacity);
	while(element) {
		if(isHidden(element)) {
			element.remove();
		}
		element = iterator.nextNode();
	}
}

// This does not test against offsetWidth/Height because the
// properties do not appear to be initialized within inert documents
// TODO: maybe try getting and using computed style?
function isHiddenElement(exceptions, minOpacity, element) {
	if(exceptions.has(element.localName)) {
		return false;
	}

	const style = element.style;
	const opacity = parseFloat(style.opacity) || 1.0;
	return style.display === 'none' ||
		style.visibility === 'hidden' ||
		style.visibility === 'collapse' ||
		opacity <= minOpacity;
}

// Removes images that do not have a source url or that appear to be tracers.
// A tracer image is a tracking technique where some websites embed a small,
// hidden image into a document and then track the requests for that image
// using a traditional web request log analytics tool. This function considers
// width and height independently, resulting in removal of images that appear
// like horizontal rule elements or vertical bars, which is also desired.
// NOTE: this assumes that images without explicit dimensions were pre-analyzed
// by DocumentUtils.setImageDimensions
function filterTracerImages(document) {
	const images = document.querySelectorAll('img');
	const imagesLength = images.length;
	let image = null;
	for(let i = 0; i < imagesLength; i++) {
		image = images[i];
		if(isTracerImage(image)) {
			image.remove();
		}
	}
}

function isTracerImage(image) {
	const source = (image.getAttribute('src') || '').trim();
	return !source || (image.width < 2) || (image.height < 2);
}


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

const RE_NON_BREAKING_SPACE = /&nbsp;/g;

// TODO: what other whitespace transformations do we care about?
function normalizeWhitespace(document) {

	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_TEXT);
	let node = it.nextNode();
	while(node) {
		node.nodeValue = node.nodeValue.replace(RE_NON_BREAKING_SPACE, ' ');
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

function trimTextNodes(document) {

	// To avoid trimming nodes present within whitespace sensitive
	// elements, such as <pre>, we search for all such elements and
	// elements within those elements, create a set of distinct
	// elements, and use this to check if a given text node's parent
	// element falls within that set. Alternatively, we could walk
	// up the dom each time, and check whether any parent is whitespace
	// sensitive, but this feels more performant.

	// NOTE: we do not use a filter function for createNodeIterator
	// due to performance issues

	const elements = document.querySelectorAll(
		WHITESPACE_SENSITIVE_SELECTOR);
	const preformatted = new Set(Array.from(elements));
	const iterator = document.createNodeIterator(
		document.documentElement,
		NodeFilter.SHOW_TEXT);

	let node = iterator.nextNode();
	while(node) {

		// Skip over nodes that are descendants of
		// whitespace sensitive elements
		if(preformatted.has(node.parentElement)) {
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

const RE_JAVASCRIPT_PROTOCOL = /^\s*javascript\s*:/i;

function transformScriptAnchors(document) {
	'use strict';
	const anchors = document.querySelectorAll('a');
	const numAnchors = anchors.length;
	let anchor = null;
	let href = null;
	for(let i = 0; i < numAnchors; i++) {
		anchor = anchors[i];
		href = anchor.getAttribute('href');
		href = (href || '').trim();

		// If it is a script anchor, set href to empty
		// so that the anchor will be unwrapped
		if(RE_JAVASCRIPT_PROTOCOL.test(href)) {
			href = null;
		}

		// We do not care about other methods of scripting
		// like onclick attribute, those attributes are removed

		if(!href) {
			//console.debug('Unwrapping anchor %o', anchor);
			DOMUtils.unwrap(anchor);
		}
	}
}

// NOTE: This does not contain ALL inline elements, just those we
// want to unwrap. This is different than the set of inline
// elements defined for the purpose of trimming text nodes.
const UNWRAPPABLE_ELEMENTS = new Set([
	'article',
	'big',
	'blink',
	'center',
	'colgroup',
	'data',
	'details',
	'div',
	'font',
	'footer',
	'form',
	'header',
	'help',
	'hgroup',
	'ilayer',
	'insert',
	'label',
	'layer',
	'legend',
	'main',
	'mark',
	'marquee',
	'meter',
	'multicol',
	'nobr',
	'noembed',
	'plaintext',
	'section',
	'small',
	'span',
	'tbody',
	'tfoot',
	'thead',
	'tt'
]);

const UNWRAPPABLE_SELECTOR = Array.from(UNWRAPPABLE_ELEMENTS).join(',');

// anchors are handled separately
// fallback elements (e.g. noscript) are handled separately
function unwrapInlineElements(document) {
	// NOTE: using querySelectorAll because testing revealed that
	// NodeIterator cannot update its reference node appropriately
	// as a result of the unwrap.
	const elements = document.querySelectorAll(UNWRAPPABLE_SELECTOR);
	const numElements = elements.length;
	for(let i = 0; i < numElements; i++) {
		DOMUtils.unwrap(elements[i]);
	}
}

// Removes attributes from all elements in the document
// except for those named in the optional retainableSet
function filterAttributes(document, retainableSet) {

	const elements = document.getElementsByTagName('*');
	const numElements = elements.length;
	let attributes = null;
	let name = '';
	let element = null;
	for(let i = 0, j = 0; i < numElements; i++) {
		element = elements[i];
		attributes = element.attributes;
		j = attributes ? attributes.length : 0;
		while(j--) {
			name = attributes[j].name;
			if(!retainableSet.has(name)) {
				element.removeAttribute(name);
			}
		}
	}
}

function unwrapSingletonLists(document) {

	if(!document || !document.documentElement || !document.body) {
		return;
	}

	const it = document.createNodeIterator(document.body,
		NodeIterator.SHOW_ELEMENT);
	let element = it.nextNode();

	while(element) {
    if(isList(element) && countListItems(element) === 1) {
      unwrapSingleItemList(element);
    }

		element = it.nextNode();
	}
}

function isList(element) {
  return element.localName === 'ul';
}

function isListItem(element) {
  return element.localName === 'li';
}

function countListItems(element) {
  return filter.call(element.childNodes, isListItem).length;
}

function unwrapSingleItemList(list) {
	console.debug('Unwrapping %s', list.outerHTML);
	const parent = list.parentElement;
	const item = list.querySelector('li');
	const nextSibling = list.nextSibling;

	if(nextSibling) {
		// Move the item's children to before the list's
		// next sibling
		while(item.firstChild) {
			parent.insertBefore(item.firstChild, nextSibling);
		}
	} else {
		// The list is the last node in its container, so append
		// the item's children to the container
		while(item.firstChild) {
			parent.appendChild(item.firstChild);
		}
	}

	console.debug('Parent after unwrap: %s', parent.innerHTML);

	list.remove();
}

function trimDocument(document) {
	const root = document.body;

	if(!root) {
		return;
	}

	let sibling = root;
	let node = root.firstChild;
	while(isTrimmable(node)) {
		sibling = node.nextSibling;
		node.remove();
		node = sibling;
	}

	node = root.lastChild;
	while(isTrimmable(node)) {
		sibling = node.previousSibling;
		node.remove();
		node = sibling;
	}
}

function isTrimmable(element) {
	if(!element) return false;
	if(element.nodeType !== Node.ELEMENT_NODE) return false;
	let name = element.localName;
	if(name === 'br') return true;
	if(name === 'hr') return true;
	if(name === 'p' && !element.firstChild) return true;
	return false;
}

} // END ANONYMOUS NAMESPACE
