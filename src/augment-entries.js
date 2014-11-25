// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.augmentEntries = function(feed, callback) {
  'use strict';

  // TODO: use async.waterfall?

  // TODO: use an object store to maintain a request queue
  // for feeds, images, and pages, and spreads out the requests. Also
  // join requests to similar to domain for keep-alive perf. Also
  // support max-retries for each request. Also support de-activate
  // ability that toggles off feed-active flag to be able to stop
  // requesting non-existing feeds after N failures. Also add UI to
  // options to see feed-active-flag status. Maybe also add a devUI
  // to options that shows basic stats regarding requests. Treat it
  // more like a search engine background, where this is the crawler
  // component.
  // TODO: restrict on metered: http://w3c.github.io/netinfo/
  // TODO: set entry.link to responseURL??? Need to think about
  // whether and where this should happen. This also changes the result
  // of the exists-in-db call. In some sense, exists-in-db would have
  // to happen before?  Or maybe we just set redirectURL as a separate
  // property? We use the original url as id still? Still seems wrong.
  // It sseems like the entries array should be preprocessed each and
  // every time. Because two input links after redirect could point to
  // same url. So the entry-merge algorithm needs alot of thought. It
  // is not inherent to this function, but for the fact that resolving
  // redirects requires an HTTP request, and if not done around this
  // time, requires redundant HTTP requests.
  // if we rewrite then we cannot tell if exists pre/post fetch
  // or something like that. so really we just want redirect url
  // for purposes of resolving stuff and augmenting images.
  // we also want redirect url for detecting dups though. like if two
  // feeds (or even the same feed) include entries that both post-redirect
  // resolve to the same url then its a duplicate entry

  var conn = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  conn.onerror = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onblocked = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onsuccess = function onDatabaseOpen() {
    var transaction = this.result.transaction('entry');
    async.reject(feed.entries, findEntryByLink.bind(this, transaction),
      function (entries) {
      async.forEach(entries, updateEntryContent, function () {
        callback(feed);
      });
    });
  };

  // TODO: do not use window explicitly here
  var hostDocument = window.document;

  // document is the proxy used to load the image
  function fetchImageDimensions(image, callback) {
    var src = (image.getAttribute('src') || '').trim();
    var width = (image.getAttribute('width') || '').trim();
    if(!src || width || image.width ||
      width === '0' || /^0\s*px/i.test(width) ||
      /^data\s*:/i.test(src)) {
      return callback();
    }

    var document = hostDocument || image.ownerDocument;
    var proxy = document.createElement('img');
    proxy.onerror = callback;
    proxy.onload = function(event) {
      image.width = proxy.width;
      image.height = proxy.height;
      callback();
    };
    proxy.src = src;
  }

  function findEntryByLink(transaction, entry, callback) {
    var linkIndex = transaction.objectStore('entry').index('link');
    linkIndex.get(entry.link).onsuccess = function onSuccess() {
      callback(this.result);
    };
  }

  // Fetch the html at entry.link and use it to replace entry.content
  // TODO: consider embedding iframe content?
  // TODO: consider sandboxing iframes?
  // TODO: html compression? like enforce boolean attributes? see kangax lib
  // TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
  // TODO: if pdf content type then maybe we embed iframe with src
  // to PDF? also, we should not even be trying to fetch pdfs? is this
  // just a feature of fetchHTML or does it belong here?
  function updateEntryContent(entry, callback) {
    function onFetchError(error) {
      console.warn(error);
      callback();
    }

    var entryTimeout = 20 * 1000;

    var request = new XMLHttpRequest();
    request.timeout = entryTimeout;
    request.ontimeout = onFetchError;
    request.onerror = onFetchError;
    request.onabort = onFetchError;
    request.onload = function () {
      var document = this.responseXML;
      if(!document || !document.body) {
        console.debug('cannot augment %s', this.responseURL);
        return callback();
      }
      lucu.resolveElements(document, this.responseURL);
      var images = document.body.getElementsByTagName('img');

      async.forEach(images, fetchImageDimensions, function () {
        entry.content = document.body.innerHTML ||
          'Unable to download content for this article';
        callback();
      });
    };
    request.open('GET', entry.link, true);
    request.responseType = 'document';
    request.send();
  }
};
