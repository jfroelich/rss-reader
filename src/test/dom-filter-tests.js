import {assert} from '/src/assert.js';
import * as color from '/src/color.js';
import * as dom_filters from '/src/dom-filters.js';
import * as dom_utils from '/src/dom-utils.js';
import * as net from '/src/net.js';
import * as utils from '/src/utils.js';


export async function attribute_empty_filter_test() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = utils.parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Body element with attribute
  input = '<html><head></head><body foo="">test</body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body foo="">test</body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input =
      '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input =
      '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  doc = utils.parse_html(input);
  attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}

export async function color_contrast_filter_basic_test() {
  // TODO: implement
}

export async function image_lazy_filter_test() {
  // TODO: rewrite without input, load a local file internally
  // TODO: explicitly use fetch policy PERMITTED

  // let url_string;
  // const request_url = new URL(url_string);
  // const response = await net.fetch_html(request_url);
  // const response_text = await response.text();
  // const document = utils.parse_html(response_text);
  // dom_filters.image_lazy_filter(document);
  // Call this subsequently because it prints out missing images
  // dom_filters.image_dead_filter(document);
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
  return dom_filters.image_size_filter(doc, undefined, url => true);
}

// Fetch, parse, and prepare a local url
async function load_file(filename) {
  const base_path = '/src/test/';
  const url_string = chrome.extension.getURL(base_path + filename);
  const response = await fetch(url_string);
  const text = await response.text();
  const doc = utils.parse_html(text);
  const base_url_string = chrome.extension.getURL(base_path);
  const base_url = new URL(base_url_string);
  dom_utils.set_base_uri(doc, base_url);
  return doc;
}
