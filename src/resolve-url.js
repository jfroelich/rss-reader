// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Creates a URL object from the given input string. baseURL is required.
// baseURL must be a URL object. The created URL is absolute.
// Note that the input url also undergoes normalization as a result of
// creating a URL object. When accessing the resulting URL object's href
// property or calling toString, the resulting string is a normalized form
// of the input url.
function resolveURL(urlString, baseURL) {

  // Guard here, this is largely just for convenience of callers to not need
  // to check. It also potentially reduces the number of things that happen
  // in this function, even though all later statements tolerate null/undefined
  // I am not guarding against improper type.
  if(!urlString) {
    return null;
  }

  // Do not try and resolve inline script
  if(/^\s*javascript:/i.test(urlString)) {
    return null;
  }

  // Do not try and resolve object urls
  if(/^\s*data:/i.test(urlString)) {
    return null;
  }

  try {
    return new URL(urlString, baseURL);
  } catch(exception) {
    console.debug('Error resolving url %s with base %s', urlString,
      baseURL.href);
  }

  return null;
}
