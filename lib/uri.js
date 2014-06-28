/**
 * Functions for working with URLs
 */

/*************** URI **************************
 * TODO: look at how node.js did URI
 */

// Parse a string into a URI
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

// Convert URI to string representation
function toStringURI(obj) {
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

// Convert a relative URI to an absolute URI string
// TODO: return a URI object, let the caller decide what to do with it
function resolveURI(base,path) {
  if(base && path) {
    if(!path.scheme) path.scheme = base.scheme;
    if(!path.host) path.host = base.host;
    return toStringURI(path);
  }
}

// Extremely basic URL validition
function isValidURI(obj) {
  if(obj) {
    // If there is no scheme, URI.parse shoves host into path,
    // which is sort of a bug. Treat path as the host
    var host = obj.scheme ? obj.host : obj.path;

    return host && host.indexOf('.') > 0 && host.indexOf(' ') == -1;
  }
}

function isValidURIString(str) {
  return isValidURI(parseURI(str));
}

function getSchemelessURL(url) {
  var schemeless = URI.parse(url);
  if(schemeless) {
    delete schemeless.scheme;
    return URI.toString(schemeless);
  }
}



/*************** URL REWRITING ***************************************
 * TODO: model after apache mod_rewrite
 */

/**
 * Returns a rewritten url, or the original url if no rewriting rules were applicable.
 *
 * NOTE: I tore apart all the old rewriting code because I decided that its too
 * confusing of a feature for users to configure rewriting rules, and that it was
 * better to just hardcode in some known proxies.
 */
function rewriteURL(url) {
  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(url);
  if(matches && matches.length == 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    //console.log('rewrote %s as %s', url, newURL);

    // NOTE: we know it is not empty
    return newURL;
  }

  return url;
}




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
function isDataURI(url) {
  return /^data:/i.test(url);
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
 * to a service from which urls are fetched. After all this is partly
 * why this function is put in the fetch namespace.
 * TODO: does it matter whether we use http or https?
 * TODO: does fetching involve CORS issues or need to change manifest
 * or similar issues? If I ever want to stop using all_urls, the
 * URLs used here would maybe need to be explicit in manifest?
 *
 * @param url {string} the url of a webpage for which to find the
 * corresponding fav icon.
 * @return {string} the url of the favicon
 */
function getFavIconURL(url) {
  var GOOGLE_BASE_URL = 'http://www.google.com/s2/favicons?domain_url=';
  var FALLBACK_URL = '/media/rss_icon_trans.gif';
  return url ?  GOOGLE_BASE_URL + encodeURIComponent(url) : FALLBACK_URL;
}