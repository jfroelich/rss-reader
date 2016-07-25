// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FetchHTMLService {
  constructor() {
    this.log = new LoggingService();
    this.timeoutMillis = 15 * 1000;
    this.imageDimensionsService = new ImageDimensionsService();
  }

  fetch(requestURL, callback) {
    this.log.debug('FetchHTMLService: fetching', requestURL.href);

    if(this.isResistantURL(requestURL)) {
      callback({'type': 'resistanturl', 'requestURL': requestURL});
      return;
    }

    if(this.isPDFURL(requestURL)) {
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
    const async = true;
    request.open('GET', requestURL.href, async);
    request.responseType = 'document';
    request.setRequestHeader('Accept', 'text/html');
    request.send();
  }

  onFetch(requestURL, callback, event) {
    const outputEvent = {
      'requestURL': requestURL
    };

    if(event.type !== 'load') {
      this.log.debug('FetchHTMLService: fetch error', requestURL.href,
        event.type);
      outputEvent.type = event.type;
      callback(outputEvent);
      return;
    }

    const document = event.target.responseXML;
    if(!document) {
      this.log.debug('FetchHTMLService: undefined document', requestURL.href);
      outputEvent.type = 'undefineddocument';
      callback(outputEvent);
      return;
    }

    outputEvent.type = 'success';
    const responseURL = new URL(event.target.responseURL);
    outputEvent.responseURL = responseURL;
    this.transformLazilyLoadedImages(document);
    this.filterSourcelessImages(document);
    this.resolveDocumentURLs(document, responseURL);
    this.filterTrackingImages(document);
    if(this.imageDimensionsService) {
      this.imageDimensionsService.modifyDocument(document,
      this.onSetImageDimensions.bind(this, outputEvent, callback));
    } else {
      outputEvent.responseXML = document;
      callback(event);
    }
  }

  onSetImageDimensions(event, callback, document) {
    event.responseXML = document;
    callback(event);
  }

  isPDFURL(url) {
    const path = url.pathname;
    return path && path.length > 5 && /\.pdf$/i.test(path);
  }

  filterSourcelessImages(document) {
    for(let image of document.querySelectorAll('img')) {
      if(!this.hasSource(image)) {
        image.remove();
      }
    }
  }

  isResistantURL(url) {
    const blacklist = [
      'productforums.google.com',
      'groups.google.com',
      'www.forbes.com',
      'forbes.com'
    ];

    // hostname getter normalizes url part to lowercase
    return blacklist.includes(url.hostname);
  }

  transformLazilyLoadedImages(document) {

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
      if(!this.hasSource(image)) {
        for(let alternateName of ALTERNATE_ATTRIBUTE_NAMES.length) {
          if(image.hasAttribute(alternateName)) {
            const alternateValue = image.getAttribute(alternateName);
            if(alternateValue && this.isMinimallyValidURL(alternateValue)) {
              image.removeAttribute(alternateName);
              image.setAttribute('src', alternateValue);
              this.log.debug('FetchHTMLService: set lazy image src',
                alternateValue);
              break;
            }
          }
        }
      }
    }
  }

  hasSource(imageElement) {
    return imageElement.hasAttribute('src') ||
      imageElement.hasAttribute('srcset');
  }

  // This does only minimal validation of the content of the alternate
  // attribute value. I cannot fully validate its url, because the url could
  // be relative, because this may be called prior to resolving image source
  // urls.
  // Therefore, the only validation I do is check whether the alternate value
  // contains an intermediate space. Neither relative nor absolute urls can
  // contain a space, so in that case I can be positive it isn't a valid
  // alternative.
  // TODO: maybe also test for other invalid characters?
  isMinimallyValidURL(inputString) {
    const MINIMAL_VALID_URL_LENGTH = 'http://a'.length;
    return inputString.length > MINIMAL_VALID_URL_LENGTH &&
      !inputString.trim().includes(' ');
  }

  // TODO: I am not seeing any of the last 4 urls here being filtered. Maybe
  // I am looking for the wrong thing? I have not seen these occur even
  // once? Are they just script origins?
  filterTrackingImages(document) {
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
    const images = document.querySelectorAll(document);
    for(let image of images) {
      this.log.debug('FetchHTMLService: removing tracking image',
        image.outerHTML);
      image.remove();
    }
  }

  getURLAttributeMap() {
    return {
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
  }

  // Resolves all urls in a document, such as element attribute values
  // TODO: think of what do about the common 'http://#fragment' url value
  // found on various sites
  // TODO: think about what to do about the common '#' url. Usually these are
  // just links back to the top, or have an onclick handler. maybe these should
  // be treated specially by a separate transform.
  // TODO: resolve xlink type simple (on any attribute) in xml docs
  resolveDocumentURLs(document, baseURL) {
    for(let base of document.querySelectorAll('base')) {
      base.remove();
    }

    this.resolveElementsWithURLAttributes(document, baseURL);
    this.resolveElementsWithSrcsetAttributes(document, baseURL);
  }

  selectElementsWithURLAttributes(document) {
    const URL_ATTRIBUTE_MAP = this.getURLAttributeMap();
    const SELECTOR = Object.keys(URL_ATTRIBUTE_MAP).map(function(key) {
      return key + '[' + URL_ATTRIBUTE_MAP[key] +']';
    }).join(', ');
    return document.querySelectorAll(SELECTOR);
  }

  resolveElementsWithURLAttributes(document, baseURL) {
    const URL_ATTRIBUTE_MAP = this.getURLAttributeMap();
    const elements = this.selectElementsWithURLAttributes(document);
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

      // todo: this probably belongs in a separate filter pass
      if(/^\s*https?:\/\/#/i.test(attributeValue)) {
        this.log.debug("removing invalid anchor url:", element.outerHTML);
        element.remove();
        continue;
      }

      const resolvedURL = this.resolveURL(attributeValue, baseURL);
      if(!resolvedURL) {
        continue;
      }

      if(resolvedURL.href !== attributeValue) {
        element.setAttribute(attributeName, resolvedURL.href);
      }
    }
  }

  resolveElementsWithSrcsetAttributes(document, baseURL) {
    const elements = document.querySelectorAll('img[srcset], source[srcset]');
    for(let element of elements) {
      const attributeValue = element.getAttribute('srcset');
      if(attributeValue) {
        const srcset = parseSrcset(attributeValue);
        if(srcset && srcset.length) {
          let dirtied = false;
          for(let descriptor of srcset) {
            const resolvedURL = this.resolveURL(descriptor.url, baseURL);
            if(resolvedURL && resolvedURL.href !== descriptor.url) {
              dirtied = true;
              descriptor.url = resolvedURL.href;
            }
          }

          if(dirtied) {
            const newSrcsetValue = this.serializeSrcset(srcset);
            if(newSrcsetValue && newSrcsetValue !== attributeValue) {
              element.setAttribute('srcset', newSrcsetValue);
            }
          }
        }
      }
    }
  }

  serializeSrcset(descriptorsArray) {
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

  resolveURL(urlString, baseURL) {
    if(urlString && !/^\s*javascript:/i.test(urlString) &&
      !/^\s*data:/i.test(urlString)) {
      try {
        return new URL(urlString, baseURL);
      } catch(exception) {
        this.log.debug('FetchHTMLService: resolveURL error', urlString,
          baseURL.href);
      }
    }
  }
}
