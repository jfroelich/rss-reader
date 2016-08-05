// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Asynchronously fetches an html file and prepares it for local render and
// storage. URLs are resolved, image dimensions are set, some invalid or
// unwanted images are removed.
function fetchHTML(requestURL, timeoutMillis, callback) {
  console.assert(requestURL && requestURL.href, 'requestURL is required');
  console.log('GET', requestURL.href);

  const request = new XMLHttpRequest();
  if(timeoutMillis) {
    request.timeout = timeoutMillis;
  }

  const onFetch = fetchHTMLOnFetch.bind(request, requestURL, callback);
  request.ontimeout = onFetch;
  request.onerror = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  const isAsync = true;
  request.open('GET', requestURL.href, isAsync);
  request.responseType = 'document';
  request.setRequestHeader('Accept', 'text/html');
  request.send();
}

function fetchHTMLOnFetch(requestURL, callback, event) {
  if(event.type !== 'load') {
    console.warn(event.type, event.target.status, event.target.statusText,
      requestURL.href);
    callback({'type': 'FetchError', 'requestURL': requestURL});
    return;
  }

  const document = event.target.responseXML;
  if(!document) {
    console.warn('Undefined document', requestURL.href);
    callback({'type': 'UndefinedDocumentError', 'requestURL': requestURL});
    return;
  }

  const outputEvent = {
    'type': 'success',
    'requestURL': requestURL,
    'document': document,
    'responseURL': new URL(event.target.responseURL)
  };

  transformLazyImages(document);
  filterSourcelessImages(document);
  fetchHTMLResolveURLs(document, outputEvent.responseURL);
  fetchHTMLFilterTrackingImages(document);
  setImageDimensions(document,
    fetchHTMLOnSetImageDimensions.bind(this, outputEvent, callback));
}

function fetchHTMLOnSetImageDimensions(event, callback, numImagesModified) {
  callback(event);
}

// TODO: can i just access image.src property to get hostname
// instead of creating url from attribute value?
// TODO: restrict to http(s)? (by protocol value)?
function fetchHTMLFilterTrackingImages(document) {
  // Use all lowercase to match hostname getter normalization
  const hosts = new Set([
    'b.scorecardresearch.com',
    'googleads.g.doubleclick.net',
    'me.effectivemeasure.net',
    'pagead2.googlesyndication.com',
    'pixel.quantserve.com',
    'pixel.wp.com',
    'pubads.g.doubleclick.net',
    'sb.scorecardresearch.com'
  ]);

  const minURLLength = 'http://a.com'.length;
  const images = document.querySelectorAll('img[src]');
  for(let image of images) {
    const src = image.getAttribute('src');
    if(src && src.length > minURLLength) {
      const url = fetchHTMLToURLTrapped(src);
      if(url && hosts.has(url.hostname)) {
        image.remove();
      }
    }
  }
}

function fetchHTMLToURLTrapped(urlString) {
  try {
    return new URL(urlString);
  } catch(exception) {
  }
}

function fetchHTMLResolveURLs(document, baseURL) {
  for(let base of document.querySelectorAll('base')) {
    base.remove();
  }

  fetchHTMLResolveElements(document, baseURL);
  fetchHTMLResolveSrcsets(document, baseURL);
}

function fetchHTMLResolveElements(document, baseURL) {

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
  }).join(', ');

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

    const resolvedURL = fetchHTMLResolveURL(attributeValue, baseURL);
    // TODO: not equals is weak comparison because it ignores spaces and
    // is case sensitive, maybe make it stronger
    if(resolvedURL && resolvedURL.href !== attributeValue) {
      element.setAttribute(attributeName, resolvedURL.href);
    }
  }
}

function fetchHTMLResolveSrcsets(document, baseURL) {
  const elements = document.querySelectorAll('img[srcset], source[srcset]');
  for(let element of elements) {
    const attributeValue = element.getAttribute('srcset');
    if(attributeValue) {
      const srcset = parseSrcset(attributeValue);
      if(srcset && srcset.length) {
        let dirtied = false;
        for(let descriptor of srcset) {
          const resolvedURL = fetchHTMLResolveURL(descriptor.url, baseURL);
          if(resolvedURL && resolvedURL.href !== descriptor.url) {
            dirtied = true;
            descriptor.url = resolvedURL.href;
          }
        }

        if(dirtied) {
          const newSrcsetValue = fetchHTMLSerializeSrcset(srcset);
          if(newSrcsetValue && newSrcsetValue !== attributeValue) {
            element.setAttribute('srcset', newSrcsetValue);
          }
        }
      }
    }
  }
}

function fetchHTMLSerializeSrcset(descriptorsArray) {
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

function fetchHTMLResolveURL(urlString, baseURL) {
  if(urlString && !/^\s*javascript:/i.test(urlString) &&
    !/^\s*data:/i.test(urlString)) {
    try {
      return new URL(urlString, baseURL);
    } catch(exception) {
      console.warn(urlString, baseURL.href, exception);
    }
  }
}
