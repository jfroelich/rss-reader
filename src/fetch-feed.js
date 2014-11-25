// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * TODO: fetchFullArticles should not be a parameter and should not occur
 * here. Use the new lucu.augmentEntryContent function.
 *
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, if fetchFullArticles is true, and if the entry has
 * a link, this also sends subsequent http requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * TODO: onError could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object. I need to standardize the
 * error object that is passed to onError. I also think it really does
 * need error codes because identifying each error by string key is making
 * it difficult to respond to different errors differently.
 * TODO: request.responseURL contains the redirected URL. Need to update the url
 * when that happens. Maybe I need to be storing both urls in the db?
 */
lucu.fetchFeed = function(params) {
  'use strict';

  // TODO: once I move out the augment code, change params back to explicit
  // arguments
  // TODO: remove duplicate entries?
  // TODO: move the augment stuff completely out of the fetch-feed
  // function and into its thing and then deprecate entryTimeout
  // and shouldAugmentEntries parameter
  // NOTE: fetchFullArticles exists because fetch is doing two things instead
  // of one. I should never haved mixed together the augmentEntry code with
  // the fetch code. The caller can easily just pass the result of fetch to
  // fetchFullArticles using two function calls.

  var url = (params.url || '').trim();
  var noop = function(){};
  var onComplete = params.oncomplete || noop;
  var onError = params.onerror || noop;
  var timeout = params.timeout;

  // TODO: deprecate these once moved out of here
  var fetchFullArticles = params.fetchFullArticles;
  var entryTimeout = params.entryTimeout;

  // TODO: should this be the caller's responsibility? It seems kind of
  // strange to be able to call a 'fetch' operation while offline
  if(navigator && !navigator.onLine) {
    return onError({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function(event) {
    console.debug('fetch feed error');
    console.dir(event);
    onError(event);
  };
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = function() {
    var xmlDocument = this.responseXML;
    if(!xmlDocument || !xmlDocument.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    try {
      var feed = lucu.deserializeFeed(xmlDocument);
    } catch(e) {
      return onError({type: 'invalid-xml', target: this, details: e});
    }

    feed.entries = feed.entries.filter(function (entry) {
      return entry.link;
    });

    feed.entries = feed.entries.map(function (entry) {
      entry.link = lucu.rewriteURL(entry.link);
      return entry;
    });

    if(!fetchFullArticles) {
      return onComplete(feed);
    }

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
    conn.onerror = onDatabaseError;
    conn.onblocked = onDatabaseError;
    conn.onsuccess = function onDatabaseOpen() {
      var transaction = this.result.transaction('entry');
      async.reject(feed.entries, findEntryByLink.bind(this, transaction),
        function (entries) {
        async.forEach(entries, updateEntryContent, function () {
          onComplete(feed);
        });
      });
    };
  };

  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();

  function onDatabaseError(error) {
    console.warn(error);
    onComplete(feed);
  }

  // TODO: do not use window explicitly here. Depends on how
  // the deprecation of shouldAugmentEntries goes
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
      // Do NOT pass error to callback, that halts async.forEach
      callback();
    }

    var request = new XMLHttpRequest();
    // TODO: do a better job of initializing this
    request.timeout = entryTimeout;
    request.ontimeout = onFetchError;
    request.onerror = onFetchError;
    request.onabort = onFetchError;
    request.onload = function () {
      var document = this.responseXML;
      if(!document || !document.body) {
        console.debug('undefined document or document element %s', this.responseURL);
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
