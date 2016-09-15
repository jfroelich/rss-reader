// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Applies a set of rules to a url object and returns a modified url object
function rewriteURL(inputURLObject) {
  // Rewrite Google News links
  if(inputURLObject.hostname === 'news.google.com' &&
    inputURLObject.pathname === '/news/url') {
    // NOTE: searchParams.get implicitly decodes
    const urlParam = inputURLObject.searchParams.get('url');
    if(urlParam) {
      try {
        const outputURLObject = new URL(urlParam);
        return outputURLObject;
      } catch(error) {
        console.warn(error);
      }
    }
  }
}
