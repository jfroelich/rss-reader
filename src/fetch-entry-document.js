// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Fetches the document and the given url, and then prepares it for processing
// and storage. For example, all urls are made absolute, <base> elements are
// removed, sourceless images are removed, and so forth. The callback receives
// an event with the properties type (string), responseURL (URL), responseXML
// (document). If successful the type is 'success'.
function fetchEntryDocument(requestURL, timeoutMillis, callback) {

  // Check if the url is blacklistsed
  if(isResistantURL(requestURL)) {
    const event = Object.create(null);
    event.type = 'resistanturl';
    event.requestURL = requestURL;
    callback(event);
    return;
  }

  // Do not attempt to fetch obvious pdfs based on the url
  const path = requestURL.pathname;
  if(path && path.length > 5 && /\.pdf$/i.test(path)) {
    const event = Object.create(null);
    event.type = 'pdfurl';
    event.requestURL = requestURL;
    callback(event);
    return;
  }

  const fetchRequest = new XMLHttpRequest();
  fetchRequest.timeout = timeoutMillis;
  fetchRequest.ontimeout = onResponse;
  fetchRequest.onerror = onResponse;
  fetchRequest.onabort = onResponse;
  fetchRequest.onload = onResponse;
  const doAsyncFetchRequest = true;
  fetchRequest.open('GET', requestURL.href, doAsyncFetchRequest);
  fetchRequest.responseType = 'document';
  fetchRequest.send();

  function onResponse(event) {
    const outputEvent = Object.create(null);

    if(event.type !== 'load') {
      outputEvent.type = event.type;
      callback(outputEvent);
      return;
    }

    const document = event.target.responseXML;
    if(!document) {
      outputEvent.type = 'undefineddocument';
      callback(outputEvent);
      return;
    }

    outputEvent.type = 'success';

    const responseURL = new URL(event.target.responseURL);
    outputEvent.responseURL = responseURL;

    transformLazilyLoadedImages(document);
    filterSourcelessImages(document);
    resolveDocumentURLs(document, responseURL);
    filterTrackingImages(document);
    setImageElementDimensions(document,
      onSetImageDimensions.bind(null, outputEvent));
  }

  // TODO: deprecate fetchStats in setImageElementDimensions
  function onSetImageDimensions(event, document, fetchStats) {
    event.responseXML = document;
    callback(event);
  }
}

// Scan the document for image elements that do not have a source value.
// Although hasAttribute yields false negatives in the case a src attribute
// is present but contains an empty value, I consider this sufficiently
// accurate.
function filterSourcelessImages(document) {
  const images = document.querySelectorAll('img');
  // Not using for .. of due to profiling error NotOptimized TryCatchStatement
  //for(let image of images) {
  for(let i = 0, len = images.length; i < len; i++) {
    let image = images[i];
    if(!image.hasAttribute('src') && !image.hasAttribute('srcset')) {
      // console.debug('Removing sourcless image', image.outerHTML);
      image.remove();
      break;
    }
  }
}


// Returns true if the URL is resistant. An article is resistant when it cannot
// be easily rendered. For example, because Javascript is disabled, a site that
// does not provide viewable content because it is entirely Javascript
// rendered.
// Currently this uses a hardcoded blacklist of domains.
// TODO: an alternate would be to design a set of policies, which are
// basically individual filter functions, and then test all policies
// in the calling context of this function in place of this function.
// This would make the policies easily extendable, externally configurable
// or maybe something loaded from local storage or something like that.
// so install sets up the default list, and this just reads it in
// Or, alternatively, this should just be somehow easily extendable without
// the need for internal modification
function isResistantURL(url) {

  // url normalization currently does not do anything with www. prefix so
  // i have to provide both forms of the url

  // Google Groups is javascript rendered.
  // Forbes uses a Continue page preventing crawling

  const blacklist = [
    'productforums.google.com',
    'groups.google.com',
    'www.forbes.com',
    'forbes.com'
  ];

  // NOTE: hostname getter normalizes to lowercase
  return blacklist.includes(url.hostname);
}
