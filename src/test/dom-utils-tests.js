import assert from '/src/assert.js';
import * as dom_utils from '/src/dom-utils.js';
import * as utils from '/src/utils.js';

export async function coerce_element_test() {
  const input = '<html><head></head><body><p></p><a></a></body></html>';
  const doc = utils.parse_html(input);

  // Replace the as with bs
  const anchors = doc.querySelectorAll('a');
  for (const a of anchors) {
    dom_utils.coerce_element(a, 'b', true);
  }

  // Assert that a was replaced with b and that no extra junk was inserted
  let expected = '<html><head></head><body><p></p><b></b></body></html>';
  assert(doc.documentElement.outerHTML === expected);

  // Now replace the bs with cs. Assert that a second call does not somehow
  // work unexpectedly due to side effects. Basically assert there are no
  // consequential side effects. In addition, test that coerce works with
  // fictional elements, as c is not a standard element.
  const bolds = doc.querySelectorAll('b');
  for (const b of bolds) {
    dom_utils.coerce_element(b, 'c', true);
  }
  expected = '<html><head></head><body><p></p><c></c></body></html>';
  assert(doc.documentElement.outerHTML === expected);

  // TODO: assert that p still exists to test that coerce does not affect
  // elements it shouldn't affect (surprise side effects)

  // TODO: test that child nodes remain in the expected place, including both
  // elements and text nodes (surprises side effects)

  // TODO: test error cases? what errors? invalid input?
}

export async function base_uri_test() {
  // If a document has no base elements, and overwrite is true, then this should
  // add a base element and that should become the baseURI value, and there
  // should only be one base element
  let title = 'no existing base and overwrite';
  let doc = document.implementation.createHTMLDocument(title);
  let url = new URL('http://www.example.com');
  dom_utils.set_base_uri(doc, url, true);
  assert(doc.baseURI === url.href);
  assert(doc.querySelectorAll('base').length === 1);

  // if a document has no base elements, and overwrite is false, then this
  // should add a base element and that should become the baseURI value
  title = 'no existing base and not overwrite';
  doc = document.implementation.createHTMLDocument(title);
  url = new URL('http://www.example.com');
  dom_utils.set_base_uri(doc, url, false);
  assert(doc.baseURI === url.href);
  assert(doc.getElementsByTagName('base').length === 1);

  // If a document has a base element, and that base element has a canonical
  // href value, and overwrite is false then this should be a no-op.
  title = 'existing base with canonical href';
  doc = document.implementation.createHTMLDocument(title);
  let base = doc.createElement('base');
  base.setAttribute('href', 'http://www.example1.com/');
  doc.head.appendChild(base);
  assert(doc.baseURI === 'http://www.example1.com/');
  url = new URL('http://www.example2.com');
  dom_utils.set_base_uri(doc, url, false);
  // After the change, is the document in the expected state
  assert(doc.baseURI === 'http://www.example1.com/');
  assert(doc.getElementsByTagName('base').length === 1);

  // If a document has a base element, and that base element has an href value
  // that is not canonical, then this should resolve the href value to the
  // url, and replace the href value, and cause the baseURI to be the
  // canonical resolved value.
  title = 'existing base with non-canonical href';
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '/path');
  doc.head.appendChild(base);
  // Before the change, baseURI is the result of resolving the relative url to
  // the extension's base url (because that is the 'page' executing the script
  // that created the document without a base element).
  url = new URL('http://www.example.com');
  dom_utils.set_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example.com/path');

  // If a document has a base element, and that base element has an href value
  // that is not canonical, and that relative url has invalid syntax, then this
  // should still resolve the url as before, but the invalid portion will get
  // trimmed and url encoded as a path within the new base url
  // NOTE: this actually is not desired behavior, but it is expected behavior
  // in the current implementation
  title = 'existing base with non-canonical invalid href';
  doc = document.implementation.createHTMLDocument(title);
  base = doc.createElement('base');
  base.setAttribute('href', '  \t\r\n   foo  bar     ');
  doc.head.appendChild(base);
  url = new URL('http://www.example.com');
  dom_utils.set_base_uri(doc, url);
  assert(doc.baseURI === 'http://www.example.com/foo%20%20bar');
}

export async function unwrap_element_test() {
  // Assert the typical case of a simple straightforward unwrap call completes
  // as expected
  let doc = utils.parse_html(
      '<html><head></head><body><div>hello</div></body></html>');
  let element = doc.querySelector('div');
  dom_utils.unwrap_element(element);
  let expected_state = '<html><head></head><body>hello</body></html>';
  let after_state = doc.documentElement.outerHTML;
  assert(after_state === expected_state);

  // Assert that calling unwrap on something other than an element throws an
  // exception
  let unwrap_null_error;
  try {
    dom_utils.unwrap_element(null, false);
  } catch (error) {
    unwrap_null_error = error;
  }
  assert(unwrap_null_error);

  // Assert that unwrapping an element that has no parent node does not trigger
  // an exception and leaves the document in its expected state (untouched)
  doc = utils.parse_html(
      '<html><head></head><body><div>hello</div></body></html>');
  element = doc.querySelector('div');
  element.remove();
  let before_state = doc.documentElement.outerHTML;
  let nag = false;  // disable the orphan warning
  dom_utils.unwrap_element(element, nag);
  after_state = doc.documentElement.outerHTML;
  assert(before_state === after_state);

  // Assert that no space is added when the node is not adjacent to text nodes
  doc = utils.parse_html(
      '<html><head></head><body><p>before</p>' +
      '<a>hello</a><p>after</p></body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body><p>before</p>hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is preceding text and not subsequent text, that only
  // left space is added.
  doc = utils.parse_html(
      '<html><head></head><body>before<a>hello</a><p>after</p></body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body>before hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is no preceding text and there is subsequent text,
  // that only right space is added
  doc = utils.parse_html(
      '<html><head></head><body><p>before</p><a>hello</a>after</body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body><p>before</p>hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that where there is both preceding text and subsequent text, that
  // both left and right space are added
  doc = utils.parse_html(
      '<html><head></head><body>before<a>hello</a>after</body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that when there is nothing (neither text nodes or other nodes)
  // within the element being unwrapped, and there are adjacent text nodes on
  // both sides, that one space is added between the nodes to prevent merging.
  doc = utils.parse_html(
      '<html><head></head><body>before<a></a>after</body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before after</body></html>';
  assert(after_state === expected_state);

  // Test a case to think more about. This works but I am not sure this is
  // the desired behavior.
  doc = utils.parse_html(
      '<html><head></head><body>before<a><b>hello</b></a>after</body></html>');
  element = doc.querySelector('a');
  dom_utils.unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body>before<b>hello</b>after</body></html>';
  assert(after_state === expected_state);
}
