
function truncateHTMLStringTestOnLoad(event) {
  'use strict';

  const input = 'a<p>b</p>c';
  console.debug('Input:', input);
  console.debug('Output:', truncateHTMLString(input, 2, '...'));

  const input4 = 'abc';
  console.debug('Input:', input4);
  console.debug('Output:', truncateHTMLString(input4, 2, '...'));

  const input2 = '<html><head><title>new title</title></head><body>' + input +
    '</body></html>';
  console.debug('Input:', input2);
  console.debug('Output:', truncateHTMLString(input2, 2, '...'));

  const input3 = '<html><head><title>new title</title></head><body>' +
    '<span style="display:none">i am hidden</span>' +
    input +
    '</body></html>';
  console.debug('Input:', input3);
  console.debug('Output:', truncateHTMLString(input3, 2, '...'));

  const input5 = 'a&nbsp;bc';
  console.debug('Input:', input5);
  console.debug('Output:', truncateHTMLString(input5, 2, '...'));

  const input6 = 'a&nbsp;b&amp;c&lt;d';
  console.debug('Input:', input6);
  console.debug('Output:', truncateHTMLString(input6, 2, '...'));

  const input7 = 'a&#32;b';
  console.debug('Input:', input7);
  console.debug('Output:', truncateHTMLString(input7, 2, '...'));
}

document.addEventListener('DOMContentLoaded', truncateHTMLStringTestOnLoad);
