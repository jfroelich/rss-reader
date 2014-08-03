// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};

/**
 * Functions for working with URLs
 *
 * TODO: this currently has many problems with data uris,
 * doesnt support authentication, uris with .. syntax, etc.
 *
 * TODO: Deprecate. Facade medialize or inexorable-tash's URL polyfill
 * https://github.com/medialize/URI.js
 */
lucu.uri = {};

// Parse a string into a URI
lucu.uri.parse = function(str) {
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
 * Convert a URI object created from parseURI back into a string
 *
 * TODO: review the issues with overloading toString
 */
lucu.uri.uriToString = function(object) {

  // TODO: maybe building an array and returning the
  // join is better here?

  if(object) {
    var string = '';
    if(object.scheme)
      string = object.scheme + '://';
    if(object.host)
      string += object.host;
    if(object.path)
      string += object.path;
    if(object.query)
      string += '?' + object.query;
    if(object.fragment)
      string += '#' + object.fragment;
    return string;
  }
};

/**
 * Convert a relative URI to an absolute URI string
 *
 * TODO: return a object instead of a string
 * TODO: this should not be modifying the properties of relative
 * TODO: this cannot handle data uri
 * TODO: this cannot handle .. or ./ syntax. It is causing a lot of errors
 * TODO: this is not handlng things like "#" as a url.
 */
lucu.uri.resolve = function(baseURI, relativeURI) {
  if(baseURI && relativeURI) {
    if(!relativeURI.scheme)
      relativeURI.scheme = baseURI.scheme;
    if(!relativeURI.host)
      relativeURI.host = baseURI.host;
    return lucu.uri.uriToString(relativeURI);
  }
};

// Very naive uri validation, basically good if has a path
lucu.uri.isValid = function(object) {
  if(!object)
    return false;

  // If there is no scheme, uri.parse shoves host into path,
  // which is  a bug we have to work around.
  // Treat path as the host when schemeless.
  var host = object.scheme ? object.host : object.path;

  if(!host)
    return false;

  // Must have a period and must not start with a period
  if(host.indexOf('.') < 1)
    return false;

  // Must not have a space
  if(host.indexOf(' ') !== -1)
    return false;

  return true;
};

lucu.uri.isValidString = function(string) {
  var object = lucu.uri.parse(string);
  return lucu.uri.isValid(object);
};

// Accepts a url string, returns a url string without the scheme
lucu.uri.filterScheme = function(urlString) {
  var uriObject = lucu.uri.parse(urlString);
  if(uriObject) {
    delete uriObject.scheme;
    return lucu.uri.uriToString(uriObject);
  }
};

/////////////////////////////////////////////////////////////////

// Under development. The goal of version 2 is to provide more accurate
// URI handling. Performance is irrelevant. The goal is 100% accurate handling
// by delegation to the browser's URL parsing (via setting HTMLAnchorElement.href)
// Reference: https://github.com/inexorabletash/polyfill/blob/master/url.js
// The trick for URL resolution is simply to create a document using
// document.implementation, and to add a base tag to the head, then add the element,
// set its href, then return its href.

/*
Relevant properties of an instance of an HTMLAnchorElement, and notes

* set href  setting this parses the string and sets the other props.
* host (e.g. www.example.com)
* hostname (e.g. www.example.com)
* get href (returns the full url, relative to base (resolved, canonical and normalized))
* hash, includes the leading #
* origin (e.g. http://www.example.com) does not include trailing slash
* username (e.g. the username in http://username:www.example.com)
* password
* pathname - the path (includes leading slash)
* protocol - the scheme, includes the trailing :
* search - the query part, includes the leading ?

NOTE: caveat is we must create the element with the base in order to resolve.


*/


lucu.uri2 = {};

/*
So there is a major problem here. This delegates to the base url
of the document that included the uri.js script if the url is
relative. That will fudge everything everytime this is used.

There are 3 basic use cases:
* Parsing for resolution. This would work fine in that case because we
would expect and require the base parameter
* Checking validity. Basically just checking if it looks like a url. This
would not work fine, because the browser will always do things like
substitute in the protocol of the caller (e.g. "chrome-extension:").
* Filter scheme. Again it would not work well unless we modified the function
to require the base parameter. Even then the browser still substitutes default
values like the protocol, and we would have no accurate way of knowing.

*/
lucu.uri2.parse = function(string) {
  if(!string) {
    return;
  }

  var anchor = document.createElement('a');
  anchor.href = string;

  var result = {};

  var protocol = anchor.protocol;
  if(protocol) {
    // Strip the trailing ':'
    result.scheme = protocol.slice(0, -1);
  }

  var host = anchor.host;
  if(host) {
    result.host = host;
  }

  var path = anchor.pathname;
  if(path) {
    result.path = path;
  }

  var query = anchor.search;

  // Ignore a single '?'
  if(query && query.length > 1) {

    // Strip the leading '?'
    result.query = query.slice(1);
  }

  var fragment = anchor.hash;

  // Ignore a single '#'
  if(fragment && fragment.length > 1) {
    result.fragment = fragment.slice(1);
  }

  return result;
};