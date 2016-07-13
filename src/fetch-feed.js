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
    const outputEvent = Object.create(null);
    outputEvent.type = event.type;

    const responseURLString = event.target.responseURL;


    if(event.type !== 'load') {

      // responseURL may be undefined for non-load events
      if(responseURLString) {
        try {
          outputEvent.responseURL = new URL(responseURLString);
        } catch(urlexception) {

        }
      }

      callback(outputEvent);
      return;
    }

    // Now we know we are dealing with a load event.
    // responseURL should always be defined and valid
    outputEvent.responseURL = new URL(responseURLString);

    const document = event.target.responseXML;

    // document may be undefined with a successful load when the content
    // does not fit the allowed content type, such as with a PDF.
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

    // Append both the requested url and the response url if different to the
    // feed's url list. At this point the urls property is undefined, so this
    // also sets it for the first time.
    outputEvent.feed.urls = [requestURL];
    if(outputEvent.responseURL && outputEvent.responseURL.href !==
      requestURL.href) {
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
      fetchFeedRewriteEntryURLs(outputEvent.feed.entries);
    }

    callback(outputEvent);
  }
}

// For each entry, try to rewrite its url, and if a rewrite occurred,
// append the rewritten url to the urls list for that entry.
// TODO: not sure this belongs here
function fetchFeedRewriteEntryURLs(entries) {
  for(let i = 0, len = entries.length; i < len; i++) {
    let entry = entries[i];
    // We know due to the fetch that there is only one value in the array
    let entryURL = entry.urls[0];
    if(entryURL) {
      let rewrittenURL = rewriteURL(entryURL);
      if(rewrittenURL.href !== entryURL.href) {
        entry.urls.push(rewrittenURL);
      }
    }
  }
}
