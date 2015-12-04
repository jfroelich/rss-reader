// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE


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
function filterInlineElements(document) {

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

this.filterInlineElements = filterInlineElements;

} // END ANONYMOUS NAMESPACE
