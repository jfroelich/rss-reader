// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};


/*
Idea: URIResolver that uses the base element in new document trick

uses:
- resolving
- isvalid
- filter scheme



*/


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

// Accepts a url string, returns a url string without the scheme
lucu.uri.filterScheme = function(urlString) {
  var uriObject = lucu.uri.parse(urlString);
  if(!uriObject) {
    return;
  }

  delete uriObject.scheme;
  return lucu.uri.uriToString(uriObject);
};
