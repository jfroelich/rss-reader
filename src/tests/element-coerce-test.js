import {element_coerce} from '/src/lib/element-coerce.js';
import * as html_parser from '/src/lib/html-parser.js';
import {assert} from '/src/tests/assert.js';

export async function element_coerce_test() {
  const input = '<html><head></head><body><p></p><a></a></body></html>';
  const doc = html_parser.parse(input);

  // Replace the as with bs
  const anchors = doc.querySelectorAll('a');
  for (const a of anchors) {
    element_coerce(a, 'b', true);
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
    element_coerce(b, 'c', true);
  }
  expected = '<html><head></head><body><p></p><c></c></body></html>';
  assert(doc.documentElement.outerHTML === expected);

  // TODO: assert that p still exists to test that coerce does not affect
  // elements it shouldn't affect

  // TODO: test that child nodes remain in the expected place, including both
  // elements and text nodes
}