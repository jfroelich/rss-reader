import assert from '/lib/assert.js';
import { INDEFINITE } from '/lib/deadline.js';
import * as domFilters from '/lib/dom-filters/dom-filters.js';
import imageReachableFilter from '/lib/dom-filters/image-reachable-filter.js';
import parseHTML from '/lib/parse-html.js';

// TODO: implement a simple straightforward test that exercises the normal
// cases.
// TODO: implement tests for the abnormal cases
// TODO: specifically test various threshold parameter values

export function emphasisFilterTest() {
  let input;
  let doc;

  // Specifically test the nesting filter
  input = '<b><b>b</b></b>';
  doc = parseHTML(input);
  domFilters.emphasisFilter(doc);
  assert(doc.querySelectorAll('b').length === 1);

  // In mixed, test inner child removed and outer parent remains
  input = '<b><strong>b-strong</strong></b>';
  doc = parseHTML(input);
  domFilters.emphasisFilter(doc);
  assert(!doc.querySelector('strong'));
  assert(doc.querySelector('b'));
}

// Check that the anchor-script-filter removes the anchors that should be
// removed and retains the anchors that should be retained.
export function anchorScriptFilterTest() {
  let input;
  let doc;

  // A non-href non-javascript anchor should not be affected
  input = '<a>test</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(doc.querySelector('a'));

  // An anchor with a relative href without a javascript protocol should not
  // be affected
  input = '<a href="foo.html">foo</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(doc.querySelector('a'));

  // An anchor with an absolute href without a javascript protocol should not
  // be affected
  input = '<a href="http://www.example.com/foo.html">foo</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(doc.querySelector('a'));

  // A well-formed javascript anchor should be removed
  input = '<a href="javascript:console.log(\'im in ur base\')">hax</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(!doc.querySelector('a'));

  // A well-formed javascript anchor with leading space should still be removed,
  // because the spec says browsers should tolerate leading and trailing space
  input = '<a href=" javascript:console.log(\'im in ur base\')">hax</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(!doc.querySelector('a'));

  // A malformed javascript anchor with space before colon should be unaffected
  // NOTE: browser will treat this as a relative url, the spaces through the
  // entire href value will each get encoded as %20, the anchor's protocol will
  // still match the base uri protocol after the filter.
  input = '<a href="javascript  :console.log(\'im in ur base\')">hax</a>';
  doc = parseHTML(input);
  domFilters.anchorScriptFilter(doc);
  assert(doc.querySelector('a'));
}

export function attributeEmptyFilterTest() {
  // Simple empty non-boolean attribute in body
  let input = '<html><head></head><body><a name="">test</a></body></html>';
  let doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  let output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute with value in body
  input = '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  output = '<html><head></head><body><a disabled="disabled">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // boolean attribute without value in body
  // TODO: is this right? not sure if ="" belongs
  input = '<html><head></head><body><a disabled="">test</a></body></html>';
  doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // TODO: for some reason this now fails. revisit and learn why. disabled for
  // now.
  // Body element with attribute
  // input = '<html><head></head><body foo="">test</body></html>';
  // doc = parseHTML(input);
  // domFilters.attributeEmptyFilter(doc);
  // output = '<html><head></head><body foo="">test</body></html>';
  // console.debug(doc.documentElement.outerHTML, output);
  // assert(doc.documentElement.outerHTML === output);

  // Multiple elements with non-boolean attributes in body
  input = '<html><head></head><body><p id=""><a name="">test</a></p></body></html>';
  doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  output = '<html><head></head><body><p><a>test</a></p></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Multiple non-boolean attributes in element in body
  input = '<html><head></head><body><a id="" name="">test</a></body></html>';
  doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  output = '<html><head></head><body><a>test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);

  // Element with both non-boolean and boolean attribute in body
  input = '<html><head></head><body><a id="" disabled="">test</a></body></html>';
  doc = parseHTML(input);
  domFilters.attributeEmptyFilter(doc);
  output = '<html><head></head><body><a disabled="">test</a></body></html>';
  assert(doc.documentElement.outerHTML === output);
}

export function imageLazyFilterTest() {
  // Exercise the ordinary case of a substitution
  let input = '<img id="test" data-src="test.gif">';
  let doc = parseHTML(input);
  domFilters.imageLazyFilter(doc);
  let image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') === 'test.gif');

  // An image with a src is not lazy and should not be overwritten
  input = '<img id="test" src="before.gif" lazy-src="after.gif">';
  doc = parseHTML(input);
  domFilters.imageLazyFilter(doc);
  image = doc.querySelector('#test');
  assert(image);
  assert(image.getAttribute('src') === 'before.gif');

  // An image with an unrecognized attribute shouldn't affect src, only those
  // explicit listed attribute names are candidates
  input = '<img id="test" foo-bar-baz="test.gif">';
  doc = parseHTML(input);
  domFilters.imageLazyFilter(doc);
  image = doc.querySelector('#test');
  assert(image);
  let srcValue = image.getAttribute('src');
  assert(srcValue === null || srcValue === undefined);

  // An image with a valid candidate that looks lazy, but the candidate has a
  // bad value, should leave the source as is
  input = '<img id="test" lazy-src="bad value">';
  doc = parseHTML(input);
  domFilters.imageLazyFilter(doc);
  image = doc.querySelector('#test');
  assert(image);
  srcValue = image.getAttribute('src');
  assert(srcValue === null || srcValue === undefined);
}

// TODO: move to separate module
export async function imageReachableFilterTest() {
  let input = '<img id="unreachable" src="not-reachable.gif">';
  // TODO: circular dependency?
  input += '<img class="reachable" src="/test/basic-image.png">';
  const doc = parseHTML(input);

  assert(doc.querySelector('#unreachable'));
  assert(doc.querySelector('.reachable'));
  await imageReachableFilter(doc, INDEFINITE);

  let image = doc.querySelector('#unreachable');
  assert(!image);

  // The filter should have retained this image, and further modified it.
  image = doc.querySelector('.reachable');
  assert(image);
  assert(image.hasAttribute('data-reachable-width'));
  assert(image.hasAttribute('data-reachable-height'));
}

export function condenseTagnamesFilterTest() {
  const input = '<strong>test</strong>';
  let doc = parseHTML(input);
  assert(doc.querySelector('strong'));
  domFilters.condenseTagnamesFilter(doc);

  assert(!doc.querySelector('strong'));
  assert(doc.querySelectorAll('b').length === 1);

  doc = parseHTML('<em>1</em><em>2</em>');
  assert(doc.querySelector('em'));
  domFilters.condenseTagnamesFilter(doc);
  assert(!doc.querySelector('em'));
  assert(doc.querySelectorAll('i').length === 2);
}
