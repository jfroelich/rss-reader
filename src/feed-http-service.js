// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedHttpService {
  constructor() {
    this.timeoutMillis = 0;
  }

  fetch(requestURL, excludeEntries, callback) {
    console.debug('GET', requestURL.href);
    console.assert(this.timeoutMillis >= 0, 'Invalid timeout specified',
      this.timeoutMillis);
    const boundOnResponse = this.onResponse.bind(this, requestURL,
      excludeEntries, callback);
    const isAsync = true;
    const request = new XMLHttpRequest();
    if(this.timeoutMillis) {
      request.timeout = this.timeoutMillis;
    }

    request.onerror = boundOnResponse;
    request.ontimeout = boundOnResponse;
    request.onabort = boundOnResponse;
    request.onload = boundOnResponse;
    request.open('GET', requestURL.href, isAsync);
    request.responseType = 'document';
    request.send();
  }

  onResponse(requestURL, excludeEntries, callback, event) {
    const outputEvent = {
      'type': event.type
    };

    if(event.type !== 'load') {
      console.debug(event.type, event.target.status, requestURL.href);
      callback(outputEvent);
      return;
    }

    outputEvent.responseURL = new URL(event.target.responseURL);
    const document = event.target.responseXML;
    if(!document) {
      console.warn('Undefined document', requestURL.href);
      outputEvent.type = 'invaliddocument';
      callback(outputEvent);
      return;
    }

    outputEvent.responseXML = event.target.responseXML;

    try {
      outputEvent.feed = FeedParser.parse(document, excludeEntries);
    } catch(exception) {
      console.warn('Parsing error', requestURL.href, exception.message);
      outputEvent.type = 'parseerror';
      if(exception.message) {
        outputEvent.message = exception.message;
      }

      callback(outputEvent);
      return;
    }

    outputEvent.feed.urls = [requestURL];
    if(outputEvent.responseURL.href !== requestURL.href) {
      console.debug('Detected redirect', requestURL.href,
        outputEvent.responseURL.href);
      outputEvent.feed.urls.push(responseURL);
    }

    outputEvent.feed.dateFetched = new Date();

    const lastModifiedString = event.target.getResponseHeader(
      'Last-Modified');
    if(lastModifiedString) {
      try {
        outputEvent.feed.dateLastModified = new Date(lastModifiedString);
      } catch(exception) {
        console.warn('Error parsing last modified header', exception);
      }
    }

    callback(outputEvent);
  }
}
