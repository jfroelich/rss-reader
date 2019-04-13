import assert from '/lib/assert.js';
import truncateHTML from '/lib/truncate-html.js';

export default function () {
  const e = '.';
  const input = 'a<p>b</p>c';
  const output = 'a<p>b.</p>';
  assert(truncateHTML(input, 2, e) === output);
}
