// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Given a serialized input feed, generates a new deserialized output Feed
function deserialize_feed(inputFeed) {
  const outputFeed = new Feed();
  Object.assign(outputFeed, inputFeed);

  // Deserialize urls. indexedDB cannot store URL objects, so when loading
  // an object from the store, we have to convert back from strings to urls.
  // This assumes urls are always valid and never throws.
  // This assumes the urls are unique and properly ordered.
  if(inputFeed.urls && inputFeed.urls.length) {
    outputFeed.urls = inputFeed.urls.map(function(urlString) {
      return new URL(urlString);
    });
  }

  if(inputFeed.link) {
    outputFeed.link = new URL(inputFeed.link);
  }

  return outputFeed;
}
