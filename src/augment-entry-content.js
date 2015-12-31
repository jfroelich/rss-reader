// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Replaces the content property of an entry with the full text of its
// corresponding link url. The full text is modified so that it can be
// embedded and displayed locally. Relative urls are changed to absolute
// urls. Images without express dimensions are fetched and each image element's
// width and height attribtues are set.

// TODO: I'd prefer this function pass back any errors to the callback. This
// would require the caller that wants to not break from async.forEach early
// wrap the call.
// TODO: remove the interaction with async. I think rolling my own local
// iteration is sufficient and perhaps clearer.

// TODO: consider embedding/sandboxing iframes? This is currently handled at
// display time by filter-frame-elements.js. Because it is async and slow,
// maybe it makes more sense to do it here instead.
// TODO: would it make sense to store only the compressed html, after it has
// been 'scrubbed', prior to storage? it probably would. however, while i am
// debugging the scrubbing functionality, i am doing this when the page is
// displayed instead of before it is stored.
// TODO: scrubbing/html-tidy (e.g. remove images without src attribute?), note
// this ties into lazy-load-transform and also filter-tracer-elements. perhaps
// the sourceless images transform should be decoupled from filter-tracer to
// make it clearer. and lazy-load-transform should be somehow coupled with
// removing sourceless? or it should be run before.
// TODO: if pdf content type then maybe we embed iframe with src
// to PDF? also, we should not even be trying to fetch pdfs or similar non-html
// media formats?
// TODO: do something with responseURL? should augmentEntryContent also
// be in charge of updating the entry to replace its url if it isn't
// the same?
function augmentEntryContent(entry, timeout, callback) {
  fetchHTML(entry.link, timeout,
    onFetchHTML.bind(null, entry, callback));
}

this.augmentEntryContent = augmentEntryContent;

function onFetchHTML(entry, callback, error, document, responseURL) {
  if(error) {
    console.debug(error);
    callback();
    return;
  }

  // Temporary, testing responseURL ideas
  if(responseURL !== entry.link) {
    console.debug('Response URL changed from %s to %s',
      entry.link,
      responseURL);
  }

  // Before calling resolveDocumentURLs, we try and do some minor scrubbing
  // of the document. For example, we try and fix the attributes of image
  // elements where some type of lazy-loading technique is occurring.
  transformLazyImages(document);

  resolveDocumentURLs(document, responseURL);
  fetchImageDimensions(document,
    onFetchImageDimensions.bind(null, entry, document, callback));
}

function onFetchImageDimensions(entry, document, callback) {
  const content = document.documentElement.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}

} // END ANONYMOUS NAMESPACE
