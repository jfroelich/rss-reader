import * as filters from '/src/content-filters/content-filters.js';
import * as html_parser from '/src/lib/html-parser/html-parser.js';
// TODO: this cannot depend on something in operations
import {rdr_fetch_html} from '/src/operations/rdr-fetch-html.js';

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await rdr_fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  const document = html_parser.parse(response_text);
  filters.filter_lazy_images(document);

  // Call this subsequently because it prints out missing images
  // filters.filter_sourceless_images(document);
};
