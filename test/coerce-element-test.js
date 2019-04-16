import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import coerceElement from '/lib/coerce-element.js';
import parseHTML from '/lib/parse-html.js';

// TODO: assert that p still exists to test that coerce does not affect
// elements it should not affect (surprise side effects)
// TODO: test that child nodes remain in the expected place, including both
// elements and text nodes (surprises side effects)
// TODO: test error cases? what errors? invalid input?

function coerceElementTest() {
  const input = '<html><head></head><body><p></p><a></a></body></html>';
  const doc = parseHTML(input);

  // Replace the as with bs
  const anchors = doc.querySelectorAll('a');
  for (const a of anchors) {
    coerceElement(a, 'b');
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
    coerceElement(b, 'c');
  }
  expected = '<html><head></head><body><p></p><c></c></body></html>';
  assert(doc.documentElement.outerHTML === expected);
}

TestRegistry.registerTest(coerceElementTest);
