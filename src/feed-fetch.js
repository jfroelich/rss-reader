// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, if augmentEntries is true, and if the entry has
 * a link, this also sends subsequent http requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * TODO: onerror could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object. I need to standardize the
 * error object that is passed to onerror. I also think it really does
 * need error codes because identifying each error by string key is making
 * it difficult to respond to different errors differently.
 *
 * TODO: this should not also do the xml to feed conversion. The coupling is
 * too tight because I want to be able to test fetching and transformation
 * separately. but separate web page fetching requires the feed be
 * converted first to identify links
 *
 * TODO: separate timeout for feed fetch and web page fetch
 * TODO: option to fetch/not fetch webpages instead of always fetch
 * TODO: formalize/standardize the parameter to onerror?
 * TODO: is an approach that uses overrideMimeType better than
 * checking content type? will it just cause the native parsing errors I
 * was trying to avoid?
 *
 * TODO: responseURL contains the redirected URL. Need to update the url
 * when that happens.
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed (or web pages)
 * - augmentEntries - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - augmentImageData - augment image data in fetched web pages
 * - rewriteLinks - if true, entry.link values are rewritten in the feed
 * prior to fetching or checking if already fetched in db
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */
function fetchFeed(params) {

  var url = (params.url || '').trim();
  var oncomplete = params.oncomplete || lucu.functionUtils.noop;
  var onerror = params.onerror || lucu.functionUtils.noop;
  var timeout = timeout;
  var augmentImageData = params.augmentImageData;
  var augmentEntries = params.augmentEntries;
  var rewriteLinks = params.rewriteLinks;
  var entryTimeout = params.entryTimeout;

  // For some unexpected reason this function is sometimes
  // called when offline so we need to check for that here
  // and exit early. This avoids a bunch of net::ERR_NETWORK_IO_SUSPENDED
  // error messages produced by request.send. request.send()
  // does not appear to throw a catchable exception.

  // NOTE: still getting this error. It is like onLine is not returning
  // false when offline.

  if(!navigator.onLine) {
    return onerror({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = onRemoteFeedFetched.bind(request, oncomplete, onerror,
    augmentEntries, augmentImageData, rewriteLinks, entryTimeout);
  request.open('GET', url, true);
  request.send();
}

// expects to be bound to an XMLHttpRequest
function onRemoteFeedFetched(onComplete, onError, shouldAugmentEntries,
  shouldAugmentImages, rewriteLinks, entryTimeout) {

  // TODO: parse content type into mime type and encoding?

  var contentType = this.getResponseHeader('Content-Type') || '';

  if(isContentTypeFeed(contentType)) {
    if(!this.responseXML || !this.responseXML.documentElement) {
      return onError({type:'invalid-xml',target:this});
    }

    return convertToFeed(this.responseXML, onComplete, onError, shouldAugmentEntries,
      shouldAugmentImages, rewriteLinks, entryTimeout);
  }

  if(isContentTypeHTMLOrText(contentType)) {

    try {
      var xmlDocument = parseXML(this.responseText);
    } catch(e) {
      return onError(e);
    }

    if(!xmlDocument || !xmlDocument.documentElement) {
      return onError({type:'invalid-xml',target:this});
    }

    return convertToFeed(xmlDocument, onComplete, onError, shouldAugmentEntries,
      shouldAugmentImages, rewriteLinks, entryTimeout);
  }

  return onError({type:'invalid-content-type',target:this});

}

function convertToFeed(xmlDocument, onComplete, onError,
  shouldAugmentEntries, shouldAugmentImages, rewriteLinks, entryTimeout) {

  var feed = createFeedFromDocument(xmlDocument);

  if(feed.ERROR_UNDEFINED_DOCUMENT ||
     feed.ERROR_UNDEFINED_DOCUMENT_ELEMENT ||
     feed.ERROR_UNSUPPORTED_DOCUMENT_ELEMENT) {

    return onError({type:'invalid-xml'});
  }

  if(!feed.entries.length) {
    return onComplete(feed);
  }

  var entries = feed.entries || [];

  var fetchableEntries = entries.filter(entryHasLinkProperty);

  var numEntriesToProcess = fetchableEntries.length;
  if(numEntriesToProcess == 0) {
    return onComplete(feed);
  }

  if(rewriteLinks) {
    fetchableEntries.forEach(rewriteEntryLink);
  }

  // In order to ensure consistent storage of entry.link values,
  // this check for whether to augment does not occur until after
  // entries with links have been possibly rewritten, so that
  // rewritten links are stored either way
  if(!shouldAugmentEntries) {
    return onComplete(feed);
  }

  // The following needs revision and just outright better design
  // We have some urls to fetch. But we don't want to fetch
  // for entries that are already stored in the local cache. It would
  // be nice to do things like retry later fetching.
  // TODO: this lookup check should be per feed, not across all entries,
  // otherwise if two feeds link to the same article, only the first gets
  // augmented. need to use something like findEntryByFeedIdAndLinkURL
  // that uses a composite index

  lucu.database.open(function(db) {
    fetchableEntries.forEach(function(entry) {
      findEntryByLink(db, entry.link, function(existingEntry) {
        if(existingEntry) {
          dispatchIfComplete();
        } else {
          augmentEntry(entry);
        }
      });
    });
  });

  function augmentEntry(entry) {
    fetchHTMLDocument({
      augmentImageData: shouldAugmentImages,
      url: entry.link,
      onload: function(doc) {
        var html = doc.body.innerHTML;
        if(html)
          entry.content = html;
        dispatchIfComplete();
      },
      onerror: function(error) {
        console.debug('augmentEntry error %o', error);
        dispatchIfComplete();
      },
      timeout: entryTimeout
    });
  }

  function dispatchIfComplete() {
    if(--numEntriesToProcess == 0) {
      onComplete(feed);
    }
  }
}


function entryHasLinkProperty(entry) {
  return !!entry.link;
}

function rewriteEntryLink(entry) {
  entry.link = rewriteURL(entry.link);
}
