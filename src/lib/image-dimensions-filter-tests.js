import {assert} from '/src/lib/assert.js';
import * as html_utils from '/src/lib/html-utils.js';
import {image_dimensions_filter} from '/src/lib/image-dimensions-filter.js';

export async function css_offset_props_test() {
  let input, doc, image;
  input = '<img style="width: 1px; height: 1px;">';
  doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  image = doc.querySelector('img');

  // It is very poorly documented, but there are in fact different behaviors
  // regarding the DOM based on whether a document is "live". In fact, without
  // any explicit property anywhere in the API, a document is privately flagged
  // as either live or inert. For example of a difference, some properties
  // produce uninitialized values in an inert document.

  // An inert document is created in the routine operation of an app that does
  // dom processing. Specifically, there are two common methods by which to
  // create an inert document:
  // 1) via window.implementation
  // 2) via XMLHttpRequest

  // Confirm that in the context of an inert document, offset width and height
  // are undefined. Therefore, any suggestion of using them is misguided and
  // uninformed. This is also why the jquery approach fails on inert docs.
  assert(image.offsetWidth === 0);
  assert(image.offsetHeight === 0);

  // These are also unavailable
  assert(image.naturalWidth === 0);
  assert(image.naturalHeight === 0);

  // However, some properties may be initialized, such as width and height
  // based on the css (even in the absence of attributes).
  assert(image.width === 1);
  assert(image.height === 1);

  // Test when specified only via style element, not style attribute
  input = '<html><head><style>img{ width: 1px; height: 1px; }</style></head>' +
      '<body><img></body></html>';
  doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);

  // getComputedStyle apparently is not available to us, I guess.
  // https://github.com/w3c/csswg-drafts/issues/1548

  /*
    let typed_style = image.attributeStyleMap;
    for (let x of typed_style) {
      console.debug(x);
    }
  */
}

export async function image_dimensions_filter_css_test() {
  let input, doc, image;

  input = '<img style="width: 1px; height: 1px;">';
  doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  image = doc.querySelector('img');
  console.debug(image.outerHTML);

  input = '<img style="width: 100%; height: 100%;">';
  doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  image = doc.querySelector('img');
  console.debug(image.outerHTML);
}

// Exercise the ordinary case of a basic html document with an image with
// unknown attributes
export async function image_dimensions_filter_test() {
  const input = '<img src="/src/lib/basic-image.png">';
  const doc = html_utils.parse_html(input);
  await image_dimensions_filter(doc);
  const image = doc.querySelector('img');
  assert(image.width === 16);
  assert(image.height === 12);
}

// Assert that fetching an image that does not exist skips over the image
export async function image_dimensions_filter_404_test() {
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
export async function image_dimensions_filter_text_only_test() {
  let input = 'no images here';
  let doc = html_utils.parse_html(input);
  // should not throw
  await image_dimensions_filter(doc);
}

export async function image_dimensions_filter_sourceless_test() {
  let input = '<img title="missing src">';
  let doc = html_utils.parse_html(input);
  // This should not throw
  await image_dimensions_filter(doc);
  // Properties should not be initialized
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}
