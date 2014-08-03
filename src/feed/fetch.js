// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

// TODO: maybe this module does not really belong
// as a 'feed' submodule, maybe it is its own
// fetch module?

lucu.feed = lucu.feed || {};

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
 *
 * @param params {object} an object literal that should contain props:
 * - url the remote url of the feed to fetch
 * - oncomplete - a callback to call when the feed is fetched, that is passed
 * a javascript object representing the contents of the feed
 * - onerror - a callback to call in case of an error, that is called instead
 * of oncomplete
 * - timeout - optional timeout before giving up on feed
 * - augmentEntries - if true, fetches full content of entry.link and
 * uses that instead of the feed content
 * - entryTimeout - optional timeout before giving up on fetching webpage for entry
 */
lucu.feed.fetch = function(params) {

  // NOTE: augmentEntries has to exist as a paramter because
  // we do not want to augment in a preview context.

  var url = (params.url || '').trim();
  var oncomplete = params.oncomplete || lucu.functionUtils.noop;
  var onerror = params.onerror || lucu.functionUtils.noop;
  var timeout = params.timeout;
  var augmentEntries = params.augmentEntries;
  var entryTimeout = params.entryTimeout;

  // For some unexpected reason this function is sometimes
  // called when offline so we need to check for that here
  // and exit early. This avoids a bunch of net::ERR_NETWORK_IO_SUSPENDED
  // error messages produced by request.send.
  // request.send() does not appear to throw a catchable exception.

  // NOTE: still getting this error. It is like onLine is not returning
  // false when offline.

  // NOTE: should this be the caller's responsibility? It seems kind of
  // strange to be able to call a 'fetch' operation while offline

  if(!navigator.onLine) {
    return onerror({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = onerror;
  request.ontimeout = onerror;
  request.onabort = onerror;
  request.onload = lucu.feed.onFetch.bind(request, oncomplete,
    onerror, augmentEntries, entryTimeout);
  request.open('GET', url, true);
  request.send();
};

lucu.feed.onFetch = function(onComplete, onError, shouldAugmentEntries,
  entryTimeout) {

  // Expects this instanceof XMLHttpRequest

  var mime = lucu.mime.getType(this) || '';

  if(lucu.mime.isFeed(mime)) {
    if(!this.responseXML || !this.responseXML.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    return lucu.feed.convertFromXML(this.responseXML, onComplete, onError,
      shouldAugmentEntries, entryTimeout);
  }

  if(lucu.mime.isTextHTMLOrPlain(mime)) {

    try {
      var xmlDocument = lucu.xml.parse(this.responseText);
    } catch(e) {
      return onError(e);
    }

    if(!xmlDocument || !xmlDocument.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    return lucu.feed.convertFromXML(xmlDocument, onComplete, onError,
      shouldAugmentEntries, entryTimeout);
  }

  return onError({type: 'invalid-content-type', target: this});
};

lucu.feed.convertFromXML = function(xmlDocument, onComplete, onError,
  shouldAugmentEntries, entryTimeout) {

  var feed = lucu.feed.createFromDocument(xmlDocument);

  if(feed.ERROR_UNDEFINED_DOCUMENT || feed.ERROR_UNDEFINED_DOCUMENT_ELEMENT ||
     feed.ERROR_UNSUPPORTED_DOCUMENT_ELEMENT) {

    return onError({type: 'invalid-xml'});
  }

  if(!feed.entries.length) {
    return onComplete(feed);
  }

  var entries = feed.entries || [];

  var fetchableEntries = entries.filter(lucu.entry.hasLink);

  var numEntriesToProcess = fetchableEntries.length;
  if(numEntriesToProcess == 0) {
    return onComplete(feed);
  }

  fetchableEntries.forEach(lucu.entry.rewriteLink);

  if(!shouldAugmentEntries) {
    return onComplete(feed);
  }

  var augmentContext = {};
  augmentContext.numEntriesToProcess = numEntriesToProcess;
  augmentContext.feed = feed;
  augmentContext.entries = fetchableEntries;
  augmentContext.timeout = entryTimeout;
  augmentContext.onComplete = onComplete;

  var onOpenAugment = lucu.feed.onDatabaseOpenAugmentEntries.bind(augmentContext);
  lucu.database.open(onOpenAugment);
};

lucu.feed.onDatabaseOpenAugmentEntries = function(db) {
  this.entries.forEach(lucu.feed.augmentEntry, {
    db: db,
    dispatchIfComplete: lucu.feed.onFetchDispatchIfComplete.bind(this),
    timeout: this.timeout
  });
};

lucu.feed.onFetchDispatchIfComplete = function() {
  this.numEntriesToProcess -= 1;

  if(this.numEntriesToProcess) {
    return;
  }

  console.debug('onFetchDispatchIfComplete calling onComplete');
  this.onComplete(this.feed);
};

lucu.feed.augmentEntry = function(entry) {

  // TODO: this lookup check should be per feed, not across all entries,
  // otherwise if two feeds link to the same article, only the first gets
  // augmented. need to use something like findEntryByFeedIdAndLinkURL
  // that uses a composite index

  var onFind = lucu.feed.onAugmentFindByLink.bind(this, entry);
  lucu.entry.findByLink(this.db, entry.link, onFind);
};

/**
 * Callback after searching for whether an entry already exists in
 * storage with the same link. If it already exists then this exits
 * early. If it does not then it tries to fetch the page and
 * overwrite the entry.content property.
 */
lucu.feed.onAugmentFindByLink = function(entry, existingEntry) {

  // Expects this instanceof an object containing props
  // See onDatabaseOpenAugmentEntries second parameter to forEach
  // which gets passed to augmentEntry

  if(existingEntry) {
    this.dispatchIfComplete();
    return;
  }

  // TODO: think more about what happens if content is not successfully
  // retrieved.

  // TODO: move code that sets image dimension out of onFetchHTML
  // and into an explicitly specified continuation here

  var replace = lucu.feed.replaceEntryContent.bind(null,
    entry, this.dispatchIfComplete);

  var request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.ontimeout = this.dispatchIfComplete;
  request.onerror = this.dispatchIfComplete;
  request.onabort = this.dispatchIfComplete;
  request.onload = lucu.feed.onFetchHTML.bind(request, replace,
    this.dispatchIfComplete);
  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();
};

lucu.feed.replaceEntryContent = function(entry, onComplete, doc) {
  var html = doc.body.innerHTML;
  if(html) {
    entry.content = html;
  }

  onComplete();
};

lucu.feed.onFetchHTML = function(onComplete, onError, event) {

  // Expects this instanceof XMLHttpRequest

  var mime = lucu.mime.getType(this);

  // TODO: use overrideMimeType instead of this content type check?
  if(!lucu.mime.isTextHTML(mime)) {
    return onError({type: 'invalid-content-type', target: this, contentType: mime});
  }

  // TODO: check for 404 and other status messages and handle those separately?
  // This was attached to onload. Does onload get called for other status?

  if(!this.responseXML || !this.responseXML.body) {
    return onError({type: 'invalid-document', target: this});
  }

  // TODO: consider embedding iframe content
  // TODO: consider sandboxing iframes

  // TODO: resolve element URLs
  // Leaving this here as a note. At some point we have to resolve the URLs
  // for href and src attributes. We already resolve a/img in other places
  // explicitly but we are not yet doing so for these other elements
  // var SELECTOR_RESOLVABLE = 'a,applet,audio,embed,iframe,img,object,video';

  // TODO: store redirects properly
  // NOTE: this uses the post-redirect url as the base url for anchors

  var baseURI = lucu.uri.parse(this.responseURL);
  var anchors = this.responseXML.body.querySelectorAll('a');
  var resolveAnchor = lucu.anchor.resolve.bind(this, baseURI);
  lucu.element.forEach(anchors, resolveAnchor);

  // TODO: should we notify the callback of responseURL (is it
  // the url after redirects or is it the same url passed in?). i think
  // the onload callback should also receive responseURL. maybe onerror
  // should also receive responseURL if it is defined. that way the caller
  // can choose to also replace the original url

  // TODO: one of the problems with fetching images before scrubbing is that
  // tracker gifs are pinged by the image loader. think of how to avoid stupid
  // requests like that
  // TODO: the caller should be responsible for choosing this followup
  // process. This should not be controlling the flow here
  // TODO: move image prefetching out of here to some type of caller, this should
  // only fetch

  // NOTE: this uses the post-redirect responseURL as the base url
  lucu.feed.augmentImages(this.responseXML, this.responseURL, onComplete);
};


/**
 * Set dimensions for image elements that are missing dimensions.
 *
 * TODO: maybe most of this code can be moved into onFetchHTML
 * above
 *
 * TODO: srcset, picture (image families)
 * TODO: just accept an xhr instead of doc + baseURL?
 *
 * TODO: does this function really belong in image module or
 * somewhere else? I am not really happy with the current
 * organization.
 *
 * @param doc {HTMLDocument} an HTMLDocument object to inspect
 * @param baseURL {string} for resolving image urls
 * @param oncomplete {function}
 */
lucu.feed.augmentImages = function(doc, baseURL, onComplete) {

  var allBodyImages = doc.body.getElementsByTagName('img');

  // TODO: parse base URL here.
  // NOTE: we cannot exit early here if missing base url. All images
  // could be absolute and still need to be loaded. Rather, a missing
  // baseURL just means we should skip the resolve step

  var resolvedImages;
  var baseURI = lucu.uri.parse(baseURL);

  // TODO: this baseURI check pre-condition might be pointless
  // because resolveImage makes this determination for us
  // so I should just be calling it regardless

  if(baseURI) {
    resolvedImages = Array.prototype.map.call(allBodyImages,
      lucu.feed.resolveImage.bind(null, baseURI));
  } else {
    resolvedImages = Array.prototype.slice.call(allBodyImages);
  }

  // Filter out data-uri images, images without src urls, and images
  // with dimensions, to obtain a subset of images that are augmentable
  var loadableImages = resolvedImages.filter(lucu.feed.shouldUpdateImage);

  var numImagesToLoad = loadableImages.length;

  if(numImagesToLoad === 0) {
    return onComplete(doc);
  }

  // NOTE: rather than using forEach and numImages check, see if there is some type
  // of async technique that empties a queue and calls onComplete when queue is empty

  loadableImages.forEach(lucu.feed.updateImageElement.bind(null, dispatchIfComplete));

  // TODO: move this out of here
  function dispatchIfComplete() {
    if(--numImagesToLoad === 0) {
      onComplete(doc);
    }
  }
};

lucu.feed.updateImageElement = function(onComplete, remoteImage) {

  // TODO: maybe onComplete should be a member of the env and not
  // a pre-supplied (partial) parameter to this function

  // Nothing happens when changing the src property of an HTMLImageElement
  // that is located in a foreign Document context. Therefore we have to
  // create an image element within the local document context for each
  // image in the remote context (technically we could reuse one local
  // element). Rather than creating new ones, we can just import the
  // remote, which does a shallow element clone from remote to local.

  // TODO: does this next line cause an immediate fetch? If it does
  // then it kind of defeats the point of changing the source later on,
  // right?

  var localImage = document.importNode(remoteImage, false);

  // If a problem occurs just go straight to onComplete and do not load
  // the image or augment it.
  localImage.onerror = onComplete;

  // TODO: move this nested function out of here
  localImage.onload = function() {

    // Modify the remote image properties according to
    // the local image properties
    remoteImage.width = this.width;
    remoteImage.height = this.height;
    //console.debug('W %s H %s', remoteImage.width, remoteImage.height);
    onComplete();
  };

  // Setting the src property is what triggers the fetch. Unfortunately
  // the 'set' operation is ignored unless the new value is different
  // than the old value.
  var src = localImage.src;
  localImage.src = void src;
  localImage.src = src;
};

lucu.feed.shouldUpdateImage = function(imageElement) {

  if(imageElement.width) {
    return false;
  }

  var source = (imageElement.getAttribute('src') || '').trim();

  if(!source) {
    return false;
  }

  // I assume dimensions for data uris are set when the data uri is
  // parsed, because it essentially represents an already loaded
  // image. However, we want to make sure we do not try to fetch
  // such images
  if(/^\s*data:/i.test(source)) {
    // console.debug('data uri image without dimensions? %o', imageElement);
    // NOTE: above sometimes appears for data uris. i notice it is appearing when
    // width/height attribute not expressly set in html. maybe we just need to
    // read in the width/height property and set the attributes?
    // but wait, we never even reach reach is width is set. so width isnt
    // set for a data uri somehow. how in the hell does that happen?
    // is it because the element remains inert (according to how parseHTML works)?

    // Is it even possible to send a GET request to a data uri? Does that
    // even make sense?

    return false;
  }

  // We have a fetchable image with unknown dimensions
  // that we can augment
  return true;
};


/**
 * Mutates an image element in place by changing its src property
 * to be a resolved url, and then returns the image element.
 */
lucu.feed.resolveImage = function(baseURI, imageElement) {

  if(!baseURI) {
    return imageElement;
  }

  var sourceURL = (imageElement.getAttribute('src') || '').trim();

  // No source, so not resolvable
  if(!sourceURL) {
    return imageElement;
  }

  // this should not be resolving data: urls. Test and
  // exit early here. In at least one calling context,
  // augmentImages in http.js, it is not bothering to pre-filter
  // data: uri images before calling this function, so the
  // test has to be done here. i think it is better to do it here
  // than require the caller to avoid calling this on uri because
  // this does the attribute empty check.
  // note: in reality the URI module should be able to handle
  // this edge case and seamlessly work (calls to resolve would
  // be no ops). But the current URI module implementation is
  // shite so we have to check.

  if(/^\s*data:/i.test(sourceURL)) {
    // console.debug('encountered data: url %s', sourceURL);
    return imageElement;
  }

  // NOTE: seeing GET resource://.....image.png errors in log.
  // TODO: I guess these should not be resolved either? Need to
  // learn more about resource URLs

  if(/^resource:/.test(sourceURL)) {
    console.debug('encountered resource: url %s', sourceURL);
    return imageElement;
  }

  var sourceURI = lucu.uri.parse(sourceURL);

  if(!sourceURI) {
    return imageElement;
  }

  // NOTE: this is not working correctly sometimes when resolving relative URLs
  // For example: GET http://example.compath/path.gif is missing leading slash

  // NOTE: resolveURI currently returns a string. In the future it should
  // return a URL, but that is not how it works right now, so we do not have
  // to convert the uri to a string explicitly here.
  var resolvedURL = lucu.uri.resolve(baseURI, sourceURI);

  if(resolvedURL == sourceURL) {
    // Resolving had no effect
    return imageElement;
  }

  imageElement.setAttribute('src', resolvedURL);

  return imageElement;
};
