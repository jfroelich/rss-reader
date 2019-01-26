import assert from '/src/assert.js';
import * as dfu from '/src/dom-filters/dom-utils.js';
import {image_size_filter} from '/src/dom-filters/image-size-filter.js';
import * as utils from '/src/utils.js';

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
  return image_size_filter(doc, undefined, url => true);
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
  dfu.set_base_uri(doc, base_url);
  return doc;
}
