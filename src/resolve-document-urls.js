// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Resolves all urls in a document, such as element attribute values

// TODO: expect baseURLString to be a URL object and rename it
// TODO: resolve xlink type simple (on any attribute) in xml docs
// TODO: finish implementing serializeSrcSet
// TODO: rather than do a separate check for srcset, it should somehow be
// in the main map. but then that means we can't use a map because we
// have dup keys. so maybe the map needs to instead contain arrays of
// attribute names (similarly, support longdesc in iframe)
// TODO: look into whether srcset can be anywhere or just in img/source els
// TODO: maybe do not remove base, maybe that is not this functions role, but
// some other more general responsibility of calling context. After all, if
// all urls are absolute then leaving in base has no effect. it is only the
// caller in poll.js that is concerned about prepping
// the document for render and caring about removing base elements
// TODO: i should not even trying to resolve javascript urls, i think, so it
// may be worthwhile to filter those out of the document before resolving
// link urls, i noticed that the resolver routinely fails on those urls
// although i need to test this again after switching to using the native
// URL object to do the resolution

function resolveDocumentURLs(document, baseURLString) {

  // Remove base elements. This is redundant with domaid functionality but
  // I prefer not to assume this happens.
  const bases = document.querySelectorAll('base');
  for(let i = 0, len = bases.length; i < len; i++) {
    let base = bases[i];
    base.remove();
  }

  const URL_ATTRIBUTE_MAP = {
    'A': 'href',
    'APPLET': 'codebase',
    'AREA': 'href',
    'AUDIO': 'src',
    'BASE': 'href',
    'BLOCKQUOTE': 'cite',
    'BODY': 'background',
    'BUTTON': 'formaction',
    'DEL': 'cite',
    'EMBED': 'src',
    'FRAME': 'src',
    'HEAD': 'profile',
    'HTML': 'manifest',
    'IFRAME': 'src',
    'FORM': 'action',
    'IMG': 'src',
    'INPUT': 'src',
    'INS': 'cite',
    'LINK': 'href',
    'OBJECT': 'data',
    'Q': 'cite',
    'SCRIPT': 'src',
    'SOURCE': 'src',
    'TRACK': 'src',
    'VIDEO': 'src'
  };

  function generateSelectorPart(key) {
    return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
  }

  const ELEMENT_SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(
    generateSelectorPart).join(', ');

  // Create a URL object of the base url string once here.
  // Assumes baseURLString contains a valid URL
  const baseURL = new URL(baseURLString);

  // TODO: i want to modify this so that I do not also check for
  // srcset, I would rather be iterating over all elements, or iterate over
  // srcset elements separately.

  // NOTE: The selector matches elements with attributes, but it does not
  // guarantee those attributes have values. Apparently, calling getAttribute
  // on a matched element (from elName[attName]) can even yield undefined
  // sometimes, and sometimes empty string, so we need to guard against that
  // case.

  // Note this is not restricted to elements in the body, because there
  // are resolvable elements in the head, and <html> itself has a
  // resolvable attribute.
  const elements = document.querySelectorAll(ELEMENT_SELECTOR);
  const numElements = elements.length;

  for(let i = 0; i < numElements; i++) {
    let element = elements[i];
    let elementName = element.nodeName;
    let attribute = URL_ATTRIBUTE_MAP[elementName];

    let originalURL = element.getAttribute(attribute) || '';
    originalURL = originalURL.trim();

    if(originalURL) {
      let resolvedURLString = resolveURL(originalURL);
      if(resolvedURLString && resolvedURLString !== originalURL) {
        element.setAttribute(attribute, resolvedURLString);
      }
    }

    // Resolve srcsets
    if((element.nodeName.toUpperCase() === 'IMG' ||
      element.nodeName.toUpperCase() === 'SOURCE') &&
      element.hasAttribute('srcset')) {
      resolveSrcSet(element);
    }
  }

  function resolveURL(urlString) {
    try {
      const url = new URL(urlString, baseURL);
      return url.href;
    } catch(exception) {
      console.debug('Error:', exception.message, baseURL.href, urlString);
    }

    return urlString;
  }

  // Access an element's srcset attribute, parses it into an array of
  // descriptors, resolves the url for each descriptor, and then composes the
  // descriptors array back into a string and modifies the element
  function resolveSrcSet(element) {
    const source = element.getAttribute('srcset');
    let descriptors = parseSrcset(source) || [];
    let numURLsChanged = 0;
    let resolvedDescriptors = descriptors.map(function transform(descriptor) {
      const resolvedURL = resolveURL(descriptor.url);
      let newURL = descriptor.url;
      if(resolvedURL && resolvedURL !== descriptor.url) {
        newURL = resolvedURL;
        numURLsChanged++;
      }

      return {
        url: newURL, d: descriptor.d, w: descriptor.w, h: descriptor.h
      };
    });

    if(numURLsChanged === 0) {
      return;
    }

    const newSrcSet = serializeSrcSet(resolvedDescriptors);
    console.debug('Changing srcset %s to %s', source, newSrcSet);
    element.setAttribute('srcset', newSrcSet);
  }

  // Returns a string representing serialized descriptors, which is a suitable
  // srcset attribute value for an element
  // TODO: THIS IS INCOMPLETE
  // TODO: support d,w,h
  // TODO: i am also seeing something like url 2x or 1.5x, what's "x"? i assume
  // it is something like zoom level (2x is 2 times size)
  function serializeSrcSet(descriptors) {
    const resolvedDescriptors = [];
    const numDescriptors = descriptors.length;

    // TODO: use for .. of

    for(let i = 0, descriptor, newString; i < numDescriptors; i++) {
      descriptor = descriptors[i];

      console.debug('Descriptor:', descriptor);

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

    return resolvedDescriptors.join(', ');
  }
}
