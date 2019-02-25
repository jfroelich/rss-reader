import {assert} from '/src/lib/assert.js';
import {coerce_element} from '/src/lib/coerce-element.js';
import * as html_utils from '/src/lib/html-utils.js';

export async function coerce_element_test() {
  const input = '<html><head></head><body><p></p><a></a></body></html>';
  const doc = html_utils.parse_html(input);

  // Replace the as with bs
  const anchors = doc.querySelectorAll('a');
  for (const a of anchors) {
    coerce_element(a, 'b');
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
    coerce_element(b, 'c');
  }
  expected = '<html><head></head><body><p></p><c></c></body></html>';
  assert(doc.documentElement.outerHTML === expected);

  // TODO: assert that p still exists to test that coerce does not affect
  // elements it shouldn't affect (surprise side effects)

  // TODO: test that child nodes remain in the expected place, including both
  // elements and text nodes (surprises side effects)

  // TODO: test error cases? what errors? invalid input?
}