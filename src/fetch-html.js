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
        'type': event.type,
        'requestURL': requestURL
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
    LoneStarr.jamDocumentRadar(document);
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
              // console.debug('Set lazy image src', alternateValue);
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

// Telemetry radar disruption
// TODO: can i just access image.src property to get hostname
// instead of creating url from attribute value?
// TODO: restrict to http(s)? (by protocol value)?
class LoneStarr {
  static jamDocumentRadar(document) {
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
        const url = LoneStarr.toURLTrapped(src);
        if(url && hosts.has(url.hostname)) {
          //console.debug('Raspberried', image.outerHTML);
          image.remove();
        }
      }
    }
  }

  static toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {
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

class ImageDimensionsService {

// Asynchronously set the width and height attributes of image elements
static updateDocument(document, callback) {
  const context = {
    'numProcessed': 0,
    'numFetched': 0,
    'numModified': 0,
    'numImages': 0,
    'callback': callback,
    'document': document,
    'didCallback': false
  };

  const images = document.getElementsByTagName('img');
  context.numImages = images.length;
  if(context.numImages) {
    for(let image of images) {
      ImageDimensionsService._processImage(context, image);
    }
  } else {
    callback(0);
  }
}

static _processImage(context, image) {

  // Skip images with at least one dimension.
  if(image.width || image.height) {
    ImageDimensionsService._onImageProcessed(context);
    return;
  }

  // Skip non-http(s) images or images without a src attribute
  const src = image.getAttribute('src');
  const urlMinLen = 'http://a.gif'.length;
  if(!src || src.length < urlMinLen || !/^\s*http/i.test(src)) {
    ImageDimensionsService._onImageProcessed(context);
    return;
  }

  // Track the number of fetch calls
  context.numFetched++;

  // The document containing the image may be inert, so create a detached image
  // in the local live document and fetch the image via this proxy.
  const proxyImage = document.createElement('img');
  proxyImage.addEventListener('load', onProxyImageLoad);
  proxyImage.addEventListener('error', onProxyImageError);
  proxyImage.src = src;

  function onProxyImageLoad(event) {
    event.target.removeEventListener('load', onProxyImageLoad);
    image.setAttribute('width', event.target.width);
    image.setAttribute('height', event.target.height);
    context.numModified++;
    ImageDimensionsService._onImageProcessed(context);
  }

  function onProxyImageError(event) {
    event.target.removeEventListener('error', onProxyImageError);
    ImageDimensionsService._onImageProcessed(context);
  }
}

static _onImageProcessed(context) {
  // This increment should only happen here, because this should only happen
  // once each call to _processImage completes
  context.numProcessed++;

  if(context.numProcessed === context.numImages) {
    console.assert(!context.didCallback, 'Multiple callbacks');
    context.didCallback = true;
    context.callback(context.numModified);
  }
}

}
