// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Given a serialized input feed, generates a new deserialized output Feed
function deserialize_feed(input_feed) {
  const output_feed = new Feed();
  Object.assign(output_feed, input_feed);

  // Deserialize urls. indexedDB cannot store URL objects, so when loading
  // an object from the store, we have to convert back from strings to urls.
  // This assumes urls are always valid and never throws.
  // This assumes the urls are unique and properly ordered.
  if(input_feed.urls && input_feed.urls.length) {
    output_feed.urls = input_feed.urls.map(function(urlString) {
      return new URL(urlString);
    });
  }

  if(input_feed.link) {
    output_feed.link = new URL(input_feed.link);
  }

  return output_feed;
}
