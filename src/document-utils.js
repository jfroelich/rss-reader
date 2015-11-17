// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Document utility functions
const DocumentUtils = {};

{ // BEGIN LEXICAL SCOPE

const ATTRIBUTE_MAP = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['link', 'href'],
  ['object', 'data'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

// Statically create the RESOLVE_SELECTOR value from 
// the attribute map
let keys = [];
ATTRIBUTE_MAP.forEach(function(value, key) {
  keys.push(key + '[' + value +']');
});
const RESOLVE_SELECTOR = keys.join(',');

// Resolves all appropriate URLs in the document and removes 
// any base tag elements
// TODO: support img srcset
// TODO: support style.backgroundImage?
// TODO: the new template tag?
// NOTE: not supporting applet
// NOTE: iframe.srcdoc?
// NOTE: ignores param values with URIs
// NOTE: could stripping the base tag could lead to invalid urls??? 
// Should the base tag, if present, be considered when resolving elements?
// Also note that there could be multiple base tags, the logic for 
// handling it properly is all laid out in some RFC standard somewhere, 
// and is probably present in Webkit source.
function resolveURLs(document, baseURL) {

	const wrapped = HTMLDocumentWrapper.wrap(document);

	// Remove base elements
	const bases = wrapped.getElementsByTagName('base');
  bases.forEach(remove);

  // Resolve the attribute values for various elements
  const resolvables = wrapped.querySelectorAll(RESOLVE_SELECTOR);
  resolvables.forEach(resolveElement);
}

// Export global
DocumentUtils.resolveURLs = resolveURLs;

// Resolves one of the URL containing attributes for a given 
// element
function resolveElement(element) {
  const attributeName = ATTRIBUTE_MAP.get(element.localName);

  // We know attribute is defined because the selector
  // included the condition (e.g. element[attribute])
  const url = element.getAttribute(attributeName).trim();
  try {
    const uri = new URI(url);
    if(!uri.protocol()) {
      const resolved = uri.absoluteTo(baseURL).toString();
      element.setAttribute(attributeName, resolved);
    }
  } catch(e) {
    // Ignore url errors
  }
}

// Private helper for resolveURLs
function remove(element) {
  element.remove();
}

// Asynchronously attempts to set the width and height for 
// all image elements
function setImageDimensions(document, callback) {
  const images = document.getElementsByTagName('img');
  async.forEach(images, ImageUtils.fetchDimensions, callback);
}

// Export global
DocumentUtils.setImageDimensions = setImageDimensions;

} // END LEXICAL SCOPE
