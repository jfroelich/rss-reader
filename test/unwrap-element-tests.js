import assert from '/lib/assert.js';
import parseHTML from '/lib/parse-html.js';
import unwrapElement from '/lib/unwrap-element.js';

export function unwrap_element_test() {
  // Assert the typical case of a simple straightforward unwrap call completes
  // as expected
  let doc = parseHTML('<html><head></head><body><div>hello</div></body></html>');
  let element = doc.querySelector('div');
  unwrapElement(element);
  let expected_state = '<html><head></head><body>hello</body></html>';
  let after_state = doc.documentElement.outerHTML;
  assert(after_state === expected_state);

  // Assert that calling unwrap on something other than an element throws an
  // exception
  let unwrap_null_error;
  try {
    unwrapElement(null, false);
  } catch (error) {
    unwrap_null_error = error;
  }
  assert(unwrap_null_error);

  // Assert that unwrapping an element that has no parent node does not trigger
  // an exception and leaves the document in its expected state (untouched)
  doc = parseHTML('<html><head></head><body><div>hello</div></body></html>');
  element = doc.querySelector('div');
  element.remove();
  const before_state = doc.documentElement.outerHTML;
  const nag = false; // disable the orphan warning
  unwrapElement(element, nag);
  after_state = doc.documentElement.outerHTML;
  assert(before_state === after_state);

  // Assert that no space is added when the node is not adjacent to text nodes
  doc = parseHTML(
    '<html><head></head><body><p>before</p>'
      + '<a>hello</a><p>after</p></body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body><p>before</p>hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is preceding text and not subsequent text, that only
  // left space is added.
  doc = parseHTML(
    '<html><head></head><body>before<a>hello</a><p>after</p></body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before hello<p>after</p></body></html>';
  assert(after_state === expected_state);

  // Assert that when there is no preceding text and there is subsequent text,
  // that only right space is added
  doc = parseHTML(
    '<html><head></head><body><p>before</p><a>hello</a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body><p>before</p>hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that where there is both preceding text and subsequent text, that
  // both left and right space are added
  doc = parseHTML(
    '<html><head></head><body>before<a>hello</a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before hello after</body></html>';
  assert(after_state === expected_state);

  // Assert that when there is nothing (neither text nodes or other nodes)
  // within the element being unwrapped, and there are adjacent text nodes on
  // both sides, that one space is added between the nodes to prevent merging.
  doc = parseHTML('<html><head></head><body>before<a></a>after</body></html>');
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before after</body></html>';
  assert(after_state === expected_state);

  // Test a case to think more about. This works but I am not sure this is
  // the desired behavior.
  doc = parseHTML(
    '<html><head></head><body>before<a><b>hello</b></a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  after_state = doc.documentElement.outerHTML;
  expected_state = '<html><head></head><body>before<b>hello</b>after</body></html>';
  assert(after_state === expected_state);
}

export function unwrap_element_list_test() {
  let doc = parseHTML('<html><body>1<ul><li>2</li><li>3</li></ul>4<body></html>');
  let element = doc.querySelector('ul');
  unwrapElement(element);
  let after_state = doc.body.innerHTML;

  // NOTE: the whitespace manipulation is wonky/imperfect/inexact. Since it is
  // not very significant, correctness is determined by non-whitespace, which we
  // verify using a compare-ignoring-whitespace approach.
  let expected_state = '1234';
  after_state = after_state.replace(/\s/g, '');
  assert(after_state === expected_state);

  // Test against simple empty list
  doc = parseHTML('<html><body><ul></ul><body></html>');
  element = doc.querySelector('ul');
  unwrapElement(element);
  after_state = doc.body.innerHTML;
  expected_state = '';
  // Due to wonky whitespace manipulation, strip it out
  after_state = after_state.trim();
  assert(after_state === expected_state, `after is ${after_state}`);

  // Test against definition list using both dd and dt
  doc = parseHTML('<html><body><dl><dd>1</dd><dt>2</dt></dl><body></html>');
  element = doc.querySelector('dl');
  unwrapElement(element);
  after_state = doc.body.innerHTML;
  expected_state = '12';
  // Ignore whitespace as usual
  after_state = after_state.replace(/\s/g, '');
  assert(after_state === expected_state);

  // Test against list with aberrant item
  doc = parseHTML('<html><body><ul><li>1</li><foo>2</foo></ul><body></html>');
  element = doc.querySelector('ul');
  unwrapElement(element);
  after_state = doc.body.innerHTML;
  expected_state = '1<foo>2</foo>';
  after_state = after_state.replace(/\s/g, '');
  assert(after_state === expected_state);
}
