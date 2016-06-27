// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Fetches a remote XML file and parses it into a feed object
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

    // TODO: what about redirect loops? This would lead to a non-stop growing
    // of the urls array. Maybe I should check if the new responseURL is not
    // only not the last url but also not any of the previous.

    outputEvent.feed.urls = [requestURL];
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
  // TODO: I am really really not sure this belongs here
  function rewriteEntryURLs(entries) {
    // Not using for .. of due to profiling error NotOptimized
    // TryCatchStatement
    //for(let entry of entries) {
    for(let i = 0, len = entries.length; i < len; i++) {
      let entry = entries[i];
      let entryURL = entry.urls[0];
      if(entryURL) {
        let rewrittenURL = rewriteURL(entryURL);
        if(rewrittenURL.href !== entryURL.href) {
          // console.debug('Rewrite url:', entryURL.href, rewrittenURL.href);
          entry.urls.push(rewrittenURL);
        }
      }
    }
  }
}
