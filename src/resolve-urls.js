// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: do some additional testing after recent changes, i didn't see any
// images appear in the output

// TODO: resolve xlink type simple (on any attribute)
// TODO: finish implementing serializeSrcSet
// TODO: rather than do a separate check for srcset, it should somehow be
// in the main map. but then that means we can't use a map because we
// have dup keys. so maybe the map needs to instead contain arrays of
// attribute names (similarly, support longdesc in iframe)
// TODO: look into whether srcset can be anywhere or just in img/source els

// Requires: /src/utils.js

(function(exports) {
'use strict';

function resolveURLs(document, baseURL) {
  removeBaseElements(document);
  modifyResolvableAttributes(document, baseURL);
}

exports.resolveURLs = resolveURLs;

// Remove base. base is blacklisted in sanitize-document.js but the integrity
// of this module if used independently requires this behavior.
function removeBaseElements(document) {
  for(let bases = document.querySelectorAll('base'), i = 0,
    len = bases.length; i < len; i++) {
    bases[i].remove();
  }
}

function modifyResolvableAttributes(document, baseURL) {
  const elements = document.querySelectorAll(RESOLVE_SELECTOR);
  const resolveURL = utils.resolveURL;
  for(let i = 0, len = elements.length, element, attribute, originalURL,
    resolvedURL; i < len; i++) {
    element = elements[i];
    attribute = getURLAttribute(element);
    originalURL = element.getAttribute(attribute).trim();
    resolvedURL = resolveURL(baseURL, originalURL);
    if(resolvedURL && resolvedURL !== originalURL) {
      element.setAttribute(attribute, resolvedURL);
    }

    // Resolve srcsets
    if((element.localName === 'img' || element.localName === 'source') &&
      element.hasAttribute('srcset')) {
      resolveSrcSetAttribute(baseURL, element);
    }
  }
}

const URL_ATTRIBUTE = {
  'a': 'href',
  'applet': 'codebase',
  'area': 'href',
  'audio': 'src',
  // base elements are always removed, but i am leaving this in here
  // for completeness
  'base': 'href',
  'blockquote': 'cite',
  'body': 'background',
  'button': 'formaction',
  'del': 'cite',
  'embed': 'src',
  'frame': 'src',
  'head': 'profile',
  'html': 'manifest',
  'iframe': 'src',
  'form': 'action',
  'img': 'src',
  'input': 'src',
  'ins': 'cite',
  'link': 'href',
  'object': 'data',
  'q': 'cite',
  'script': 'src',
  'source': 'src',
  'track': 'src',
  'video': 'src'
};

const RESOLVE_SELECTOR = Object.keys(URL_ATTRIBUTE).map(function(key) {
  return key + '[' + URL_ATTRIBUTE[key] +']';
}).join(',');

console.debug(RESOLVE_SELECTOR);

function getURLAttribute(element) {
  return URL_ATTRIBUTE[element.localName];
}

function removeElement(element) {
  element.remove();
}

// Access an element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
function resolveSrcSetAttribute(baseURL, element) {

  const source = element.getAttribute('srcset');
  let descriptors = parseSrcset(source) || [];
  let numURLsChanged = 0;
  let resolvedDescriptors = descriptors.map(function transform(descriptor) {
    const resolvedURL = utils.resolveURL(baseURL, descriptor.url);
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

  const newSource = serializeSrcSet(resolvedDescriptors);
  console.debug('Changing srcset %s to %s', source, newSource);
  element.setAttribute('srcset', newSource);
}

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE, because I do not yet include the other dimensions
// back into the string, and I am getting image errors in the output
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
  return resolvedDescriptors.join(',');
}

}(this));
