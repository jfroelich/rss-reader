// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: factor out everything into tiny single-purpose functions.

{ // BEGIN ANONYMOUS NAMESPACE

const filter = Array.prototype.filter;

// Applies a series of transformations to a document in preparation
// for displaying the document in a view or storing the document
function previewTransform(document) {
	filterCommentNodes(document);
	filterFrameElements(document);
	filterScriptElements(document);
	filterEmbeds(document);

	DOMUtils.moveElementsBySelector(document, null, 'head, meta, title, ' +
		'datalist, dialog, fieldset, isindex, math, output, optgroup, ' +
		'progress, spacer, xmp');

	filterStyleElements(document);
	filterHiddenElements(document);
	// filterBreakruleElements(document);
	filterBoilerplate(document);
	filterFormElements(document);
	filterTracerElements(document);
	normalizeNodeWhitespace(document);
	trimTextNodes(document);
	filterInlineElements(document);
	filterLeafElements(document);
	unwrapSingletonLists(document);
	unwrapSingletonTables(document);
	trimDocumentElements(document);
	filterElementAttributes(document);
}

// Export
this.previewTransform = previewTransform;

function filterStyleElements(document) {
	// Inline style handled by filterElementAttributes
	DOMUtils.removeElementsBySelector(document, 'style, link, basefont');
	const elements = document.querySelectorAll(
		'big, blink, font, plaintext, small, tt');
	for(let i = 0, len = elements.length; i < len; i++) {
		DOMUtils.unwrap(elements[i]);
	}
}

// Filters boilerplate from the document
// NOTE: using var due to deopt warnings
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
function filterCommentNodes(document) {
	const it = document.createNodeIterator(document.documentElement,
		NodeFilter.SHOW_COMMENT);
	let comment = it.nextNode();
	while(comment) {
		comment.remove();
		comment = it.nextNode();
	}
}

} // END ANONYMOUS NAMESPACE
