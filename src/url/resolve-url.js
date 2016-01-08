// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Returns a resolved url as a string, or the input url
// Requires: URI.js
// @param baseURL {String} the base url
// @param url {String} the relative url to resolve
function resolveURL(baseURL, url) {
  'use strict';
  try {
    const uri = new URI(url);
    if(!uri.protocol()) {
      const resolved = uri.absoluteTo(baseURL).toString();
      return resolved;
    }
  } catch(exception) {
    console.debug('Exception resolving url "%s": %o', url, exception);
  }

  return url;
}
