// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedHttpService {
  constructor() {
    this.log = new LoggingService();
    this.timeoutMillis = null;
  }

  fetch(requestURL, excludeEntries, callback) {
    this.log.debug('FeedHttpService: fetching', requestURL.href);
    const boundOnResponse = this.onResponse.bind(this, requestURL,
      excludeEntries, callback);
    const isAsync = true;
    const request = new XMLHttpRequest();
    request.timeout = this.timeoutMillis;
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
      this.log.debug('FeedHttpService: error fetching', requestURL.href);
      callback(outputEvent);
      return;
    }

    outputEvent.responseURL = new URL(event.target.responseURL);
    const document = event.target.responseXML;
    if(!document) {
      this.log.debug('FeedHttpService: undefined document', requestURL.href);
      outputEvent.type = 'invaliddocument';
      callback(outputEvent);
      return;
    }

    this.log.debug('FeedHttpService: parsing', requestURL.href);

    try {
      outputEvent.feed = FeedParser.parse(document, excludeEntries);
    } catch(exception) {
      this.log.debug('FeedHttpService: feed parse error', requestURL.href,
        exception.message);
      outputEvent.type = 'parseerror';
      if(exception.message) {
        outputEvent.message = exception.message;
      }

      callback(outputEvent);
      return;
    }

    outputEvent.feed.urls = [requestURL];
    if(outputEvent.responseURL.href !== requestURL.href) {
      this.log.debug('FeedHttpService: detected redirect', requestURL.href,
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
        this.log.debug('FeedHttpService:', exception.message);
      }
    }

    callback(outputEvent);
  }
}
