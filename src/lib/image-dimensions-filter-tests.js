import {assert} from '/src/lib/assert.js';
import * as html_utils from '/src/lib/html-utils.js';
import {image_dimensions_filter} from '/src/lib/image-dimensions-filter.js';

// Exercise the ordinary case of a basic html document with an image with
// unknown attributes
export async function image_size_filter_test() {
  const input = '<img src="/src/lib/basic-image.png">';
  const doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  const image = doc.querySelector('img');
  assert(image.width === 16);
  assert(image.height === 12);
}

// Assert that fetching an image that does not exist skips over the image
export async function image_size_filter_404_test() {
  let input = '<img src="i-am-a-missing-image-example.gif">';
  let doc = html_utils.parse_html(input);
  // This should not throw
  await image_dimensions_filter(doc);
  // The properties for the image should not be initialized.
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}

// Exercise running the function on a document without any images.
export async function image_size_filter_text_only_test() {
  let input = 'no images here';
  let doc = html_utils.parse_html(input);
  // should not throw
  await image_dimensions_filter(doc);
}

export async function image_size_filter_sourceless_test() {
  let input = '<img title="missing src">';
  let doc = html_utils.parse_html(input);
  // This should not throw
  await image_dimensions_filter(doc);
  // Properties should not be initialized
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}
