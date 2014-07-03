'use strict';
/**
 * Fetches the XML for a feed from a URL, then parses it into
 * a javascript object, and passes this along to a callback. If an error
 * occurs along the way, calls an error callback instead. Async.
 *
 * For each entry, if augmentEntries is true, if the entry has
 * a link, this also sends subsequent http requests to get the full html
 * of the link and uses that instead of the entry.content property that
 * was provided from within the xml feed.
 *
 * NOTE: onerror could be passed an XMLHttpRequest event containing an error,
 * an exception, a string, or a custom object
 * NOTE: unlike old API, oncomplete is not always called, onerror is called instead
 * so make note of that there are now two exit points not one with a possible
 * side effect.
 *
 * TODO: this should not also do the xml to feed conversion. The coupling is
 * too tight because I want to be able to test fetching and transformation
 * separately.
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
  var oncomplete = params.oncomplete || noop;
  var onerror = params.onerror || noop;
  var timeout = timeout;
  var augmentImageData = params.augmentImageData;
  var augmentEntries = params.augmentEntries;
  var rewriteLinks = params.rewriteLinks;
  var entryTimeout = params.entryTimeout;

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;

  // Partial binding
  // Something like request.onload = onFeedLoaded.bind(request, convertToFeed, onerror);

  request.onload = onFeedLoaded;
  request.open('GET', url, true);
  request.send();

  // Gets the xml from the response and handoffs to createFeedFromXML
  // or onerror
  function onFeedLoaded() {
    // TODO: does getResponseHeader ever return undefined?
    // TODO: does case matter?
    // TODO: should we parse out mime type?
    var contentType = this.getResponseHeader('Content-Type') || '';

    if(isContentTypeFeed(contentType)) {
      if(this.responseXML && this.responseXML.documentElement) {
        convertToFeed(this.responseXML);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else if(isContentTypeHTMLOrText(contentType)) {

      try {
        var xmlDocument = parseXML(this.responseText);
      } catch(e) {
        return onerror(e);
      }

      if(xmlDocument && xmlDocument.documentElement) {
        convertToFeed(xmlDocument);
      } else {
        onerror({type:'invalid-xml',target:this});
      }
    } else {
      onerror({type:'invalid-content-type',target:this});
    }
  }

  function convertToFeed(xmlDocument) {
    var feed = createFeedFromDocument(xmlDocument);

    if(feed.ERROR_UNDEFINED_DOCUMENT ||
       feed.ERROR_UNDEFINED_DOCUMENT_ELEMENT ||
       feed.ERROR_UNSUPPORTED_DOCUMENT_ELEMENT) {

      return onerror({type:'invalid-xml'});
    }

    if(!feed.entries.length) {
      return oncomplete(feed);
    }

    var entries = feed.entries || [];
    var fetchableEntries = entries.filter(function(entry) {
      return !!entry.link;
    });
    var numEntriesToProcess = fetchableEntries.length;
    if(numEntriesToProcess == 0) {
      return oncomplete(feed);
    }

    if(rewriteLinks) {
      fetchableEntries.forEach(function(inputEntry) {
        inputEntry.link = rewriteURL(inputEntry.link);
      });
    }

    // In order to ensure consistent storage of entry.link values,
    // this check for whether to augment does not occur until after
    // entries with links have been possibly rewritten.
    if(!augmentEntries) {
      return oncomplete(feed);
    }

    // The following needs revision and just outright better design
    // We have some urls to fetch. But we don't want to fetch
    // for entries that are already stored in the database, sort of. It would
    // be nice to do things like retry later fetching.
    // TODO: this should be per feed, not across all entries, otherwise
    // if two feeds link to the same article, only the first gets augmented.
    // need to use something like findEntryByFeedIdAndLinkURL that uses
    // a compound index

    openIndexedDB(function(db) {
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
        augmentImageData: augmentImageData,
        url: entry.link,
        onload: function(doc) {
          var html = doc.body.innerHTML;
          if(html)
            entry.content = html;
          dispatchIfComplete();
        },
        onerror: function(error) {
          console.log(error);
          dispatchIfComplete();
        },
        timeout: entryTimeout
      });
    }

    function dispatchIfComplete() {
      if(--numEntriesToProcess == 0) {
        oncomplete(feed);
      }
    }
  }
}