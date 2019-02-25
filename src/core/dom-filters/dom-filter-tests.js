import * as dom_filters from '/src/core/dom-filters/dom-filters.js';
import {assert} from '/src/lib/assert.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import * as html_utils from '/src/lib/html-utils.js';

export async function emphasis_filter_test() {
  let input, doc;

  // TODO: implement a simple straightforward test that exercises the normal
  // cases.

  // TODO: implement tests for the abnormal cases

  // Specifically test the nesting filter
  input = '<b><b>b</b></b>';
  doc = html_utils.parse_html(input);
  dom_filters.emphasis_filter(doc);
  assert(doc.querySelectorAll('b').length === 1);

  // In mixed, test inner child removed and outer parent remains
  input = '<b><strong>b-strong</strong></b>';
  doc = html_utils.parse_html(input);
  dom_filters.emphasis_filter(doc);
  assert(!doc.querySelector('strong'));
  assert(doc.querySelector('b'));

  // TODO: specifically test various threshold parameter values
}

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

export async function image_lazy_filter_test() {
  // Exercise the ordinary case of a substitution
  let input = '<img id="test" data-src="test.gif">';
  let doc = html_utils.parse_html(input);
  dom_filters.image_lazy_filter(doc);
  let image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') === 'test.gif');

  // An image with a src is not lazy and should not be overwritten
  input = '<img id="test" src="before.gif" lazy-src="after.gif">';
  doc = html_utils.parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') == 'before.gif');

  // An image with an unrecognized attribute shouldn't affect src, only those
  // explicit listed attribute names are candidates
  input = '<img id="test" foo-bar-baz="test.gif">';
  doc = html_utils.parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  let src_value = image.getAttribute('src');
  assert(src_value === null || src_value === undefined);

  // An image with a valid candidate that looks lazy, but the candidate has a
  // bad value, should leave the source as is
  input = '<img id="test" lazy-src="bad value">';
  doc = html_utils.parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  src_value = image.getAttribute('src');
  assert(src_value === null || src_value === undefined);
}

export async function image_reachable_filter_test() {
  let input = '<img id="unreachable" src="not-reachable.gif">';
  input += '<img class="reachable" src="/src/core/dom-filters/';
  input += 'basic-image.png">';
  let doc = html_utils.parse_html(input);

  assert(doc.querySelector('#unreachable'));
  assert(doc.querySelector('.reachable'));
  await dom_filters.image_reachable_filter(doc, INDEFINITE);

  let image = doc.querySelector('#unreachable');
  assert(!image);

  // The filter should have retained this image, and further modified it.
  image = doc.querySelector('.reachable');
  assert(image);
  assert(image.hasAttribute('data-reachable-width'));
  assert(image.hasAttribute('data-reachable-height'));
}

// Assert the ordinary case of a basic html document with an image with unknown
// attributes
export async function image_size_filter_test() {
  let input = '<img src="/src/core/dom-filters/basic-image.png">';
  let doc = html_utils.parse_html(input);
  await dom_filters.image_size_filter(doc);
  const image = doc.querySelector('img');
  assert(image.width === 16);
  assert(image.height === 12);
}

// Assert that fetching an image that does not exist skips over the image
export async function image_size_filter_404_test() {
  let input = '<img src="i-am-a-missing-image-example.gif">';
  let doc = html_utils.parse_html(input);
  // This should not throw
  await dom_filters.image_size_filter(doc);
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
  await dom_filters.image_size_filter(doc);
}

export async function image_size_filter_sourceless_test() {
  let input = '<img title="missing src">';
  let doc = html_utils.parse_html(input);
  // This should not throw
  await dom_filters.image_size_filter(doc);
  // Properties should not be initialized
  const image = doc.querySelector('img');
  assert(image.width === 0);
  assert(image.height === 0);
}
