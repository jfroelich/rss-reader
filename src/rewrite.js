// See license.md

'use strict';

// Applies a set of rules to a url object and returns a modified url object
function rewrite_url(input_url_obj) {
  // Rewrite Google News links
  if(input_url_obj.hostname === 'news.google.com' &&
    input_url_obj.pathname === '/news/url') {
    const param = input_url_obj.searchParams.get('url');
    if(param) {
      try {
        return new URL(param);
      } catch(error) {
        console.warn(error);
      }
    }
  } else if(input_url_obj.hostname === 'techcrunch.com') {
    if(input_url_obj.searchParams.has('ncid')) {
      const output_url = new URL(input_url_obj.href);
      output_url.searchParams.delete('ncid');
      return output_url;
    }
  }
}
