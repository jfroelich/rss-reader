// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Fetches the XML of a feed and parses it into a feed object
// TODO: should I be rewriting feed.url as well? Or just entry links?
function fetchFeed(requestURL, timeoutMillis, excludeEntries, callback) {

  const request = new XMLHttpRequest();
  request.timeout = timeoutMillis;
  request.onerror = onResponse;
  request.ontimeout = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  const isAsyncRequest = true;
  request.open('GET', requestURL.href, isAsyncRequest);
  request.responseType = 'document';
  request.send();

  function onResponse(event) {
    // TODO: does this ever throw? I don't think so, I think responseURL
    // is always defined? Test.
    const responseURL = new URL(event.target.responseURL);
    const outputEvent = Object.create(null);
    outputEvent.type = event.type;
    outputEvent.responseURL = responseURL;

    if(event.type !== 'load') {
      callback(outputEvent);
      return;
    }

    const document = event.target.responseXML;
    // This happens when trying to fetch PDFs
    if(!document) {
      outputEvent.type = 'invaliddocument';
      callback(outputEvent);
      return;
    }

    try {
      outputEvent.feed = FeedParser.parse(document, excludeEntries);
    } catch(exception) {
      outputEvent.type = 'parseexception';
      outputEvent.details = exception;
      callback(outputEvent);
      return;
    }

    // FeedParser does not define the 'urls' property because FeedParser is
    // not aware of urls. So define it here for the first time, and begin the
    // list with the requested url.
    outputEvent.feed.urls = [requestURL];

    // When redirected, append the redirected url
    if(requestURL.href !== responseURL.href) {
      console.debug('Feed redirect', requestURL.href, responseURL.href);
      outputEvent.feed.urls.push(responseURL);
    }

    outputEvent.feed.dateFetched = new Date();

    const lastModifiedString = event.target.getResponseHeader(
      'Last-Modified');
    if(lastModifiedString) {
      try {
        outputEvent.feed.dateLastModified = new Date(lastModifiedString);
      } catch(exception) {}
    }

    if(!excludeEntries) {
      rewriteEntryURLs(outputEvent.feed.entries);
    }

    callback(outputEvent);
  }

  // For each entry, try to rewrite its url, and if a rewrite occurred,
  // append the rewritten url to the urls list for that entry. By appending
  // to the end, this means the rewritten url will come after the original,
  // so this means other things that access the list will use whatever is
  // last in the list, so those things will use the rewritten url
  function rewriteEntryURLs(entries) {
    for(let i = 0, len = entries.length, entry, entryURL, rewrittenURL;
      i < len; i++) {
      entry = entries[i];
      entryURL = entry.urls[0];
      if(entryURL) {
        rewrittenURL = rewriteURL(entryURL);
        if(rewrittenURL.href !== entryURL.href) {
          // console.debug('Rewrite url:', entryURL.href, rewrittenURL.href);
          entry.urls.push(rewrittenURL);
        }
      }
    }
  }
}
