// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: I'd prefer this function pass back any errors to the callback. This
// would require the caller that wants to not break from async.forEach early
// wrap the call.
// TODO: consider embedding/sandboxing iframes?
// TODO: html compression? like enforce boolean attributes? see kangax lib
// TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
// TODO: if pdf content type then maybe we embed iframe with src
// to PDF? also, we should not even be trying to fetch pdfs? is this
// just a feature of fetchHTML or does it belong here?
// TODO: do something with responseURL?

class Augment {
  static augmentEntry(entry, timeout, callback) {
    const request = new XMLHttpRequest();
    request.timeout = timeout;
    request.ontimeout = callback;
    request.onerror = callback;
    request.onabort = callback;
    request.onload = Augment._onAugmentLoad.bind(request, callback);
    request.open('GET', entry.link, true);
    request.responseType = 'document';
    request.send();  
  }

  static _onAugmentLoad(callback, event) {
    const request = event.target;
    const document = request.responseXML;
    if(!document || !document.body) {
      callback(new Error('No document'));
      return;
    }

    Augment.resolveURLs(document, request.responseURL);

    const images = document.body.getElementsByTagName('img');
    async.forEach(images, Augment.fetchImageDimensions, function() {
      // TODO: should we be using document.documentElement.innerHTML?
      const content = document.body.innerHTML;
      if(content) {
        entry.content = content;
      }
      callback();
    });
  }

  // TODO: think of a better way to specify the proxy. I should not be
  // relying on window explicitly.
  static fetchImageDimensions(image, callback) {
    const src = (image.getAttribute('src') || '').trim();
    if(!src || URLUtils.isDataURI(src) || !Augment._hasWidth(image)) {
      callback();
      return;
    }

    const document = window.document;
    const proxy = document.createElement('img');
    proxy.onload = function(event) {
      const proxy = event.target;
      image.width = proxy.width;
      image.height = proxy.height;
      callback();
    };
    proxy.onerror = function(event) {
      callback();
    };
    proxy.src = src;
  }

  static _hasWidth(image) {
    const width = (image.getAttribute('width') || '').trim();
    return width && image.width && width !=== '0' && 
      !/^0\s*px/i.test(width);
  }

  /**
   * TODO: support img srcset
   * TODO: support style.backgroundImage?
   * TODO: the new template tag?
   * NOTE: not supporting applet
   * NOTE: iframe.srcdoc?
   * NOTE: ignores param values with URIs
   * NOTE: could stripping the base tag could lead to invalid urls??? Should
   * the base tag, if present, be considered when resolving elements?
   * Also note that there could be multiple base tags, the logic for handling
   * it properly is all laid out in some RFC standard somewhere, and is probably
   * present in Webkit source.
   */
  static resolveURLs(document, baseURL) {
    const forEach = Array.prototype.forEach;
    const bases = document.getElementsByTagName('base');
    forEach.call(bases, function(element) {
      element.remove();
    });

    // TODO: build this from the map
    const RESOLVABLES_QUERY = 'a, area, audio, blockquote, embed, ' + 
      'iframe, form, img, link, object, script, source, track, video';
    const elements = document.querySelectorAll(RESOLVABLES_QUERY);
    forEach.call(elements, function(element) {
      const name = element.localName;
      const attribute = Augment.RESOLVABLE_ATTRIBUTES.get(name);
      const url = (element.getAttribute(attribute) || '').trim();
      try {
        const uri = new URI(url);
        if(!uri.protocol()) {
          const resolved = uri.absoluteTo(baseURL).toString();
          element.setAttribute(attribute, resolved);
        }
      } catch(e) {

      }
    });
  }
}

Augment.RESOLVABLE_ATTRIBUTES = new Map([
  ['a', 'href'],
  ['area', 'href'],
  ['audio', 'src'],
  ['blockquote', 'cite'],
  ['embed', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
  ['img', 'src'],
  ['link', 'href'],
  ['object', 'data'],
  ['script', 'src'],
  ['source', 'src'],
  ['track', 'src'],
  ['video', 'src']
]);
