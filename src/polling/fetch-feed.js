// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: maybe this should use a more qualified name like fetchFeedDocument?
// or rather, maybe I should have fetchXMLDocument, and this function requires
// that function as a dependency. then this function becomes really just a
// simple composition of fetch and deserialize

// TODO: handle redirects better, e.g. somehow use responseURL? maybe this
// should also pass back responseURL so that the caller can use it?
// TODO: the post-processing where i clean up entries should not be done here,
// it should be the caller's responsibility, it is not intrinsic to this
// function's purpose

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function fetchFeed(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = onFetch.bind(request, url, callback);
  request.open('GET', url, true);

  // TODO: why am i doing this again? wouldn't it be better to
  // set responseType to document or something to that effect?
  request.overrideMimeType('application/xml');
  request.send();
}

this.fetchFeed = fetchFeed;

function onFetch(url, callback, event) {

  // TODO: unify the exit points of this function and just do a single
  // callback at the end of the function.

  const request = event.target;

  let document = request.responseXML;

  if(!document) {
    document = retryMalformedResponse(request);
  }

  if(!document || !document.documentElement) {
    // TODO: this should callback something more explicit, like a
    // fake event that sets event.error.type or something
    callback(event);
    return;
  }

  // TODO: i think it would be better to do as much processing as possible
  // outside of the try-catch context, although I am unsure whether this
  // has a significant performance impact.

  try {
    const feed = deserializeFeed(document);
    feed.url = url;
    feed.fetched = Date.now();

    feed.entries = feed.entries.filter(entryHasLink);
    feed.entries.forEach(rewriteEntryLink);
    feed.entries = getUniqueEntries(feed.entries);

    callback(null, feed);
  } catch(exception) {
    // TODO: the type of error passed back as first argument
    // should be consistent. Mimic an event object here instead
    // of an exception
    callback(exception);
  }
}

function entryHasLink(entry) {
  return entry.link;
}

function rewriteEntryLink(entry) {
  entry.link = rewriteURL(entry.link);
}

// Given an array of unique entries, returns a new array of
// unique entries (compared by entry.link)
// TODO: return a set/map
function getUniqueEntries(entries) {
  const distinct = new Map(entries.map(function(entry) {
    return [entry.link, entry];
  }));
  return [...distinct.values()];
}

// TODO: this doesn't seem to actually fix or do anything. Re-parsing still
// causes the same error. It seems like all this does is remove the parsererror
// element. So this needs some more attention.
// responseXML is null when there was an xml parse error
// such as invalid UTF-8 characters. For example:
// "error on line 1010 at column 25: Input is not proper UTF-8,
// indicate encoding ! Bytes: 0x07 0x50 0x72 0x65"
// So, access the raw text and try and re-encode and re-parse it
// TODO: should this defer to an external parseXML function instead?
// NOTE: requires utf8.js
function retryMalformedResponse(response) {

  try {
    const encoded = utf8.encode(response.responseText);
    const parser = new DOMParser();
    const document = parser.parseFromString(encoded, 'application/xml');

    // XML parsing exceptions are not thrown, they are embedded
    // as nodes within the result. Behavior varies by browser.
    const error = document.querySelector('parsererror');
    if(error) {
      error.remove();
    }

    return document;
  } catch(exception) {

  }
}

} // END ANONYMOUS NAMESPACE
