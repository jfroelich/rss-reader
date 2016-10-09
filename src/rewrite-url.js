// See license.md

'use strict';

var rdr = rdr || {};

// Applies a set of rules to a url object and returns a modified url object
rdr.rewriteURL = function(inputURLObject) {
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
};
