// See license.md

'use strict';

// Applies a set of rules to a url object and returns a modified url object
function rewrite_url(input_url_obj) {
  // Rewrite Google News links
  if(input_url_obj.hostname === 'news.google.com' &&
    input_url_obj.pathname === '/news/url') {
    // NOTE: searchParams.get implicitly decodes
    const param = input_url_obj.searchParams.get('url');
    if(param) {
      try {
        const output_url_obj = new URL(param);
        return output_url_obj;
      } catch(error) {
        console.warn(error);
      }
    }
  }
}
