// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Google formally deprecated this service. Around December 1st, 2015, I
// first noticed that the queries stopped working. However, I have witnessed
// the service occassionally work thereafter.

class GoogleFeedsService {

  constructor() {
    this.timeoutInMillis = 5000;
    this.baseURLString =
      'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
    this.titleMaxLength = 200;
    this.contentSnippetMaxLength = 400;
    this.truncateReplacementString = '...';
  }

  search(queryString, callback) {
    console.assert(queryString, 'queryString is falsy');
    const urlString = this.baseURLString + encodeURIComponent(queryString);
    console.debug('GET', urlString);
    const isAsync = true;
    const boundOnResponse = this.onResponse.bind(this, urlString, callback);
    const request = new XMLHttpRequest();
    request.timeout = this.timeoutInMillis;
    request.onerror = boundOnResponse;
    request.ontimeout = boundOnResponse;
    request.onabort = boundOnResponse;
    request.onload = boundOnResponse;
    request.open('GET', urlString, isAsync);
    request.responseType = 'json';
    request.send();
  }

  onResponse(urlString, callback, event) {
    const responseEvent = {
      'type': event.type,
      'status': event.target.status
    };

    if(!event.target.response) {
      console.warn('Response undefined for GET', urlString);
      responseEvent.type = 'noresponse';
      callback(responseEvent);
      return;
    }

    if(event.type !== 'load') {
      console.warn('GET', urlString, event.type, event.target.status,
        event.target.response.responseDetails);
      responseEvent.message = event.target.response.responseDetails;
      callback(responseEvent);
      return;
    }

    const data = event.target.response.responseData;
    if(!data) {
      console.error('Undefined data for GET', urlString,
        event.target.response.responseDetails);
      responseEvent.message = event.target.response.responseDetails;
      callback(responseEvent);
      return;
    }

    responseEvent.queryString = data.query || '';
    responseEvent.entries = this.filterEntries(data.entries || []);
    callback(responseEvent);
  }

  filterEntries(entries) {
    const seenURLs = new Set();
    const outputEntries = [];

    for(let entry of entries) {
      if(!entry.url) {
        continue;
      }

      let entryURL = this.toURLTrapped(entry.url);
      if(!entryURL) {
        continue;
      }

      let normalizedURLString = entryURL.href;
      if(seenURLs.has(normalizedURLString)) {
        continue;
      }
      seenURLs.add(normalizedURLString);

      entry.url = entryURL;

      if(entry.title) {
        entry.title = filterControlCharacters(entry.title);
        entry.title = StringUtils.replaceHTML(entry.title, '');
        entry.title = StringUtils.truncateHTML(entry.title, this.titleMaxLength);
      }

      if(entry.contentSnippet) {
        entry.contentSnippet = filterControlCharacters(entry.contentSnippet);
        entry.contentSnippet = this.filterBreakruleTags(entry.contentSnippet);
        entry.contentSnippet = StringUtils.truncateHTML(entry.contentSnippet,
          this.contentSnippetMaxLength, this.truncateReplacementString);
      }

      outputEntries.push(entry);
    }

    return outputEntries;
  }

  toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {}
  }

  filterBreakruleTags(inputString) {
    return inputString && inputString.replace(/<br\s*>/gi, ' ');
  }
}
