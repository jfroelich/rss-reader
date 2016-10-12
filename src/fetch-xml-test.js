// See license.md

'use strict';

function test(urlString) {
  const url = new URL(urlString);
  const callback = function(event) {
    console.log('Test completed');
  };

  fetchXML(url, console, callback);
}
