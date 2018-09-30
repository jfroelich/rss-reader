import assert from '/src/assert/assert.js';
import * as html from '/src/html/html.js';

export async function html_truncate_test() {
  const truncate = html.truncate_html;

  const e = '.';
  let input = 'a<p>b</p>c';
  let output = 'a<p>b.</p>';
  assert(truncate(input, 2, e) === output);

  // TODO: finish up conversion to new test format

  /*
    const input2 = `<html><head><title>new title</title></head><body>${input1}
      </body></html>`;
    assert(input2, '=>', truncate(input2, 2, ext));
    const input3 = `<html><head><title>new title</title></head><body>
      <span style="display:none">hidden</span>${input1}</body></html>`;
    assert(input3, '=>', truncate(input3, 2, ext));
    const input4 = 'abc';
    assert(input4, '=>', truncate(input4, 2, ext));
    const input5 = 'a&nbsp;bc';
    assert(input5, '=>', truncate(input5, 2, ext));
    const input6 = 'a&nbsp;b&amp;c&lt;d';
    assert(input6, '=>', truncate(input6, 2, ext));
    const input7 = 'a&#32;b';
    assert(input7, '=>', truncate(input7, 2, ext));
  */
}
