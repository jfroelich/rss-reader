import TestRegistry from '/test/test-registry.js';
import assert from '/lib/assert.js';
import truncateHTML from '/lib/truncate-html.js';

export default function truncateHTMLTest() {
  const e = '.';
  const input = 'a<p>b</p>c';
  const output = 'a<p>b.</p>';
  assert(truncateHTML(input, 2, e) === output);
}

TestRegistry.registerTest(truncateHTMLTest);
