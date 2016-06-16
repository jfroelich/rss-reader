// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Applies a set of rules to a url object and returns a modified url object
// Currently this only modifies Google News urls, but I plan to include more
// TODO: research how to bypass feedproxy given the feedburner changes. Google
// reader was deprecated. Several sites only support feed access via feed
// burner. Feed burner rewrites all urls to filter through feed burner for I
// guess purposes of link tracking. Figure out how to get past the rewrite.
// Maybe it involves an async process, maybe it requires traversing a chain of
// redirects and therefore this whole rewrite process should be more abstract?
// Actually the redirects are handled by polling, so that solves part of that
// issue i think

// TODO: previously this expected a url string, now it expects a URL object,
// I should make sure all callers use a URL object. I searched and somehow
// could not find any callers

function rewriteURL(inputURL) {


  // A temporary guard while I am doing massive refactoring
  if(!inputURL ||
    Object.prototype.toString.call(inputURL) !== '[object URL]') {
    return inputURL;
  }

  let outputURL = new URL(inputURL.href);


  // TODO: instead of a regular expression I could consider using the new
  // URL api to access and test against components of the URL

  const GOOGLE_NEWS = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(inputURL.href);
  if(matches && matches.length === 2 && matches[1]) {
    const param = decodeURIComponent(matches[1]);
    try {
      outputURL = new URL(param);

      // Temp, debugging
      console.debug('Rewriting %s as %s', inputURL.href, outputURL.href);

    } catch(exception) {
      console.debug(exception);
    }
  }

  return outputURL;
}
