// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const EntryUtils = {};

{ // BEGIN LEXICAL SCOPE

// Given an array of unique entries, returns a new array of 
// unique entries (compared by entry.link)
// NOTE: consider just returning Iterable
// NOTE that Array.from(distinct.values()) also works
function getUniqueEntries(entries) {
  const distinct = new Map(entries.map(function(entry) {
    return [entry.link, entry];
  }));
  return [...distinct.values()];
}

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
function augmentContent(entry, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.ontimeout = callback;
  request.onerror = callback;
  request.onabort = callback;
  request.onload = onAugmentLoad.bind(request, entry, callback);
  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();  
}

// Private helper for augmentContent
function onAugmentLoad(entry, callback, event) {
  const request = event.target;
  const document = request.responseXML;
  if(!document || !document.documentElement) {
    callback(new Error('Invalid document'));
    return;
  }

  const baseURL = request.responseURL;
  DocumentUtils.resolveURLs(document, baseURL);
  DocumentUtils.setImageDimensions(document, 
    onImageDimensionsSet.bind(null, entry, document, callback));
}

// Private helper for onAugmentLoad
// TODO: should we be using documentElement?
function onImageDimensionsSet(entry, document, callback) {
  const content = document.body.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}

// Export
EntryUtils.getUniqueEntries = getUniqueEntries;
EntryUtils.augmentContent = augmentContent;

} // END LEXICAL SCOPE
