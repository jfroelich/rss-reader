import assert from '/lib/assert.js';
import truncateHTML from '/lib/truncate-html.js';

// TODO: finish transition from old tests to new tests
export function truncate_html_test() {
  const e = '.';
  const input = 'a<p>b</p>c';
  const output = 'a<p>b.</p>';
  assert(truncateHTML(input, 2, e) === output);

  /*
  const input2 = `<html><head><title>new title</title></head><body>${input1}
    </body></html>`;
  assert(input2, '=>', truncateHTML(input2, 2, ext));
  const input3 = `<html><head><title>new title</title></head><body>
    <span style="display:none">hidden</span>${input1}</body></html>`;
  assert(input3, '=>', truncateHTML(input3, 2, ext));
  const input4 = 'abc';
  assert(input4, '=>', truncateHTML(input4, 2, ext));
  const input5 = 'a&nbsp;bc';
  assert(input5, '=>', truncateHTML(input5, 2, ext));
  const input6 = 'a&nbsp;b&amp;c&lt;d';
  assert(input6, '=>', truncateHTML(input6, 2, ext));
  const input7 = 'a&#32;b';
  assert(input7, '=>', truncateHTML(input7, 2, ext));
  */
}
