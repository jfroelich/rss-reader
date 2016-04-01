// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Applies a set of rules to a url string and returns a modified url string
// Currently this only modifies Google News urls, but I may want to include
// others
// TODO: research how to bypass feedproxy given the feedburner changes. Google
// reader was deprecated. Several sites only support feed access via feed burner
// Feed burner rewrites all urls to filter through feed burner for I guess
// purposes of link tracking. Figure out how to get past the rewrite. Maybe
// it involves an async process, maybe it requires traversing a chain of
// redirects and therefore the whole process should be more abstract
function rewrite_url(url) {
  'use strict';
  const GOOGLE_NEWS =
    /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  const matches = GOOGLE_NEWS.exec(url);
  if(matches && matches.length === 2 && matches[1]) {
    return decodeURIComponent(matches[1]);
  }
  return url;
}
