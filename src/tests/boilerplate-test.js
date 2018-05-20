import * as filters from '/src/content-filters/content-filters.js';
import {fetch_html} from '/src/fetch.js';
import * as boilerplate from '/src/lib/boilerplate.js';
import {deframe} from '/src/lib/filters/deframe.js';
import {filter_blacklisted_elements} from '/src/lib/filters/filter-blacklisted-elements.js';
import {filter_iframes} from '/src/lib/filters/filter-iframes.js';
import {filter_script_elements} from '/src/lib/filters/filter-script-elements.js';
import {resolve_document_urls} from '/src/lib/filters/resolve-document-urls.js';
import * as html_parser from '/src/lib/html-parser.js';
import {assert} from '/src/tests/assert.js';

// TODO: assert stuff, use a known test url
// TODO: load a local test file. Or don't even load, just build one in memory
// TODO: create a helper like build-test-document or something that abstracts
// away how the document is made
// TODO: remove some of the paranoid stuff about frames and such because this
// will use a local test file where that is not an issue, because this test is
// not concerned with those things

export async function boilerplate_test() {
  console.warn('boilerplate-test not implemented');
}

export async function legacy_boilerplate_test(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_url = new URL(response.url);
  const response_text = await response.text();
  const document = html_parser.parse(response_text);

  deframe(document);
  filter_script_elements(document);
  filter_iframes(document);
  filter_blacklisted_elements(document);
  resolve_document_urls(document, response_url);

  await filters.document_set_image_sizes(document, response_url);
  boilerplate.annotate(document);
}
