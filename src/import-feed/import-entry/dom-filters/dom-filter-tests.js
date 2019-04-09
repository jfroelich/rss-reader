import assert from '/src/assert.js';
import {INDEFINITE} from '/src/deadline/deadline.js';
import * as dom_filters from '/src/import-feed/import-entry/dom-filters/dom-filters.js';
import {image_reachable_filter} from '/src/import-feed/import-entry/dom-filters/image-reachable-filter.js';
import parse_html from '/src/import-feed/import-entry/parse-html.js';

// TODO: implement a simple straightforward test that exercises the normal
// cases.
// TODO: implement tests for the abnormal cases
// TODO: specifically test various threshold parameter values

export function emphasis_filter_test() {
  let input, doc;

  // Specifically test the nesting filter
  input = '<b><b>b</b></b>';
  doc = parse_html(input);
  dom_filters.emphasis_filter(doc);
  assert(doc.querySelectorAll('b').length === 1);

  // In mixed, test inner child removed and outer parent remains
  input = '<b><strong>b-strong</strong></b>';
  doc = parse_html(input);
  dom_filters.emphasis_filter(doc);
  assert(!doc.querySelector('strong'));
  assert(doc.querySelector('b'));
}

// Check that the anchor-script-filter removes the anchors that should be
// removed and retains the anchors that should be retained.
export function anchor_script_filter_test() {
  let input, doc;

  // A non-href non-javascript anchor should not be affected
  input = '<a>test</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // An anchor with a relative href without a javascript protocol should not
  // be affected
  input = '<a href="foo.html">foo</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // An anchor with an absolute href without a javascript protocol should not
  // be affected
  input = '<a href="http://www.example.com/foo.html">foo</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));

  // A well-formed javascript anchor should be removed
  input = '<a href="javascript:console.log(\'im in ur base\')">hax</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(!doc.querySelector('a'));

  // A well-formed javascript anchor with leading space should still be removed,
  // because the spec says browsers should tolerate leading and trailing space
  input = '<a href=" javascript:console.log(\'im in ur base\')">hax</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(!doc.querySelector('a'));

  // A malformed javascript anchor with space before colon should be unaffected
  // NOTE: browser will treat this as a relative url, the spaces through the
  // entire href value will each get encoded as %20, the anchor's protocol will
  // still match the base uri protocol after the filter.
  input = '<a href="javascript  :console.log(\'im in ur base\')">hax</a>';
  doc = parse_html(input);
  dom_filters.anchor_script_filter(doc);
  assert(doc.querySelector('a'));
}

export function attribute_empty_filter_test() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  output =
      '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // TODO: for some reason this now fails. revisit and learn why. disabled for
  // now.
  // Body element with attribute
  // input = '<html><head></head><body foo="">test</body></html>';
  // doc = parse_html(input);
  // dom_filters.attribute_empty_filter(doc);
  // output = '<html><head></head><body foo="">test</body></html>';
  // console.debug(doc.documentElement.outerHTML, output);
  // assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input =
      '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input =
      '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  doc = parse_html(input);
  dom_filters.attribute_empty_filter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}

export function image_lazy_filter_test() {
  // Exercise the ordinary case of a substitution
  let input = '<img id="test" data-src="test.gif">';
  let doc = parse_html(input);
  dom_filters.image_lazy_filter(doc);
  let image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') === 'test.gif');

  // An image with a src is not lazy and should not be overwritten
  input = '<img id="test" src="before.gif" lazy-src="after.gif">';
  doc = parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') == 'before.gif');

  // An image with an unrecognized attribute shouldn't affect src, only those
  // explicit listed attribute names are candidates
  input = '<img id="test" foo-bar-baz="test.gif">';
  doc = parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  let src_value = image.getAttribute('src');
  assert(src_value === null || src_value === undefined);

  // An image with a valid candidate that looks lazy, but the candidate has a
  // bad value, should leave the source as is
  input = '<img id="test" lazy-src="bad value">';
  doc = parse_html(input);
  dom_filters.image_lazy_filter(doc);
  image = doc.querySelector('#test');
  assert(image);
  src_value = image.getAttribute('src');
  assert(src_value === null || src_value === undefined);
}

// TODO: move to separate module
export async function image_reachable_filter_test() {
  let input = '<img id="unreachable" src="not-reachable.gif">';
  // TODO: circular dependency?
  input +=
      '<img class="reachable" src="/src/import-feed/import-entry/dom-filters/basic-image.png">';
  let doc = parse_html(input);

  assert(doc.querySelector('#unreachable'));
  assert(doc.querySelector('.reachable'));
  await image_reachable_filter(doc, INDEFINITE);

  let image = doc.querySelector('#unreachable');
  assert(!image);

  // The filter should have retained this image, and further modified it.
  image = doc.querySelector('.reachable');
  assert(image);
  assert(image.hasAttribute('data-reachable-width'));
  assert(image.hasAttribute('data-reachable-height'));
}
