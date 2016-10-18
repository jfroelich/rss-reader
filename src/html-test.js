// See license.md

'use strict';

document.addEventListener('DOMContentLoaded', function(event) {
  const ext = '...';

  const input1 = 'a<p>b</p>c';
  console.debug(input1, '=>', truncate_html(input1, 2, ext));
  const input2 = `<html><head><title>new title</title></head><body>${input1}
    </body></html>`;
  console.debug(input2, '=>', truncate_html(input2, 2, ext));
  const input3 = `<html><head><title>new title</title></head><body>
    <span style="display:none">hidden</span>${input1}</body></html>`;
  console.debug(input3, '=>', truncate_html(input3, 2, ext));
  const input4 = 'abc';
  console.debug(input4, '=>', truncate_html(input4, 2, ext));
  const input5 = 'a&nbsp;bc';
  console.debug(input5, '=>', truncate_html(input5, 2, ext));
  const input6 = 'a&nbsp;b&amp;c&lt;d';
  console.debug(input6, '=>', truncate_html(input6, 2, ext));
  const input7 = 'a&#32;b';
  console.debug(input7, '=>', truncate_html(input7, 2, ext));
});
