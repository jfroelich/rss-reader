// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class URLRewritingService {

  // Applies a set of rules to a url object and returns a modified url object
  // Currently this only modifies Google News urls, but I plan to include more
  // TODO: instead of a regular expression I could consider using the new
  // URL api to access and test against components of the URL
  rewriteURL(inputURL) {
    let outputURL = new URL(inputURL.href);
    const GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
    const matches = GOOGLE_NEWS.exec(inputURL.href);
    if(matches && matches.length === 2 && matches[1]) {
      const param = decodeURIComponent(matches[1]);
      try {
        outputURL = new URL(param);
        console.debug('Rewrote url', inputURL.href, outputURL.href);
      } catch(exception) {
        console.warn('Error rewriting url', exception);
      }
    }

    return outputURL;
  }
}
