// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename this to something like findFeeds, get rid of GoogleFeedsAPI

// Accesses the basic find-feeds functionality of the Google Feeds API.
// Google formally deprecated this service. Around December 1st, 2015, I
// first noticed that the queries stopped working. However, I have witnessed
// the service occassionally work thereafter.
const GoogleFeedsAPI = Object.create(null);

// Sends an async request to Google to search for feeds that correspond to
// a general text query.
GoogleFeedsAPI.search = function(queryString, timeoutMillis, callback) {

  // TODO: use the new URL object to set the queryString parameter using
  // the URLs methods instead of this manual string manipulation stuff.
  // I think that will also implicitly call encodeURIComponent for me.
  const BASE_URL_STRING =
    'https://ajax.googleapis.com/ajax/services/feed/find?v=1.0&q=';
  const requestURL = new URL(BASE_URL_STRING +
    encodeURIComponent(queryString));

  const TITLE_MAX_LENGTH = 200;
  const CONTENT_SNIPPET_MAX_LENGTH = 400;

  const filterControlCharacters = filterControlCharacters;

  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.onerror = onResponse;
  request.ontimeout = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('GET', requestURL.href, true);
  request.responseType = 'json';
  request.send();

  function onResponse(event) {
    const request = event.target;
    const response = request.response;
    const responseEvent = Object.create(null);
    responseEvent.type = event.type;

    if(event.type !== 'load') {
      if(response) {
        responseEvent.message = response.responesDetails;
      }
      callback(responseEvent);
      return;
    }

    if(!response) {
      responseEvent.type = 'noresponse';
      callback(responseEvent);
      return;
    }

    const data = response.responseData;

    if(!data) {
      responseEvent.type = 'nodata';
      responseEvent.message = response.responseDetails;
      callback(responseEvent);
      return;
    }

    responseEvent.queryString = data.query || '';
    responseEvent.entries = [];
    const entries = data.entries || [];
    const seenURLs = Object.create(null);
    for(let i = 0, len = entries.length, entry, entryURL, normalizedURLString;
      i < len; i++) {
      entry = entries[i];
      if(!entry.url) {
        continue;
      }

      entryURL = toURLTrapped(entry.url);
      if(!entryURL) {
        continue;
      }

      normalizedURLString = entryURL.href;
      if(normalizedURLString in seenURLs) {
        continue;
      }

      seenURLs[normalizedURLString] = 1;

      // Overwrite the url string property as a URL object
      entry.url = entryURL;

      // TODO: provide entry.link as URL object

      if(entry.title) {
        entry.title = filterControlCharacters(entry.title);
        entry.title = replaceHTML(entry.title, '');
        entry.title = truncateHTMLString(entry.title, TITLE_MAX_LENGTH);
      }

      if(entry.contentSnippet) {
        entry.contentSnippet = filterControlCharacters(entry.contentSnippet);
        entry.contentSnippet = filterBreakruleTags(entry.contentSnippet);
        entry.contentSnippet = truncateHTMLString(entry.contentSnippet,
          CONTENT_SNIPPET_MAX_LENGTH, '...');
      }

      responseEvent.entries.push(entry);
    }

    callback(responseEvent);
  }

  function toURLTrapped(urlString) {
    try {
      return new URL(urlString);
    } catch(exception) {}
  }

  // Returns a new string where <br>s have been replaced with spaces. This is
  // intended to be rudimentary and fast rather than perfectly accurate. I do
  // not do any heavy-weight html marshalling.
  // TODO: rather than this function existing, would it be nicer if
  // HTMLUtils.stripTags accepted a list of tags to ignore or to only consider,
  // and then the caller could just pass in br to that function as the only tag
  // to consider
  function filterBreakruleTags(inputString) {
    return inputString.replace(/<br\s*>/gi, ' ');
  }
};
