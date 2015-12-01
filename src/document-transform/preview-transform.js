// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: apply the blacklist filter after calamine instead of before
// maybe the blacklist filter should only flag elements instead
// of doing dom modification at first, and then do deferred manipulation?
// or maybe Calamine should be modified to include the blacklist filtering
// because it fits into original goal of boilerplate classification and
// removal (instead of just identifying a best element)
// neither actually, we do some filtering in blacklist, and we modify calamine
// do classify certain elements (after finding bestelement) as boilerplate.

// TODO: Regarding dep injection, where should the wiring take place? It is
// only the slideshow context where this particular composition of transforms
// occurs, so maybe this shouldn't be doing the wiring itself, and instead
// just be a file that contains a host of transforms, and the actual composition
// should occur in the view code.

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
	DOMUtils.removeElementsByName(document, 'datalist');
	DOMUtils.removeElementsByName(document, 'dialog');
	DOMUtils.removeElementsByName(document, 'fieldset');
	DOMUtils.removeElementsByName(document, 'isindex');
	DOMUtils.removeElementsByName(document, 'math');
	DOMUtils.removeElementsByName(document, 'output');
	DOMUtils.removeElementsByName(document, 'optgroup');
	DOMUtils.removeElementsByName(document, 'progress');
	DOMUtils.removeElementsByName(document, 'spacer');
	DOMUtils.removeElementsByName(document, 'xmp');

	filterMetaElements(document);
	filterStyleElements(document);

	// TODO: document should be the last argument so that we can support
	// a partial?
	const hiddenExceptions = new Set(['noembed']);
	filterHiddenElements(document, hiddenExceptions, 0.3);
	replaceBreakRuleElements(document);
	filterBoilerplate(document);

	// Must come after boilerplate because that analyzes form data
	filterFormElements(document);
	filterTracerImages(document);
	normalizeWhitespace(document);
	trimTextNodes(document);
	//transformScriptAnchors(document);
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

	// side note, this is the final step, because it isn't removing elements
	// or nodes, just element attributes
	// TODO: document should be the last argument so that we can support
	// a partial?
	const retainableAttributes = new Set(['href', 'src']);
	filterAttributes(document, retainableAttributes);
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

	// If we're still here, make sure these elements are no longer present
	DOMUtils.removeElementsByName(document, 'frameset');
	DOMUtils.removeElementsByName(document, 'frame');

	// TODO: eventually i want to do special handling of
	// iframes, for now, iframes are not supported.
	DOMUtils.removeElementsByName(document, 'iframe');
}


function filterScriptElements(document) {

	// NOTE: misc event handler attributes are handled by
	// filterAttributes

	// Remove all script tags
	DOMUtils.removeElementsByName(document, 'script');


	// TODO: move javascript anchor handling into here

	// Due to content-loading tricks, noscript requires special handling
	// e.g. nbcnews.com

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

	// Modify anchors that use javascript
	const RE_JAVASCRIPT_PROTOCOL = /^\s*javascript\s*:/i;

	const anchors = document.body.querySelectorAll('a[href]');
	const numAnchors = anchors.length;
	let href = null;
	let anchor = null;
	for(let i = 0; i < numAnchors; i++) {
		anchor = anchors[i];
		href = anchor.getAttribute('href');
		if(RE_JAVASCRIPT_PROTOCOL.test(href)) {
			// console.log('Modifying javascript anchor %s', anchor.outerHTML);

			// We do not remove the attribute, because we want use it as criteria
			// when analyzing boilerplate. So we just set its value to empty.
			anchor.setAttribute('href', '');
		}
	}
}

// Filters boilerplate from the document
function filterBoilerplate(document) {

	// TODO: models was probably a bad name, these are more like
	// feature extractors or something
	// TODO: the extractors should probably be generating separate
	// score maps instead of combining everything into the main
	// score map. that should not happen until scoring occurs later.

	const models = [
		modelTextBias,
		modelIntrinsicBias,
		modelHierarchicalBias,
		modelImageBias,
		modelAttributeBias,
		modelMicrodataBias
	];

	const isContent = createCalamineClassifier(models, false, document);

	const elementIterator = document.createNodeIterator(
		document.body, NodeFilter.SHOW_ELEMENT);
	let element = elementIterator.nextNode();
	while(element) {
		if(!isContent(element)) {
			element.remove();
		}

		element = elementIterator.nextNode();
	}
}

function filterMetaElements(document) {

	// <base> is filtered by resolve-document-urls
	// <link> and such is handled by filterStyleElements
	// <script> and such is handled separately

	DOMUtils.removeElementsByName(document, 'head');

	// Remove these elements if located outside of head in malformed html
	DOMUtils.removeElementsByName(document, 'meta');
	DOMUtils.removeElementsByName(document, 'title');
}

function filterStyleElements(document) {
	// We use custom styling, so remove all CSS. Inline style
	// handled by filterAttributes
	DOMUtils.removeElementsByName(document, 'style');
	DOMUtils.removeElementsByName(document, 'link');
	DOMUtils.removeElementsByName(document, 'basefont');

	// Unwrap style elements that may contain content
	const fontElements = document.querySelectorAll(
		'big, blink, font, plaintext, small, tt');
	for(let i = 0, len = fontElements.length; i < len; i++) {
		DOMUtils.unwrap(fontElements[i]);
	}
}

function filterFormElements(document) {
	// form unwrap also belongs there
	DOMUtils.removeElementsByName(document, 'select');
	DOMUtils.removeElementsByName(document, 'option');
	DOMUtils.removeElementsByName(document, 'textarea');
	DOMUtils.removeElementsByName(document, 'input');
	DOMUtils.removeElementsByName(document, 'button');
	DOMUtils.removeElementsByName(document, 'command');

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
	DOMUtils.removeElementsByName(document, 'applet');
	DOMUtils.removeElementsByName(document, 'object');
	DOMUtils.removeElementsByName(document, 'embed');
	DOMUtils.removeElementsByName(document, 'param');

	// NOTE: i eventually want to support basic video embedding but
	// for now it is blacklisted. There should probably be some special
	// handler for the video element (or more generally, a media element)
	// including audio
	DOMUtils.removeElementsByName(document, 'video');
	DOMUtils.removeElementsByName(document, 'audio');
	DOMUtils.removeElementsByName(document, 'bgsound');
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
	const anchors = document.body.querySelectorAll('a');
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
