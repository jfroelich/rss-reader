// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: now that I have tested this a bit, I have realized that maybe it does
// not need to exist. Just using a URL object in the first place takes me
// 99% of the way there. The other normalizations I have added are not even
// that important. Working with URL objects everywhere will be sufficient.
// So maybe even though I might add this in and put it everywhere, I might then
// take out the calls to this function. Because half of the work is really just
// switching to URL objects.

// Returns a normalized URL. The input variable should be a URL object, not a
// string. The output is a URL object, not a string. Note that by requiring
// the input to be a URL object, this guarantees the URL is absolute, because
// this function only works with absolute URLs. The input url is not modified,
// a new URL object is returned.
function normalizeURL(inputURL) {

  // Temporary, just to ensure the other parts of the code all error out very
  // explicitly while I am implementing this for the first time. I will
  // eventually remove this condition once the code is working.
  if(Object.prototype.toString.call(inputURL) !== '[object URL]') {
    console.warn('Incorrect variable type:',
      Object.prototype.toString.call(inputURL));
    return null;
  }

  // Clone the input URL into the output url. I want this function to not have
  // side effects, and I prefer not to modify function parameters, I want to
  // treat inputs as constant.
  // Simply calling href here, which is equivalent to calling toString, does
  // much of the normalization for us:
  // - protocol is lowercased
  // - hostname is lowercased
  // - default ports are stripped
  // - when inputURL was created, it trimmed whitespace
  // - untested but i think invalid characters are filtered
  const outputURL = new URL(inputURL.href);

  // Remove the search when it is just '?' without anything else. This behavior
  // is not provided by the implicit normalization that occurs within the URL
  // object constructor or href property accessor or toString.
  // NOTE: outputURL.search returns an empty string when nothing is present
  // NOTE: outputURL.search returns an empty string when just a '?' is present
  // NOTE: outputURL.search returns a string, including '?', when something is
  // present.
  if(!outputURL.search.length) {
    outputURL.search = '';
  }

  // Other normalizations to consider? Perhaps as options
  // - Strip 'www.' from hostname
  // - Strip fragment?
  return outputURL;
}
