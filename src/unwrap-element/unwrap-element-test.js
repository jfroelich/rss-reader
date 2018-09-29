import assert from '/src/assert/assert.js';
import {parse_html} from '/src/html/html.js';
import {unwrap_element} from '/src/unwrap-element/unwrap-element.js';
import {register_test} from '/src/test/test-registry.js';

export function unwrap_element_test() {
  // Assert the typical case of a simple straightforward unwrap call completes
  // as expected
  let doc =
      parse_html('<html><head></head><body><div>hello</div></body></html>');
  let element = doc.querySelector('div');
  unwrap_element(element);
  let expected_state = '<html><head></head><body>hello</body></html>';
  let after_state = doc.documentElement.outerHTML;
  assert(after_state === expected_state);

  // Assert that calling unwrap on something other than an element throws an
  // exception
  let unwrap_null_error;
  try {
    unwrap_element(null, false);
  } catch (error) {
    unwrap_null_error = error;
  }
  assert(unwrap_null_error);

  // Assert that unwrapping an element that has no parent node does not trigger
  // an exception and leaves the document in its expected state (untouched)
  doc = parse_html('<html><head></head><body><div>hello</div></body></html>');
  element = doc.querySelector('div');
  element.remove();
  let before_state = doc.documentElement.outerHTML;
  let nag = false;  // disable the orphan warning
  unwrap_element(element, nag);
  after_state = doc.documentElement.outerHTML;
  assert(before_state === after_state);

  // Assert that no space is added when the node is not adjacent to text nodes
  doc = parse_html(
      '<html><head></head><body><p>before</p>' +
      '<a>hello</a><p>after</p></body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body><p>before</p>hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is preceding text and not subsequent text, that only
  // left space is added.
  doc = parse_html(
      '<html><head></head><body>before<a>hello</a><p>after</p></body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body>before hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is no preceding text and there is subsequent text,
  // that only right space is added
  doc = parse_html(
      '<html><head></head><body><p>before</p><a>hello</a>after</body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body><p>before</p>hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that where there is both preceding text and subsequent text, that
  // both left and right space are added
  doc = parse_html(
      '<html><head></head><body>before<a>hello</a>after</body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that when there is nothing (neither text nodes or other nodes)
  // within the element being unwrapped, and there are adjacent text nodes on
  // both sides, that one space is added between the nodes to prevent merging.
  doc = parse_html('<html><head></head><body>before<a></a>after</body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before after</body></html>';
  assert(after_state === expected_state);

  // Test a case to think more about. This works but I am not sure this is
  // the desired behavior.
  doc = parse_html(
      '<html><head></head><body>before<a><b>hello</b></a>after</body></html>');
  element = doc.querySelector('a');
  unwrap_element(element);
  after_state = doc.documentElement.outerHTML;
  expected_state =
      '<html><head></head><body>before<b>hello</b>after</body></html>';
  assert(after_state === expected_state);
}

register_test(unwrap_element_test);
