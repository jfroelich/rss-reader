// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: resolve xlink type simple (on any attribute)

(function(exports) {
'use strict';

const ELEMENT_URL_ATTRIBUTE_MAP = new Map([
  ['a', 'href'],
  ['applet', 'codebase'],
  ['area', 'href'],
  ['audio', 'src'],
  ['base', 'href'],
  ['blockquote', 'cite'],
  ['body', 'background'],
  ['button', 'formaction'],
  ['del', 'cite'],
  ['embed', 'src'],
  ['frame', 'src'],
  ['head', 'profile'],
  ['html', 'manifest'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['input', 'src'],
  ['ins', 'cite'],
  ['link', 'href'],
  ['object', 'data'],
  ['q', 'cite'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);

const RESOLVE_SELECTOR = function() {
  let keys = [];
  ELEMENT_URL_ATTRIBUTE_MAP.forEach(function(value, key) {
    keys.push(key + '[' + value +']');
  });
  return keys.join(',');
}();

function resolveURLs(document, baseURL) {
  const forEach = Array.prototype.forEach;
  const baseElementList = document.querySelectorAll('base');
  const removeBaseElement = function(baseElement) {
    baseElement.remove();
  };
  forEach.call(baseElementList, removeBaseElement);

  const getNameOfAttributeWithURL = function(element) {
    return ELEMENT_URL_ATTRIBUTE_MAP.get(element.localName);
  };

  const resolvables = document.querySelectorAll(RESOLVE_SELECTOR);
  forEach.call(resolvables, function(element) {
    const attribute = getNameOfAttributeWithURL(element);
    const url = element.getAttribute(attribute).trim();
    const resolved = utils.resolveURL(baseURL, url);
    if(resolved && resolved !== url) {
      element.setAttribute(attribute, resolved);
    }

    if((element.localName === 'img' || element.localName === 'source') &&
      element.hasAttribute('srcset')) {
      resolveImageSrcSet(baseURL, element);
    }
  });
}

// Access an image element's srcset attribute, parses it into an array of
// descriptors, resolves the url for each descriptor, and then composes the
// descriptors array back into a string and modifies the element
function resolveImageSrcSet(baseURL, image) {

  const source = image.getAttribute('srcset');
  let descriptors = parseSrcset(source) || [];
  let numURLsChanged = 0;
  let resolvedDescriptors = descriptors.map(function(descriptor) {
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
  image.setAttribute('srcset', newSource);
}

// Returns a string representing serialized descriptors, which is a suitable
// srcset attribute value for an element
// TODO: THIS IS INCOMPLETE, because I do not yet include the other dimensions
// back into the string, and I am getting image errors in the output
// TODO: support d,w,h
// TODO: do a no-op if the urls were already absolute
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

exports.resolveURLs = resolveURLs;

}(this));
