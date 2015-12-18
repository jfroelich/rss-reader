// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: scheme is a less standard name than protocol, so this should be
// renamed to something like filterURLProtocol, filter-url-protocol.js

// Returns a url string without its protocol
// Requires URI lib
function getSchemelessURL(url) {
  'use strict';
  const uri = new URI(url);
  uri.protocol('');

  // Also remove the leading slashes
  return uri.toString().substring(2);
}
