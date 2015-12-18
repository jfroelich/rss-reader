// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Replaces the content property of an entry with the full text of its
// corresponding link url

// TODO: avoid the use of nested functions

// TODO: I'd prefer this function pass back any errors to the callback. This
// would require the caller that wants to not break from async.forEach early
// wrap the call.
// TODO: consider embedding/sandboxing iframes?
// TODO: html compression? like enforce boolean attributes? see kangax lib
// TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
// TODO: if pdf content type then maybe we embed iframe with src
// to PDF? also, we should not even be trying to fetch pdfs? is this
// just a feature of fetchHTML or does it belong here?
// TODO: do something with responseURL? should augmentEntryContent also
// be in charge of updating the entry to replace its url if it isn't
// the same
this.augmentEntryContent = function(entry, timeout, callback) {

  fetchHTML(entry.link, timeout,
    function _onFetch(error, document, responseURL) {
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

    resolveDocumentURLs(document, responseURL);
    fetchImageDimensions(document,
      _setEntryContent.bind(null, entry, document, callback));
  });

};

// Private helper for onAugmentLoad
function _setEntryContent(entry, document, callback) {
  const content = document.documentElement.innerHTML;
  if(content) {
    entry.content = content;
  }
  callback();
}

} // END ANONYMOUS NAMESPACE
