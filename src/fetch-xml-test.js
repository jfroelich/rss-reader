// See license.md

'use strict';

function test(url_str) {
  const url = new URL(url_str);
  const callback = function(event) {
    console.log('Test completed');
  };
  fetch_xml(url, console, callback);
}
