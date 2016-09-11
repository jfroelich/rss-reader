// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Applies a set of rules to a url object and returns a modified url object
// Currently this only modifies Google News urls, but I plan to include more
// If the url was rewritten, then the rewritten url is returned as a URL object.
// If no rewriting occurred, then returns undefined.
// TODO: rewriteURL is the public api, but it should be delegating the one
// rule it applies right now probably to a separate function or something like
// that, so that it becomes easily extensible. Or maybe an array of Rule objects
// or something. Also, I have to consider the behavior when multiple rules match
// the input. Also, I have to consider whether I want to rewrite as a chain,
// where I sequentially apply any rules. Maybe even various url normalizations,
// like removing hash, is just another kind of rule.
function rewriteURL(inputURLObject) {

  // NOTE: searchParams.get implicitly decodes

  // Rewrite Google News links
  if(inputURLObject.hostname === 'news.google.com' &&
    inputURLObject.pathname === '/news/url') {
    const urlParam = inputURLObject.searchParams.get('url');
    if(urlParam) {
      try {
        const outputURLObject = new URL(urlParam);
        // console.debug('Rewrote', inputURLObject.href, 'as',
        //   outputURLObject.href);
        return outputURLObject;
      } catch(error) {
        console.warn(error);
      }
    }
  }
}
