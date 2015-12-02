// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

const filter = Array.prototype.filter;

// Applies a series of transformations to a document in preparation
// for displaying the document in a view.
function previewTransform(document) {
	filterComments(document);
	filterFrameElements(document);
	filterScriptElements(document);
	filterEmbeddedElements(document);

	// The following are misc. elements
	// TODO: review where these go
	var garbage = document.implementation.createHTMLDocument();
	DOMUtils.moveElementsByName(document, garbage, 'datalist');
	DOMUtils.moveElementsByName(document, garbage, 'dialog');
	DOMUtils.moveElementsByName(document, garbage, 'fieldset');
	DOMUtils.moveElementsByName(document, garbage, 'isindex');
	DOMUtils.moveElementsByName(document, garbage, 'math');
	DOMUtils.moveElementsByName(document, garbage, 'output');
	DOMUtils.moveElementsByName(document, garbage, 'optgroup');
	DOMUtils.moveElementsByName(document, garbage, 'progress');
	DOMUtils.moveElementsByName(document, garbage, 'spacer');
	DOMUtils.moveElementsByName(document, garbage, 'xmp');

	filterMetaElements(document);
	filterStyleElements(document);
	filterHiddenElements(document);
	replaceBreakRuleElements(document);
	filterBoilerplate(document);

	// Must come after boilerplate because that analyzes form data
	filterFormElements(document);
	filterTracerImages(document);
	normalizeWhitespace(document);
	trimTextNodes(document);
	unwrapInlineElements(document);

	// TODO: the filtering of leaves, list singletons, and trimming probably
	// all has to occur together, because each removal op modifies the conditions
	// for later ops (and previous ops). Basically, instead of doing any removal,
	// we want to analyze every element, and tag it is prunable, and then go
	// as far up in the hierarchy as we can, aggregating prunables that share
	// comment ancestors (where no non-prunables also share the same ancestor),
	// and only then do we remove prunables in a top down fashion
	// When analyzing each element, we have to go through several special
	// conditions, such as whether we are at the start of the document or at the
	// end (well, within the expanding regions from either side).

	filterLeaves(document);
	unwrapSingletonLists(document);
	trimDocument(document);

	filterAttributes(document);
}

// Export
this.previewTransform = previewTransform;

// Handles frame, noframes, frameset, and iframe elements
function filterFrameElements(document) {

	// TODO: this may need to be a more general transform that is async
	// and automatically identifies and returns the frame that most likely
	// contains the desired content.

	// Look for the presence of a frameset and lack of a body
	// element, and then remove the frameset and generate a body consisting
	// of either noframes content or an error message.
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
		return;
	}

	// TODO: special handling of iframes

	const framesets = document.querySelectorAll('frameset');
	for(let i = 0, len = framesets.length; i < len; i++) {
		framesets[i].remove();
	}

	const frames = document.querySelectorAll('frame');
	for(let i = 0, len = frames.length; i < len; i++) {
		frames[i].remove();
	}

	const iframes = document.querySelectorAll('iframe');
	for(let i = 0, len = iframes.length; i < len; i++) {
		iframes[i].remove();
	}
}

function filterScriptElements(document) {

	// NOTE: misc event handler attributes for all elements are handled by
	// filterAttributes, which uses a whitelist approach

	// Remove all script tags
	// DOMUtils.removeElementsByName(document, 'script');
	// Apparently we cannot use adoptNode on script
	const scripts = document.querySelectorAll('script');
	for(let i = 0, len = scripts.length; i < len; i++) {
		scripts[i].remove();
	}

	// Due to content-loading tricks, noscript requires special handling
	// e.g. nbcnews.com
	const noscripts = document.querySelectorAll('noscript');
	for(let i = 0, len = noscripts.length; i < len; i++) {
		noscripts[i].remove();
	}

	// Disable anchors that use javascript protocol. Keep the href attribute
	// around for analytical purposes.
	const anchors = document.querySelectorAll('a[href]');
	for(let i = 0, len = anchors.length, anchor; i < len; i++) {
		anchor = anchors[i];
		if(anchor.protocol === 'javascript:') {
			anchor.setAttribute('href', '');
		}
	}
}

function filterMetaElements(document) {

	// <base> is filtered by resolve-document-urls
	// <link> and such is handled by filterStyleElements
	// <script> and such is handled separately

	// Remove these elements if located outside of head in malformed html

	//DOMUtils.removeElementsByName(document, 'head');
	//DOMUtils.removeElementsByName(document, 'meta');
	//DOMUtils.removeElementsByName(document, 'title');

	const heads = document.querySelectorAll('head');
	for(let i = 0, len = heads.length; i < len; i++) {
		heads[i].remove();
	}

	const metas = document.querySelectorAll('meta');
	for(let i = 0, len = metas.length; i < len; i++) {
		metas[i].remove();
	}

	const titles = document.querySelectorAll('title');
	for(let i = 0, len = titles.length; i < len; i++) {
		titles[i].remove();
	}
}

function filterStyleElements(document) {
	// Inline style handled by filterAttributes
	//DOMUtils.removeElementsByName(document, 'style');
	//DOMUtils.removeElementsByName(document, 'link');
	//DOMUtils.removeElementsByName(document, 'basefont');

	const styles = document.querySelectorAll('style, link, basefont');
	for(let i = 0, len = styles.length; i < len; i++) {
		styles[i].remove();
	}

	const elements = document.querySelectorAll(
		'big, blink, font, plaintext, small, tt');
	for(let i = 0, len = elements.length; i < len; i++) {
		DOMUtils.unwrap(elements[i]);
	}
}

function getStyle(element) {
	return element.style;
}

// Removes hidden elements
function filterHiddenElements(document) {
	// NOTE: sacrificed accuracy for better performance
	// NOTE: this only applies to inline styles, not computed style
	const elements = document.querySelectorAll(
		'[style*="display:none"],' +
		'[style*="display: none"],' +
		'[style*="visibility:hidden"],' +
		'[style*="visibility: hidden"],' +
		'[style*="opacity:0.0"],' +
		'[style*="opacity: 0.0"],' +
		'[style*="opacity:0;"]');
	for(let i = 0, len = elements.length, element; i < len; i++) {
		elements[i].remove();
	}
}

// Filters boilerplate from the document
function filterBoilerplate(document) {
	var isContent = createCalamineClassifier(false, document);
	var garbage = document.implementation.createHTMLDocument();
	var elements = document.querySelectorAll('*');
	var numElements = elements.length;
	var element = null;
	for(var i = 0; i < numElements; i++) {
		element = elements[i];
		if(element.ownerDocument === document) {
			if(!isContent(element)) {
				garbage.adoptNode(element);

				// Quick hack to fix issue with unadoptables
				// TODO: check if this is still needed
				element.remove();
			}
		}
	}
}

function filterFormElements(document) {

	var garbage = document.implementation.createHTMLDocument();

	// TODO: adoptNode does not work on select, no idea why, so
	// use element.remove
	// DOMUtils.moveElementsByName(document, garbage, 'select');
	const selects = document.querySelectorAll('select');
	const numSelects = selects.length;
	for(let i = 0; i < numSelects; i++) {
		selects[i].remove();
	}


	//DOMUtils.moveElementsByName(document, garbage, 'option');
	const options = document.querySelectorAll('option');
	for(let i = 0, len = options.length; i < len; i++) {
		options[i].remove();
	}

	// TODO: this is somehow still not happening
	// Something strange is happening here, I am removing a text area
	// but its contents remain?
	//DOMUtils.removeElementsByName(document, 'textarea');

	// error case:
	//http://www.pyimagesearch.com/2015/11/30/
	// detecting-machine-readable-zones-in-passport-images/
	const textareas = document.querySelectorAll('textarea');
	let textArea = null;
	for(let i = 0, len = textareas.length; i < len; i++) {
		textArea = textareas[i];
		textArea.textContext = '';
		// console.debug('Removing %s', textArea.outerHTML);
		textArea.remove();
	}


	//DOMUtils.removeElementsByName(document, 'input');
	const inputs = document.querySelectorAll('input');
	for(let i = 0, len = inputs.length; i < len; i++) {
		inputs[i].remove();
	}

	//DOMUtils.removeElementsByName(document, 'button');
	// adoptNode does not work with button
	const buttons = document.querySelectorAll('button');
	for(let i = 0, len = buttons.length; i < len; i++) {
		buttons[i].remove();
	}

	//DOMUtils.removeElementsByName(document, 'command');
	const commands = document.querySelectorAll('command');
	for(let i = 0, len = commands.length; i < len; i++) {
		commands[i].remove();
	}

	// Certain elements need to be unwrapped instead of removed,
	// because they may contain valuable content. Notably, many html authors
	// use a technique where they wrap content in a form tag.
	const formElements = document.querySelectorAll('form, label');
	for(let i = 0, len = formElements.length; i < len; i++) {
		DOMUtils.unwrap(formElements[i]);
	}
}

function filterEmbeddedElements(document) {

	// TODO: move the handling of 'noembed' into here

	// Remove various components
	// TODO: is object embedded in embed or is embed embedded in object?
	DOMUtils.removeElementsBySelector(document, 'applet');
	DOMUtils.removeElementsBySelector(document, 'object');
	DOMUtils.removeElementsBySelector(document, 'embed');
	DOMUtils.removeElementsBySelector(document, 'param');

	// NOTE: i eventually want to support basic video embedding but
	// for now it is blacklisted. There should probably be some special
	// handler for the video element (or more generally, a media element)
	// including audio
	DOMUtils.removeElementsBySelector(document, 'video');
	DOMUtils.removeElementsBySelector(document, 'audio');
	DOMUtils.removeElementsBySelector(document, 'bgsound');
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

function normalizeWhitespace(document) {
	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_TEXT);
	let node = it.nextNode();
	let value = null;
	while(node) {
		value = node.nodeValue;

		// Skip over a common whitespace nodes
		if(value === '\n' ||
			value === '\n\t' ||
			value === '\n\t\t') {
			node = it.nextNode();
			continue;
		}

		// Normalize non-breaking space entity
		node.nodeValue = value.replace(/&nbsp;/g, ' ');

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
	'ruby, ruby *, textarea, textarea *, xmp, xmp *';

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

// NOTE: This does not contain ALL inline elements, just those we
// want to unwrap. This is different than the set of inline
// elements defined for the purpose of trimming text nodes.
// TODO: some of these would maybe be better handled in other more
// specialized handlers
const UNWRAPPABLE_ELEMENTS = new Set([
	'article',
	'center',
	'colgroup',
	'data',
	'details',
	'div',
	'footer',
	'header',
	'help',
	'hgroup',
	'ilayer',
	'insert',
	'layer',
	'legend',
	'main',
	'mark',
	'marquee',
	'meter',
	'multicol',
	'nobr',
	'noembed',
	'section',
	'span',
	'tbody',
	'tfoot',
	'thead',
]);

const UNWRAPPABLE_SELECTOR = Array.from(UNWRAPPABLE_ELEMENTS).join(',');


// fallback elements (e.g. noscript) are handled separately
function unwrapInlineElements(document) {

	// Special handling for anchors
	// NOTE: this intentionally breaks in-page anchors
	// (e.g. name="x" and href="#x")
	// TODO: what we could do maybe is not unwrap if has name attribute, and
	// then leave in the anchor
	const anchors = document.querySelectorAll('a');
	const numAnchors = anchors.length;
	let anchor = null;
	let href = null;
	for(let i = 0; i < numAnchors; i++) {
		anchor = anchors[i];
		if(anchor.hasAttribute('href')) {
			href = anchor.getAttribute('href');
			href = href || '';
			href = href.trim();
			if(!href) {
				// The anchor had an href, but without a value, so treat it
				// as nominal, and therefore unwrap
				DOMUtils.unwrap(anchor);
			} else {
				if(href.startsWith('#')) {
					// It is an in-page anchor that will no longer work, if,
					// for example, we unwrapped its counterpart
					// Side note: this is actually dumb, because resolve-document-urls
					// makes all anchors absolute, so this condition is never triggered
					// so the test actually needs to be checking against the document's
					// own url, which isn't available to this function at the moment
					DOMUtils.unwrap(anchor);
				}
			}
		} else {
			// It is a nominal anchor, unwrap
			DOMUtils.unwrap(anchor);
		}
	}

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
function filterAttributes(document) {
	const retainableSet = new Set(['href', 'src']);

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
	// console.debug('Unwrapping %s', list.outerHTML);
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

	// console.debug('Parent after unwrap: %s', parent.innerHTML);

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
