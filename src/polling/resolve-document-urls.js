// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /lib/parse-srcset.js
// Requires: /lib/URI.js
// Requires: /url/parse-url.js

// TODO: fully support img srcset
// TODO: support style.backgroundImage?
// NOTE: not supporting applet
// NOTE: iframe.srcdoc?
// NOTE: ignores param values with URIs
// NOTE: not entirely sure why i have this see also comment, i think
// it was help in defining the attribute map below
// See also https://github.com/kangax/html-minifier/blob/
// gh-pages/src/htmlminifier.js
// NOTE: could stripping the base tag could lead to invalid urls???
// Should the base tag, if present, be considered when resolving elements?
// Also note that there could be multiple base tags, the logic for
// handling it properly is all laid out in some RFC standard somewhere,
// and is probably present in Webkit source.

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

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
// TODO: this should probably be rewritten to only inspect relevant attributes
// per element type, instead of a general map?

function resolveDocumentURLs(document, baseURL) {

  // Remove base elements

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

  // Hackish support for srcset, we do another pass over images
  // to handle the srcset attribute
  const images = document.querySelectorAll('img[srcset]');
  const numImages = images.length;
  for(let i = 0; i < numImages; i++) {
    resolveImageSrcSet(baseURL, images[i]);
  }
}

this.resolveDocumentURLs = resolveDocumentURLs;

// Resolves one of the URL containing attributes for a given
// element.
// TODO: use a more qualified or clearer function name, this resolves the
// value for a particular url-containing attribute of the element
function resolveElement(baseURL, element) {
  const attributeName = ATTRIBUTE_MAP.get(element.localName);

  // We know attribute is defined because the selector
  // included the condition (e.g. element[attribute])
  const url = element.getAttribute(attributeName).trim();

  const resolved = resolveURL(baseURL, url);

  if(resolved && resolved !== url) {
    element.setAttribute(attributeName, resolved);
  }
}

// Access an image element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
// TODO: now that this allows srcset, it needs to also resolve srcset urls,
// because they are leading to bad images:
// e.g.: <img width="18" height="18" src="/Design/graphics/icon/reddit.png"
// srcset="/Design/graphics/icon/reddit.svg" alt="reddit"> becomes
// <img src="http://www.theregister.co.uk/Design/graphics/icon/reddit.png"
// srcset="/Design/graphics/icon/reddit.svg" alt="reddit">
// and the srcset prevails (takes priority?) but is not an absolute url
// TODO: another idea is to have a transform that looks for both src and
// srcset, and if src is present, removes srcset
// NOTE: the caller only passes images that have a srcset attribute
function resolveImageSrcSet(baseURL, image) {
  const srcSetString = image.getAttribute('srcset');

  // NOTE: this may also require https://github.com/mathiasbynens/he
  // which is an html entity encoder/decoder
  // which i have not tested or incorporated yet,
  // i am basing that idea on the fact that alex's tests do
  // encoding before calling parseSrcset
  // as seen in
  // https://github.com/albell/parse-srcset/blob/master/tests/unit/ps.js

  // parseSrcset returns Array [{url: _, d: _, w: _, h:_}, ...]
  let descriptors = parseSrcset(srcSetString) || [];
  const numDescriptors = descriptors.length;

  for(let i = 0, descriptor, resolvedURL; i < numDescriptors; i++) {
    descriptor = descriptors[i];
    // note: this previously forgot to pass in baseURL, this may have
    // been part of the cause of the errors
    resolvedURL = resolveURL(baseURL, descriptor.url);

    if(!resolvedURL) {
      console.debug('resolved was undefined after resolveURL(%s,%s)',
        baseURL, descriptor.url);
    }

    if(resolvedURL && resolvedURL !== descriptor.url) {
      // console.debug('Resolved %s to %s', descriptor.url, resolvedURL);
      descriptor.url = resolvedURL;
    }
  }

  // Reserialize
  const newSrcSetString = serializeSrcSet(descriptors);

  // Update the element
  console.debug('Changing srcset %s to %s', srcSetString, newSrcSetString);
  image.setAttribute('srcset', newSrcSetString);
}

// Returns a string representing serialized descriptors
// TODO: THIS IS INCOMPLETE, because i do not yet include
// the other dimensions back into the string, i am getting
// image errors in the output
// TODO: support d,w,h
function serializeSrcSet(descriptors) {
  const resolvedDescriptors = [];
  const numDescriptors = descriptors.length;

  for(let i = 0, descriptor, newString; i < numDescriptors; i++) {
    descriptor = descriptors[i];
    newString = descriptor.url;

    if(descriptor.d) {
      // newString += ' ' + descriptor.d;
    }

    if(descriptor.w) {
      // newString += ' ' + descriptor.w + 'w';
    }

    if(descriptor.h) {
      // newString += ' ' + descriptor.h + 'h';
    }

    resolvedDescriptors.push(newString);
  }


  // i believe a comma is what joins? have not researched

  return resolvedDescriptors.join(', ');
}

} // END ANONYMOUS NAMESPACE
