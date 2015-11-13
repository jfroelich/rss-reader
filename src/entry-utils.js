// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class EntryUtils {

  // Replaces the content property of an entry with the full text of its 
  // corresponding link url
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
  static augment(entry, timeout, callback) {
    const request = new XMLHttpRequest();
    request.timeout = timeout;
    request.ontimeout = callback;
    request.onerror = callback;
    request.onabort = callback;
    request.onload = EntryUtils._onAugmentLoad.bind(request, entry, callback);
    request.open('GET', entry.link, true);
    request.responseType = 'document';
    request.send();  
  }

  static _onAugmentLoad(entry, callback, event) {
    const request = event.target;
    const document = request.responseXML;
    if(!document || !document.documentElement) {
      callback(new Error('Invalid document'));
      return;
    }

    const baseURL = request.responseURL;

    DocumentUtils.resolveURLs(document, baseURL);

    // TODO: create an ImageUtils function for this
    const hostDocument = window.document;
    const images = document.getElementsByTagName('img');
    const fetchDimensions = ImageUtils.fetchDimensions.bind(null, 
      hostDocument);
    async.forEach(images, fetchDimensions, function() {
      // TODO: should we be using documentElement?
      const content = document.body.innerHTML;
      if(content) {
        entry.content = content;
      }
      callback();
    });
  }
}
