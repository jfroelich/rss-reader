
function test_html_onload(event) {
  'use strict';

  const input = 'a<p>b</p>c';
  console.debug('Input:', input);
  console.debug('Output:', html_truncate(input, 2, '...'));

  const input4 = 'abc';
  console.debug('Input:', input4);
  console.debug('Output:', html_truncate(input4, 2, '...'));

  const input2 = '<html><head><title>new title</title></head><body>' + input +
    '</body></html>';
  console.debug('Input:', input2);
  console.debug('Output:', html_truncate(input2, 2, '...'));

  const input3 = '<html><head><title>new title</title></head><body>' +
    '<span style="display:none">i am hidden</span>' +
    input +
    '</body></html>';
  console.debug('Input:', input3);
  console.debug('Output:', html_truncate(input3, 2, '...'));

  const input5 = 'a&nbsp;bc';
  console.debug('Input:', input5);
  console.debug('Output:', html_truncate(input5, 2, '...'));


}

document.addEventListener('DOMContentLoaded', test_html_onload);
