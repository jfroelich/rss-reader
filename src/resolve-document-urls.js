// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

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


// Resolves all urls in a document, such as element attribute values
// TODO: resolve xlink type simple (on any attribute) in xml docs
// TODO: i should not even trying to resolve javascript urls, i think, so it
// may be worthwhile to filter those out of the document before resolving
// link urls, i noticed that the resolver routinely fails on those urls
// although i need to test this again after switching to using the native
// URL object to do the resolution
// NOTE: if all urls are absolute I could technically leave base elements
// in the output. However, I think it is better to compress anyway.
function resolveDocumentURLs(document, baseURL) {
  filterBaseElements(document);
  resolveElementsWithURLAttributes(document, baseURL);
  resolveElementsWithSrcsetAttributes(document, baseURL);
}

function selectElementsWithURLAttributes(document) {
  const SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(function(key) {
    return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
  }).join(', ');
  return document.querySelectorAll(SELECTOR);
}

function resolveElementsWithURLAttributes(document, baseURL) {
  const elements = selectElementsWithURLAttributes(document);
  for(let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i];
    const elementName = element.nodeName.toUpperCase();

    const attributeName = URL_ATTRIBUTE_MAP[elementName];
    if(!attributeName) {
      continue;
    }

    const attributeValue = element.getAttribute(attributeName);
    if(!attributeValue) {
      continue;
    }

    const resolvedURL = resolveURL(attributeValue, baseURL);
    if(!resolvedURL) {
      continue;
    }

    if(resolvedURL.href !== attributeValue) {
      element.setAttribute(attributeName, resolvedURL.href);
    }
  }
}

function resolveElementsWithSrcsetAttributes(document, baseURL) {
  const elements = document.querySelectorAll(
    'img[srcset], source[srcset]');
  for(let i = 0, len = elements.length; i < len; i++) {
    const element = elements[i];
    const srcsetAttributeValue = element.getAttribute('srcset');

    if(!srcsetAttributeValue) {
      continue;
    }

    const srcset = parseSrcset(srcsetAttributeValue);
    if(!srcset) {
      continue;
    }

    for(let j = 0, len = srcset.length; j < len; j++) {
      const descriptor = srcset[i];
      if(descriptor) {
        const resolvedURL = resolveURL(descriptor.url, baseURL);
        if(resolvedURL) {
          descriptor.url = resolvedURL.href;
        }
      }
    }

    const newSrcsetValue = serializeSrcset(srcset);
    if(newSrcsetValue && newSrcsetValue !== srcsetAttributeValue) {
      element.setAttribute('srcset', newSrcsetValue);
    }
  }
}

function filterBaseElements(document) {
  const bases = document.querySelectorAll('base');
  for(let i = 0, len = bases.length; i < len; i++) {
    bases[i].remove();
  }
}
