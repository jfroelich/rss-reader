// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Applies a set of rules to a url object and returns a modified url object
// Currently this only modifies Google News urls, but I plan to include more
// If the url was rewritten, then the rewritten url is returned as a URL object.
// If no rewriting occurred, then returns undefined.
// TODO: rewrite_url is the public api, but it should be delegating the one
// rule it applies right now probably to a separate function or something like
// that, so that it becomes easily extensible. Or maybe an array of Rule objects
// or something. Also, I have to consider the behavior when multiple rules match
// the input. Also, I have to consider whether I want to rewrite as a chain,
// where I sequentially apply any rules. Maybe even various url normalizations,
// like removing hash, is just another kind of rule.
function rewrite_url(input_url) {

  // NOTE: it is not clearly documented, but it looks like
  // URLSearchParams.get implicitly decodes the parameter value, so
  // there is no need to use decodeURIComponent. For example, "%3A" appears
  // as "/".


  // The input parameter should always be defined
  console.assert(input_url);
  // The input parameter should always be a URL-like object.
  // This is relaxed because it is faster than using toString check
  console.assert('href' in input_url);

  // Rewrite Google News links
  if(input_url.hostname === 'news.google.com' &&
    input_url.pathname === '/news/url') {
    const url_param_value = input_url.searchParams.get('url');
    if(url_param_value) {
      try {
        const output_url = new URL(url_param_value);
        // console.debug('Rewrote', input_url.href, 'as', output_url.href);
        return output_url;
      } catch(error) {
        console.warn(error);
      }
    }
  }
}
