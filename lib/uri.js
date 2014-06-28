/**
 * Functions for working with URLs
 *
 * TODO: this currently has many problems with data uris,
 * doesnt support authentication, uris with .. syntax, etc.
 * NOTE: nodejs has a great reference implementation, consider
 * using that instead
 */

'use strict';

var uri = {};

/**
 * Parse a string into a URI
 */
uri.parse = function(str) {
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
};

/**
 * Convert a URI object created from parse back into a string
 * NOTE: named toURLString instead of toString because I am not
 * 100% certain yet of the effect of changing toString, which is
 * a native method of many thingsm and because here we pass in
 * an object.
 */
uri.toURLString = function(obj) {
  if(obj) {
    var s = '';
    if(obj.scheme) s = obj.scheme + '://';
    if(obj.host) s += obj.host;
    if(obj.path) s += obj.path;
    if(obj.query) s += '?' + obj.query;
    if(obj.fragment) s += '#' + obj.fragment;
    return s;
  }
};

/**
 * Convert a relative URI to an absolute URI string
 *
 * TODO: return a uri object instead of a string and
 * let the caller decide what to do
 * TODO: this should ont be modifying relative, it
 * should be cloning and modifying the clone
 */
uri.resolve = function(baseURI,relativeURI) {
  if(baseURI && relativeURI) {
    if(!relativeURI.scheme) relativeURI.scheme = baseURI.scheme;
    if(!relativeURI.host) relativeURI.host = baseURI.host;
    return this.toURLString(relativeURI);
  }
};

/**
 * Very naive uri validation, basically good if has a path
 */
uri.isValid = function(uriObject) {
  if(uriObject) {

    // If there is no scheme, uri.parse shoves host into path,
    // which is  a bug we have to work around.
    // Treat path as the host when schemeless.
    var host = uriObject.scheme ? uriObject.host : uriObject.path;

    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;
  }
};

uri.isValidString = function(urlString) {
  return this.isValid(this.parse(urlString));
};

uri.getSchemelessURL = function(urlString) {
  var uriObject = this.parse(url);
  if(uriObject) {
    delete uriObject.scheme;
    return this.toURLString(uriObject);
  }
};


/**
 * Returns a rewritten url, or the original url if no rewriting rules were applicable.
 *
 * TODO: model after apache mod_rewrite and avoid hard-coding rules in logic
 */
uri.rewrite = function(urlString) {
  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(urlString);
  if(matches && matches.length == 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);

    //console.log('rewrote %s as %s', url, newURL);

    return newURL;
  }

  // Return the original
  return urlString;
};

/**
 * Tests whether str is a data uri. Only intended to be good enough
 * to avoid issues such as trying to resolve or fetch data uris.
 *
 * NOTE: would be nice if we could check some property of the
 * element containing the url, but I could not find another
 * indicator. element.src always returns a DOMString.
 *
 * NOTE: https://gist.github.com/bgrins/6194623 is helpful
 * @param url {string} the url to test
 * @return {boolean} true if it looks like an object url
 */
uri.isDataURL = function(urlString) {
  return /^data:/i.test(urlString);
};

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
uri.getFavIconURL = function(urlString) {
  var GOOGLE_BASE_URL = 'http://www.google.com/s2/favicons?domain_url=';
  var FALLBACK_URL = '/media/rss_icon_trans.gif';
  return urlString ?  GOOGLE_BASE_URL + encodeURIComponent(urlString) : FALLBACK_URL;
};