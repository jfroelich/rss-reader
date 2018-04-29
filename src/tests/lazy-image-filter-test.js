import * as filters from '/src/content-filters/content-filters.js';
import * as html_parser from '/src/lib/html-parser.js';
import {fetch_html} from '/src/ops/fetch.js';
import {assert} from '/src/tests/assert.js';

// TODO: rewrite without input, load a local file internally

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  const document = html_parser.parse(response_text);
  filters.filter_lazy_images(document);

  // Call this subsequently because it prints out missing images
  // filters.filter_sourceless_images(document);
};