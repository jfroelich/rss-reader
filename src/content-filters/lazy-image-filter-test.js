import * as filters from '/src/content-filters/content-filters.js';
import {fetch_html} from '/src/fetch/fetch.js';
import {html_parse} from '/src/html-parser/html-parser.js';

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  const document = html_parse(response_text);
  filters.filter_lazy_images(document);

  // Call this subsequently because it prints out missing images
  // filters.filter_sourceless_images(document);
};
