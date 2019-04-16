import TestRegistry from '/src/test/test-registry.js';
import assert from '/src/lib/assert.js';
import parseHTML from '/src/lib/parse-html.js';
import unwrapElement from '/src/lib/unwrap-element.js';

function unwrapElementTest() {
  // Assert the typical case of a simple straightforward unwrap call completes
  // as expected
  let doc = parseHTML('<html><head></head><body><div>hello</div></body></html>');
  let element = doc.querySelector('div');
  unwrapElement(element);
  let expectedState = '<html><head></head><body>hello</body></html>';
  let actualState = doc.documentElement.outerHTML;
  assert(actualState === expectedState);

  // Assert that calling unwrap on something other than an element throws an
  // exception
  let unwrapNullError;
  try {
    unwrapElement(null, false);
  } catch (error) {
    unwrapNullError = error;
  }
  assert(unwrapNullError);

  // Assert that unwrapping an element that has no parent node does not trigger
  // an exception and leaves the document in its expected state (untouched)
  doc = parseHTML('<html><head></head><body><div>hello</div></body></html>');
  element = doc.querySelector('div');
  element.remove();
  const beforeState = doc.documentElement.outerHTML;
  const nag = false; // disable the orphan warning
  unwrapElement(element, nag);
  actualState = doc.documentElement.outerHTML;
  assert(beforeState === actualState);

  // Assert that no space is added when the node is not adjacent to text nodes
  doc = parseHTML(
    '<html><head></head><body><p>before</p>' +
      '<a>hello</a><p>after</p></body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body><p>before</p>hello<p>after</p></body></html>';
  assert(actualState === expectedState);

  // Assert that when there is preceding text and not subsequent text, that only
  // left space is added.
  doc = parseHTML(
    '<html><head></head><body>before<a>hello</a><p>after</p></body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body>before hello<p>after</p></body></html>';
  assert(actualState === expectedState);

  // Assert that when there is no preceding text and there is subsequent text,
  // that only right space is added
  doc = parseHTML(
    '<html><head></head><body><p>before</p><a>hello</a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body><p>before</p>hello after</body></html>';
  assert(actualState === expectedState);

  // Assert that where there is both preceding text and subsequent text, that
  // both left and right space are added
  doc = parseHTML(
    '<html><head></head><body>before<a>hello</a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body>before hello after</body></html>';
  assert(actualState === expectedState);

  // Assert that when there is nothing (neither text nodes or other nodes)
  // within the element being unwrapped, and there are adjacent text nodes on
  // both sides, that one space is added between the nodes to prevent merging.
  doc = parseHTML('<html><head></head><body>before<a></a>after</body></html>');
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body>before after</body></html>';
  assert(actualState === expectedState);

  // Test a case to think more about. This works but I am not sure this is
  // the desired behavior.
  doc = parseHTML(
    '<html><head></head><body>before<a><b>hello</b></a>after</body></html>',
  );
  element = doc.querySelector('a');
  unwrapElement(element);
  actualState = doc.documentElement.outerHTML;
  expectedState = '<html><head></head><body>before<b>hello</b>after</body></html>';
  assert(actualState === expectedState);
}

function unwrapElementListTest() {
  let doc = parseHTML('<html><body>1<ul><li>2</li><li>3</li></ul>4<body></html>');
  let element = doc.querySelector('ul');
  unwrapElement(element);
  let actualState = doc.body.innerHTML;

  // NOTE: the whitespace manipulation is wonky/imperfect/inexact. Since it is
  // not very significant, correctness is determined by non-whitespace, which we
  // verify using a compare-ignoring-whitespace approach.
  let expectedState = '1234';
  actualState = actualState.replace(/\s/g, '');
  assert(actualState === expectedState);

  // Test against simple empty list
  doc = parseHTML('<html><body><ul></ul><body></html>');
  element = doc.querySelector('ul');
  unwrapElement(element);
  actualState = doc.body.innerHTML;
  expectedState = '';
  // Due to wonky whitespace manipulation, strip it out
  actualState = actualState.trim();
  assert(actualState === expectedState, `after is ${actualState}`);

  // Test against definition list using both dd and dt
  doc = parseHTML('<html><body><dl><dd>1</dd><dt>2</dt></dl><body></html>');
  element = doc.querySelector('dl');
  unwrapElement(element);
  actualState = doc.body.innerHTML;
  expectedState = '12';
  // Ignore whitespace as usual
  actualState = actualState.replace(/\s/g, '');
  assert(actualState === expectedState);

  // Test against list with aberrant item
  doc = parseHTML('<html><body><ul><li>1</li><foo>2</foo></ul><body></html>');
  element = doc.querySelector('ul');
  unwrapElement(element);
  actualState = doc.body.innerHTML;
  expectedState = '1<foo>2</foo>';
  actualState = actualState.replace(/\s/g, '');
  assert(actualState === expectedState);
}

TestRegistry.registerTest(unwrapElementTest);
TestRegistry.registerTest(unwrapElementListTest);
