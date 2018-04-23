import * as filters from '/src/content-filters/content-filters.js';
import * as boilerplate from '/src/lib/boilerplate.js';
import * as html_parser from '/src/lib/html-parser.js';
import {fetch_html} from '/src/ops/fetch-html.js';
import {assert} from '/src/tests/assert.js';

// TODO: assert stuff, use a known test url
// TODO: load a local test file
// TODO: remove some of the paranoid stuff about frames and such because this
// will use a local test file where that is not an issue, because this test is
// not concerned with those things

export async function boilerplate_test() {
  // for now just exit early
  if (true) {
    return;
  }

  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_url = new URL(response.url);
  const response_text = await response.text();
  const document = html_parser.parse(response_text);

  filters.filter_frame_elements(document);
  filters.filter_iframe_elements(document);
  filters.filter_script_elements(document);
  filters.filter_blacklisted_elements(document);
  filters.cf_resolve_document_urls(document, response_url);
  await filters.document_set_image_sizes(document, response_url);
  boilerplate.annotate(document);
}
