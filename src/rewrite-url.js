// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Applies a set of rules to a url object and returns a modified url object
// Currently this only modifies Google News urls, but I plan to include more
// TODO: instead of a regular expression I could consider using the new
// URL api to access and test against components of the URL
function rewrite_url(input_url) {
  console.assert(input_url);

  let output_url = new URL(input_url.href);
  const GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(input_url.href);
  if(matches && matches.length === 2 && matches[1]) {
    const param = decodeURIComponent(matches[1]);
    try {
      output_url = new URL(param);
      // console.debug('Rewrote', input_url.href, 'as', output_url.href);
    } catch(exception) {
      console.warn('Error rewriting url', exception);
    }
  }

  return output_url;
}
