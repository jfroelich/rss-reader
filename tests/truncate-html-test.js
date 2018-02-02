import {html_truncate} from '/src/common/html-utils.js';

const ext = '...';
const input1 = 'a<p>b</p>c';
console.debug(input1, '=>', truncate(input1, 2, ext));
const input2 = `<html><head><title>new title</title></head><body>${input1}
  </body></html>`;
console.debug(input2, '=>', truncate(input2, 2, ext));
const input3 = `<html><head><title>new title</title></head><body>
  <span style="display:none">hidden</span>${input1}</body></html>`;
console.debug(input3, '=>', truncate(input3, 2, ext));
const input4 = 'abc';
console.debug(input4, '=>', truncate(input4, 2, ext));
const input5 = 'a&nbsp;bc';
console.debug(input5, '=>', truncate(input5, 2, ext));
const input6 = 'a&nbsp;b&amp;c&lt;d';
console.debug(input6, '=>', truncate(input6, 2, ext));
const input7 = 'a&#32;b';
console.debug(input7, '=>', truncate(input7, 2, ext));
