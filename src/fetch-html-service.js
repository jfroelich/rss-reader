// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FetchHTMLService {
  constructor() {
    this.timeoutMillis = 15 * 1000;
  }

  fetch(requestURL, callback) {
    console.log('GET', requestURL.href);

    if(FetchHTMLService.isResistantURL(requestURL)) {
      callback({'type': 'resistanturl', 'requestURL': requestURL});
      return;
    }

    if(FetchHTMLService.pathEndsWithPDF(requestURL)) {
      callback({'type': 'pdfurl', 'requestURL': requestURL});
      return;
    }

    const boundOnFetch = this.onFetch.bind(this, requestURL, callback);
    const request = new XMLHttpRequest();
    if(this.timeoutMillis) {
      request.timeout = this.timeoutMillis;
    }

    request.ontimeout = boundOnFetch;
    request.onerror = boundOnFetch;
    request.onabort = boundOnFetch;
    request.onload = boundOnFetch;
    const isAsync = true;
    request.open('GET', requestURL.href, isAsync);
    request.responseType = 'document';
    request.setRequestHeader('Accept', 'text/html');
    request.send();
  }

  onFetch(requestURL, callback, event) {
    if(event.type !== 'load') {
      console.warn(event.type, event.target.status, requestURL.href);
      callback({
        'requestURL': requestURL,
        'type': event.type
      });
      return;
    }

    const document = event.target.responseXML;
    if(!document) {
      console.warn('Undefined document', requestURL.href);
      callback({
        'type': 'undefineddocument',
        'requestURL': requestURL
      });
      return;
    }

    const outputEvent = {
      'type': 'success',
      'requestURL': requestURL,
      'responseXML': document,
      'responseURL': new URL(event.target.responseURL)
    };

    FetchHTMLService.transformLazilyLoadedImages(document);
    FetchHTMLService.filterSourcelessImages(document);
    DocumentURLResolver.updateDocument(document, outputEvent.responseURL);
    Lonestar.jamDocument(document);
    ImageDimensionsService.updateDocument(document,
      this.onSetImageDimensions.bind(this, outputEvent, callback));
  }

  onSetImageDimensions(event, callback, numImagesModified) {
    callback(event);
  }

  static pathEndsWithPDF(url) {
    const path = url.pathname;
    const minLen = '/a.pdf'.length;
    return path && path.length > minLen && /\.pdf$/i.test(path);
  }

  static filterSourcelessImages(document) {
    for(let image of document.querySelectorAll('img')) {
      if(!FetchHTMLService.hasSource(image)) {
        image.remove();
      }
    }
  }

  static isResistantURL(url) {
    const blacklist = [
      'productforums.google.com',
      'groups.google.com',
      'www.forbes.com',
      'forbes.com'
    ];

    // hostname getter normalizes url part to lowercase
    return blacklist.includes(url.hostname);
  }

  static transformLazilyLoadedImages(document) {

    const ALTERNATE_ATTRIBUTE_NAMES = [
      'load-src',
      'data-src',
      'data-original-desktop',
      'data-baseurl',
      'data-lazy',
      'data-img-src',
      'data-original',
      'data-adaptive-img',
      'data-imgsrc',
      'data-default-src'
    ];

    const images = document.querySelectorAll('img');
    for(let image of images) {
      if(!FetchHTMLService.hasSource(image)) {
        for(let alternateName of ALTERNATE_ATTRIBUTE_NAMES) {
          if(image.hasAttribute(alternateName)) {
            const alternateValue = image.getAttribute(alternateName);
            if(alternateValue && FetchHTMLService.isMinimallyValidURL(
              alternateValue)) {
              image.removeAttribute(alternateName);
              image.setAttribute('src', alternateValue);
              console.debug('Set lazy image src', alternateValue);
              break;
            }
          }
        }
      }
    }
  }

  static hasSource(imageElement) {
    return imageElement.hasAttribute('src') ||
      imageElement.hasAttribute('srcset');
  }

  // This does only minimal validation of the content of the alternate
  // attribute value. I cannot fully validate its url, because the url could
  // be relative, because this is prior to resolving urls.
  static isMinimallyValidURL(inputString) {
    const MINIMAL_VALID_URL_LENGTH = 'http://a'.length;
    return inputString.length > MINIMAL_VALID_URL_LENGTH &&
      !inputString.trim().includes(' ');
  }
}

class Lonestar {
  static jamDocument(document) {
    const SELECTOR = [
      'img[src^="http://b.scorecardresearch.com"]',
      'img[src^="https://b.scorecardresearch.com"]',
      'img[src^="http://sb.scorecardresearch.com"]',
      'img[src^="https://sb.scorecardresearch.com"]',
      'img[src^="http://pagead2.googlesyndication.com"]',
      'img[src^="https://pagead2.googlesyndication.com"]',
      'img[src^="http://pubads.g.doubleclick.net"]',
      'img[src^="https://pubads.g.doubleclick.net"]',
      'img[src^="http://me.effectivemeasure.net"]',
      'img[src^="https://me.effectivemeasure.net"]'
    ].join(',');
    const images = document.querySelectorAll(SELECTOR);
    for(let image of images) {
      console.debug('Raspberried', image.outerHTML);
      image.remove();
    }
  }
}

class DocumentURLResolver {

static updateDocument(document, baseURL) {
  for(let base of document.querySelectorAll('base')) {
    base.remove();
  }

  DocumentURLResolver.resolveElements(document, baseURL);
  DocumentURLResolver.resolveSrcsetAttributes(document, baseURL);
}

static resolveElements(document, baseURL) {

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
      console.debug("Removing invalid anchor", element.outerHTML);
      element.remove();
      continue;
    }

    const resolvedURL = DocumentURLResolver.resolveURL(attributeValue, baseURL);
    // TODO: not equals is weak comparison because it ignores spaces and
    // is case sensitive, maybe make it stronger
    if(resolvedURL && resolvedURL.href !== attributeValue) {
      element.setAttribute(attributeName, resolvedURL.href);
    }
  }
}

static resolveSrcsetAttributes(document, baseURL) {
  const elements = document.querySelectorAll('img[srcset], source[srcset]');
  for(let element of elements) {
    const attributeValue = element.getAttribute('srcset');
    if(attributeValue) {
      const srcset = parseSrcset(attributeValue);
      if(srcset && srcset.length) {
        let dirtied = false;
        for(let descriptor of srcset) {
          const resolvedURL = DocumentURLResolver.resolveURL(descriptor.url,
            baseURL);
          if(resolvedURL && resolvedURL.href !== descriptor.url) {
            dirtied = true;
            descriptor.url = resolvedURL.href;
          }
        }

        if(dirtied) {
          const newSrcsetValue = DocumentURLResolver.serializeSrcset(
            srcset);
          if(newSrcsetValue && newSrcsetValue !== attributeValue) {
            element.setAttribute('srcset', newSrcsetValue);
          }
        }
      }
    }
  }
}

static serializeSrcset(descriptorsArray) {
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

static resolveURL(urlString, baseURL) {
  if(urlString && !/^\s*javascript:/i.test(urlString) &&
    !/^\s*data:/i.test(urlString)) {
    try {
      return new URL(urlString, baseURL);
    } catch(exception) {
      console.warn(urlString, baseURL.href, exception);
    }
  }
}

}


// Helper class representing a single async function with its own helpers that
// attempts to asynchronously set the width and height of every image element
// in the document
class ImageDimensionsService {

static updateDocument(document, callback) {
  // Create a shared object to simplify parameter passing, to simplify the
  // incrementing of primitive integers passed by value, and to allow the
  // parameter with the name document to this function to be easily
  // distinguished from the outer scope document of this class in _fetchImage
  const context = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'document': document
  };

  const images = document.getElementsByTagName('img');
  context.numImages = images.length;
  if(context.numImages) {
    for(let image of images) {
      ImageDimensionsService._fetchImage(context, image);
    }
  } else {
    callback(0);
  }
}

static _fetchImage(context, image) {
  context.numProcessed++;

  // Skip images with at least one dimension.
  if(image.width || image.height) {
    ImageDimensionsService._onImageProcessed(context);
    return;
  }

  // Skip non-http(s) images
  const src = image.getAttribute('src');
  const urlMinLen = 'http://a.gif'.length;
  if(!src || src.length < urlMinLen || !/^\s*http/i.test(src)) {
    ImageDimensionsService._onImageProcessed(context);
    return;
  }

  context.numFetched++;

  // The document containing the image may be inert, so create a detached image
  // in the local live document and fetch the image via this proxy.
  const proxyImage = document.createElement('img');
  proxyImage.addEventListener('load', function onProxyImageLoad(event) {
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.numModified++;
    ImageDimensionsService._onImageProcessed(context);
  });
  proxyImage.addEventListener('error', function onProxyImageLoad(event) {
    ImageDimensionsService._onImageProcessed(context);
  });

  // Trigger the fetch
  proxyImage.src = src;
}

static _onImageProcessed(context) {
  if(context.numProcessed === context.numImages) {
    context.callback(context.numModified);
  }
}

}
