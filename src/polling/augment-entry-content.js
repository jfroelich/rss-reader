// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

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
