// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// See also https://github.com/kangax/html-minifier/blob/
// gh-pages/src/htmlminifier.js
// TODO: we should probably just make sure such tags are completely removed?

// A map of element names to attributes that contain urls
const ATTRIBUTE_MAP = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['del', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['ins', 'cite'],
  ['link', 'href'],
  ['object', 'data'],
  ['q', 'cite'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

let keys = [];
ATTRIBUTE_MAP.forEach(function(value, key) {
  keys.push(key + '[' + value +']');
});
const RESOLVE_SELECTOR = keys.join(',');

// Resolves all appropriate URLs in the document and removes
// any base tag elements
// TODO: support img srcset
// TODO: support style.backgroundImage?
// NOTE: not supporting applet
// NOTE: iframe.srcdoc?
// NOTE: ignores param values with URIs

function resolveDocumentURLs(document, baseURL) {
  // Remove base elements
  // NOTE: could stripping the base tag could lead to invalid urls???
  // Should the base tag, if present, be considered when resolving elements?
  // Also note that there could be multiple base tags, the logic for
  // handling it properly is all laid out in some RFC standard somewhere,
  // and is probably present in Webkit source.
  const bases = document.querySelectorAll('base');
  const numBases = bases.length;
  for(let i = 0; i < numBases; i++) {
    bases[i].remove();
  }

  // Resolve the attribute values for various elements
  const resolvables = document.querySelectorAll(RESOLVE_SELECTOR);
  const numResolvables = resolvables.length;
  for(let i = 0; i < numResolvables; i++) {
    resolveElement(baseURL, resolvables[i]);
  }
}

this.resolveDocumentURLs = resolveDocumentURLs;

// Resolves one of the URL containing attributes for a given
// element. Private helper for resolveURLs
function resolveElement(baseURL, element) {
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

} // END ANONYMOUS NAMESPACE
