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
	filterFrames(document);
	filterScripts(document);
	filterEmbeds(document);

	// Remove misc. elements
	DOMUtils.moveElementsBySelector(document, null,
		'datalist, dialog, fieldset, isindex, math, output, optgroup, progress,' +
		'spacer, xmp');

	filterMetaElements(document);
	filterStyleElements(document);
	filterHiddenElements(document);

	// Disabled
	// e.g. see http://paulgraham.com/procrastination.html
	// filterBreaks(document);

	filterBoilerplate(document);

	// Must come after boilerplate because that analyzes form data
	filterFormElements(document);
	filterTracerImages(document);
	normalizeWhitespace(document);
	trimTextNodes(document);

	// TODO: filtering leaves, singletons, and trimming probably
	// all has to occur together
	filterInlineElements(document);
	filterLeaves(document);
	unwrapSingletonLists(document);
	unwrapSingletonTables(document);
	trimDocument(document);

	filterAttributes(document);
}

// Export
this.previewTransform = previewTransform;

// Handles frame, noframes, frameset, and iframe elements
function filterFrames(document) {

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
	DOMUtils.removeElementsBySelector(document, 'frameset, frame, iframe');
}

function filterScripts(document) {

	// NOTE: misc event handler attributes for all elements are handled by
	// filterAttributes, which uses a whitelist approach

	// Remove all script tags
	DOMUtils.removeElementsBySelector(document, 'script');

	// Due to content-loading tricks, noscript requires special handling
	// e.g. nbcnews.com. For now, just remove.
	DOMUtils.removeElementsBySelector(document, 'noscript');

	// Disable anchors that use javascript protocol. Keep the href
	// around for analysis.
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
	DOMUtils.moveElementsBySelector(document, null, 'head, meta, title');
}

function filterStyleElements(document) {
	// Inline style handled by filterAttributes
	DOMUtils.removeElementsBySelector(document, 'style, link, basefont');
	const elements = document.querySelectorAll(
		'big, blink, font, plaintext, small, tt');
	for(let i = 0, len = elements.length; i < len; i++) {
		DOMUtils.unwrap(elements[i]);
	}
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
	DOMUtils.moveElementsBySelector(document, null,
		'select, option, textarea, input, button, command');
	const forms = document.querySelectorAll('form, label');
	for(let i = 0, len = forms; i < len; i++) {
		DOMUtils.unwrap(forms[i]);
	}
}

function filterEmbeds(document) {
	// TODO: move the handling of 'noembed' into here
	// NOTE: i eventually want to support basic video embedding but
	// for now it is blacklisted.
	// Remove various components
	DOMUtils.moveElementsBySelector(document, null,
		'applet, object, embed, param, video, audio, bgsound');
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
function filterBreaks(document) {
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

// Removes attributes from elements in the document, except for href/src
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
