import * as dom_filters from '/src/core/dom-filters.js';
import * as dom_utils from '/src/core/dom-utils.js';
import * as net from '/src/core/net.js';
import {assert} from '/src/lib/assert.js';
import * as color from '/src/lib/color.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import * as html_utils from '/src/lib/html-utils.js';

// Check that the anchor-script-filter removes the anchors that should be
// removed and retains the anchors that should be retained.
export async function anchor_script_filter_test() {
  let input, doc;

  // A non-href non-javascript anchor should not be affected
  input = '<a>test</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // An anchor with a relative href without a javascript protocol should not
  // be affected
  input = '<a href="foo.html">foo</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // An anchor with an absolute href without a javascript protocol should not
  // be affected
  input = '<a href="http://www.example.com/foo.html">foo</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // A well-formed javascript anchor should be removed
  input = '<a href="javascript:console.log(\'im in ur base\')">hax</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(!doc.querySelector('a'));

  // A well-formed javascript anchor with leading space should still be removed,
  // because the spec says browsers should tolerate leading and trailing space
  input = '<a href=" javascript:console.log(\'im in ur base\')">hax</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(!doc.querySelector('a'));

  // A malformed javascript anchor with space before colon should be unaffected
  // NOTE: browser will treat this as a relative url, the spaces through the
  // entire href value will each get encoded as %20, the anchor's protocol will
  // still match the base uri protocol after the filter.
  input = '<a href="javascript  :console.log(\'im in ur base\')">hax</a>';
  doc = html_utils.parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));
}

export async function attribute_empty_filter_test() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = html_utils.parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Body element with attribute
  input = '<html><head></head><body foo="">test</body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body foo="">test</body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input =
      '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input =
      '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  doc = html_utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}

export async function color_contrast_filter_basic_test() {
  // TODO: implement
}

export async function image_lazy_filter_test() {
  // TODO: rewrite without input, load a local file internally
  // TODO: explicitly use fetch policy permit_all

  // let url_string;
  // const request_url = new URL(url_string);
  // const response = await net.fetch_html(request_url);
  // const response_text = await response.text();
  // const document = html_utils.parse_html(response_text);
  // dom_filters.image_lazy_filter(document);
  // Call this subsequently because it prints out missing images
  // dom_filters.image_dead_filter(document);
}

export async function image_reachable_filter_test() {
  const doc = await load_file('image-reachable-filter-test.html', false);
  const allow_all_requests = request => true;
  let image;

  // Before applying the filter, ensure as a precondition that the test file
  // is setup correctly (that images exist)
  assert(doc.querySelector('#unreachable'));
  assert(doc.querySelector('.reachable'));

  await dom_filters.image_reachable_filter(doc, INDEFINITE, allow_all_requests);

  // The filter should have removed this image.
  image = doc.querySelector('#unreachable');
  assert(!image);

  // The fhilter should have retained this image, and further modified it.
  image = doc.querySelector('.reachable');
  assert(image);
  assert(image.hasAttribute('data-reachable-width'));
  assert(image.hasAttribute('data-reachable-height'));
}

// Assert the ordinary case of a basic html document with an image with unknown
// attributes
export async function image_size_filter_test() {
  const doc = await load_file('image-size-filter-basic.html');
  await run_image_size_filter(doc);
  const image = doc.querySelector('img');
  assert(image.width === 16);
  assert(image.height === 12);
}

// Assert that fetching an image that does not exist skips over the image
export async function image_size_filter_404_test() {
  const doc = await load_file('image-size-filter-404.html');
  // This should not throw even though the image specified in the html is
  // missing
  await run_image_size_filter(doc);
  // Because the image does not have express attributes, and because this is an
  // inert file where images are not eagerly loaded by Chrome on document load,
  // the properties for the image should not be initialized.
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}

// Exercise running the function on a document without any images.
export async function image_size_filter_text_only_test() {
  const doc = await load_file('image-size-filter-text-only.html');
  await run_image_size_filter(doc);
}

// Test that an image devoid of source information does not cause an error, and
// does not somehow init properties.
export async function image_size_filter_sourceless_test() {
  const doc = await load_file('image-size-filter-sourceless.html');
  await run_image_size_filter(doc);
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}

function run_image_size_filter(doc) {
  return dom_filters.image_size_filter(doc, undefined, request => true);
}

// Fetch, parse, and prepare a local url
async function load_file(filename, set_base_uri_flag = true) {
  const base_path = '/test/';
  const url_string = chrome.extension.getURL(base_path + filename);
  const response = await fetch(url_string);
  const text = await response.text();
  const doc = html_utils.parse_html(text);

  if (set_base_uri_flag) {
    const base_url_string = chrome.extension.getURL(base_path);
    const base_url = new URL(base_url_string);
    dom_utils.set_base_uri(doc, base_url);
  }

  return doc;
}
