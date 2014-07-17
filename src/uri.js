// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Functions for working with URLs
 *
 * TODO: this currently has many problems with data uris,
 * doesnt support authentication, uris with .. syntax, etc.
 * NOTE: nodejs has a great reference implementation, consider
 * using that instead
 *
 * Deprecate or facade this
 * https://github.com/medialize/URI.js
 */

/**
 * Parse a string into a URI
 */
function parseURI(str) {
  if(str) {
    var m = str.match(/^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/);
    var r = {};
    if(m[1]) r.scheme = m[1];
    if(m[2]) r.host = m[2];
    if(m[3]) r.path = m[3];
    if(m[4]) r.query = m[4];
    if(m[5]) r.fragment = m[5];
    return r;
  }
}

/**
 * Convert a URI object created from parseURI back into a string
 */
function uriToString(obj) {
  if(obj) {
    var s = '';
    if(obj.scheme) s = obj.scheme + '://';
    if(obj.host) s += obj.host;
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
}

/**
 * Convert a relative URI to an absolute URI string
 *
 * TODO: return a object instead of a string
 * TODO: this should not be modifying the properties of relative
 *
 * TODO: this cannot handle data uri
 * TODO: this cannot handle .. or ./ syntax
 */
function resolveURI(baseURI,relativeURI) {
  if(baseURI && relativeURI) {
    if(!relativeURI.scheme) relativeURI.scheme = baseURI.scheme;
    if(!relativeURI.host) relativeURI.host = baseURI.host;
    return uriToString(relativeURI);
  }
}

/**
 * Very naive uri validation, basically good if has a path
 */
function isValidURI(uriObject) {
  if(uriObject) {
    // If there is no scheme, uri.parse shoves host into path,
    // which is  a bug we have to work around.
    // Treat path as the host when schemeless.
    var host = uriObject.scheme ? uriObject.host : uriObject.path;
    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;
  }
}

function isValidURIString(urlString) {
  return isValidURI(parseURI(urlString));
}

function getSchemelessURL(urlString) {
  var uriObject = parseURI(urlString);
  if(uriObject) {
    delete uriObject.scheme;
    return uriToString(uriObject);
  }
}

// Returns a rewritten url, or the original url if no rewriting rules were applicable.
// TODO: model after apache mod_rewrite and avoid hard-coding rules in logic
function rewriteURL(urlString) {
  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(urlString);
  if(matches && matches.length === 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    return newURL;
  }

  return urlString;
}

// Loosely tests whether urlString represents a data uri
function isDataURL(urlString) {

  // NOTE: https://gist.github.com/bgrins/6194623 is a more accurate
  // and helpful reference implementation. But I am more concerned about
  // false negatives than false positives here so loose is fine.

  // TODO: consider relaxing to allow leading space here?
  // not really a defensive guard. or maybe its better to say
  // that callers must trim.

  return /^data:/i.test(urlString);
}


/**
 * Returns a URL string pointing to the fav icon for a url. If url is
 * undefined/empty, the locally stored default fav icon url is returned
 * instead.
 *
 * NOTE: chrome://favicons/url only works for urls present in
 * history, so it is useless.
 * TODO: this should be using a callback, to allow for more seamless
 * transition to async service call.
 * TODO: support offline. right now this returns a remote url which
 * then causes images to not load later if offline.
 * TODO: this is should be refactored to look more like a wrapper call
 * to a service from which urls are fetched.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
 *
 * @param url {string} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {string} the url of the favicon
 */
function getFavIconURL(urlString) {
  return urlString ?
    'http://www.google.com/s2/favicons?domain_url=' + encodeURIComponent(urlString) :
    '/media/rss_icon_trans.gif';
}