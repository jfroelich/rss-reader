// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: this is only ever used by poll.js, maybe I should just integrate
// it back into poll.js. It doesn't really serve as an independent component.

// TODO: resolve xlink type simple (on any attribute) in xml docs
// TODO: finish implementing URLResolver.serializeSrcSet
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


const URLResolver = {};

// Resolves all urls in a document, such as element attribute values
// TODO: use a clearer name
URLResolver.resolveURLsInDocument = function(document, baseURL) {
  URLResolver.removeBaseElements(document);
  URLResolver.modifyAllURLAttributes(document, baseURL);
};

// Remove base. base is blacklisted in sanitize-document.js but the integrity
// of this module if used independently requires this behavior.
URLResolver.removeBaseElements = function(document) {
  const bases = document.querySelectorAll('base');
  const numBases = bases.length;
  for(let i = 0; i < numBases; i++) {
    bases[i].remove();
  }
};

URLResolver.URL_ATTRIBUTE_MAP = {
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

URLResolver.generateSelectorPart = function(key) {

  // NOTE: using lowercase because I have occassionally seen counterintuitive
  // behavior with uppercase element names in CSS (like in
  // Element.prototype.matches)

  return key + '[' + URLResolver.URL_ATTRIBUTE_MAP[key] +']';
};

URLResolver.ELEMENT_SELECTOR = Object.keys(URLResolver.URL_ATTRIBUTE_MAP).map(
  URLResolver.generateSelectorPart).join(', ');

URLResolver.modifyAllURLAttributes = function(document, baseURLString) {

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
  const elements = document.querySelectorAll(URLResolver.ELEMENT_SELECTOR);
  const numElements = elements.length;
  for(let i = 0, element, elementName, attribute, originalURL, resolvedURL;
    i < numElements; i++) {
    element = elements[i];

    elementName = element.nodeName;
    attribute = URLResolver.URL_ATTRIBUTE_MAP[elementName];

    // Default to empty string to ensure originalURL is defined, apparently
    // it can sometimes be undefined, not sure why.
    originalURL = element.getAttribute(attribute) || '';
    // Attribute values can have wrapping spaces and still be valid, so trim
    // This helps the non-empty check and also avoids any oddness with how
    // 'new URL' in resolveURL treats whitespace padded urls.
    originalURL = originalURL.trim();

    // Check if url is non-empty so that we skip processing empty strings
    if(originalURL) {
      resolvedURL = URLResolver.resolveURL(baseURL, originalURL);
      if(resolvedURL && resolvedURL !== originalURL) {
        element.setAttribute(attribute, resolvedURL);
      }
    }

    // Resolve srcsets
    if((element.nodeName === 'IMG' || element.nodeName === 'SOURCE') &&
      element.hasAttribute('srcset')) {
      URLResolver.resolveSrcSet(baseURL, element);
    }
  }
};

// TODO: do I even need the try catch? Do I even need this function?
URLResolver.resolveURL = function(baseURL, urlString) {
  try {
    const url = new URL(urlString, baseURL);
    return url.href;
  } catch(exception) {
    console.debug('Error:', exception.message, baseURL, urlString);
  }

  return urlString;
};

// Access an element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
URLResolver.resolveSrcSet = function(baseURL, element) {
  const source = element.getAttribute('srcset');
  let descriptors = parseSrcset(source) || [];
  let numURLsChanged = 0;
  let resolvedDescriptors = descriptors.map(function transform(descriptor) {
    const resolvedURL = URLResolver.resolveURL(baseURL, descriptor.url);
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

  const newSource = URLResolver.serializeSrcSet(resolvedDescriptors);
  console.debug('Changing srcset %s to %s', source, newSource);
  element.setAttribute('srcset', newSource);
};

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE
// TODO: support d,w,h
// TODO: i am also seeing something like url 2x or 1.5x, what's "x"? i assume
// it is something like zoom level (2x is 2 times size)
URLResolver.serializeSrcSet = function(descriptors) {
  const resolvedDescriptors = [];
  const numDescriptors = descriptors.length;

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

  // There must be a comma after the space, otherwise a comma can be
  // misinterpreted as part of the url (I guess?). I witnessed image fetch
  // errors where it looked like this was the case.
  return resolvedDescriptors.join(', ');
};
