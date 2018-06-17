import {fetch_html} from '/src/net/fetch-html.js';
import {is_allowed_request} from '/src/net/fetch-policy.js';
import {set_document_base_uri} from '/src/dom/set-document-base-uri.js';
import * as boilerplate from '/src/filters/boilerplate.js';
import {canonicalize_urls} from '/src/filters/canonicalize-urls.js';
import {deframe} from '/src/filters/deframe.js';
import {filter_blacklisted_elements} from '/src/filters/filter-blacklisted-elements.js';
import {filter_iframes} from '/src/filters/filter-iframes.js';
import {filter_script_elements} from '/src/filters/filter-script-elements.js';
import {set_image_sizes} from '/src/filters/set-image-sizes.js';
import {parse_html} from '/src/html/parse-html.js';
import {assert} from '/src/test/assert.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: assert stuff, use a known test url
// TODO: build a document in memory and test against it, don't bother with
// fetch at all
// TODO: create a helper like build-test-document or something that abstracts
// away how the document is made
// TODO: remove some of the paranoid stuff about frames and such because this
// will use a local test document where that is not an issue, because this test
// is not concerned with those things

// If I want to review how well this works on real data, I should build the
// appropriate view. Some kind of annotation-viewer.html thing. With a simple
// input that lets me paste in a url and view the result. This doesn't need to
// cli exposed.

async function boilerplate_test() {
  console.warn('boilerplate-test not implemented');
}

async function legacy_boilerplate_test(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  assert(response.ok, 'Failed to fetch ' + request_url.href);

  const response_text = await response.text();
  const document = parse_html(response_text);

  // Filters such as canonicalize_urls and set_image_sizes expect a valid
  // baseURI
  const response_url = new URL(response.url);
  set_document_base_uri(document, response_url);

  deframe(document);
  filter_script_elements(document);
  filter_iframes(document);
  filter_blacklisted_elements(document);
  canonicalize_urls(document);
  await set_image_sizes(document, undefined, is_allowed_request);
  boilerplate.annotate(document);
}

register_test(boilerplate_test);