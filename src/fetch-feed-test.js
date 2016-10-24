// See license.md

'use strict';

function test(url_str) {
  const req_url = new URL(url_str);
  const ex_ents = false;
  const promise = fetch_feed(req_url, ex_ents, console);
  promise.then(function(event) {
    console.log('then:', event);
  }).catch(function(error) {
    console.log('catch:', error);
  });
}
