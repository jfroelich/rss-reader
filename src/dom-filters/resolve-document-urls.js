// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function resolveDocumentURLs(document, baseURL) {
  for(let base of document.querySelectorAll('base')) {
    base.remove();
  }

  resolveDocumentURLsResolveElements(document, baseURL);
  resolveDocumentURLsResolveSrcsets(document, baseURL);
}

function resolveDocumentURLsResolveElements(document, baseURL) {

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

  const SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(function(key) {
    return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
  }).join(',');

  const elements = document.querySelectorAll(SELECTOR);
  for(let element of elements) {
    const elementName = element.nodeName.toUpperCase();

    const attributeName = URL_ATTRIBUTE_MAP[elementName];
    if(!attributeName) {
      continue;
    }

    const attributeValue = element.getAttribute(attributeName);
    if(!attributeValue) {
      continue;
    }

    if(/^\s*https?:\/\/#/i.test(attributeValue)) {
      element.remove();
      continue;
    }

    const resolvedURL = resolveDocumentURLsResolveURL(attributeValue, baseURL);
    // TODO: not equals is weak comparison because it ignores spaces and
    // is case sensitive, maybe make it stronger
    if(resolvedURL && resolvedURL.href !== attributeValue) {
      element.setAttribute(attributeName, resolvedURL.href);
    }
  }
}

function resolveDocumentURLsResolveSrcsets(document, baseURL) {
  const elements = document.querySelectorAll('img[srcset], source[srcset]');
  for(let element of elements) {
    const attributeValue = element.getAttribute('srcset');
    if(attributeValue) {
      const srcset = parseSrcset(attributeValue);
      if(srcset && srcset.length) {
        let dirtied = false;
        for(let descriptor of srcset) {
          const resolvedURL = resolveDocumentURLsResolveURL(descriptor.url,
            baseURL);
          if(resolvedURL && resolvedURL.href !== descriptor.url) {
            dirtied = true;
            descriptor.url = resolvedURL.href;
          }
        }

        if(dirtied) {
          const newSrcsetValue = resolveDocumentURLsSerializeSrcset(srcset);
          if(newSrcsetValue && newSrcsetValue !== attributeValue) {
            element.setAttribute('srcset', newSrcsetValue);
          }
        }
      }
    }
  }
}

function resolveDocumentURLsSerializeSrcset(descriptorsArray) {
  const outputStringBuffer = [];
  for(let descriptor of descriptorsArray) {
    let descriptorStringBuffer = [descriptor.url];
    if(descriptor.d) {
      descriptorStringBuffer.push(' ');
      descriptorStringBuffer.push(descriptor.d);
      descriptorStringBuffer.push('x');
    } else if(descriptor.w) {
      descriptorStringBuffer.push(' ');
      descriptorStringBuffer.push(descriptor.w);
      descriptorStringBuffer.push('w');
    } else if(descriptor.h) {
      descriptorStringBuffer.push(' ');
      descriptorStringBuffer.push(descriptor.h);
      descriptorStringBuffer.push('h');
    }

    outputStringBuffer.push(descriptorStringBuffer.join(''));
  }

  // The space is important
  return outputStringBuffer.join(', ');
}

function resolveDocumentURLsResolveURL(urlString, baseURL) {
  if(urlString && !/^\s*javascript:/i.test(urlString) &&
    !/^\s*data:/i.test(urlString)) {
    try {
      return new URL(urlString, baseURL);
    } catch(exception) {
      console.warn(urlString, baseURL.href, exception);
    }
  }
}
