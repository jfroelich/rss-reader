// See license.md

'use strict';

function test(url_str) {
  const req_url = new URL(url_str);
  const ex_ents = false;
  fetch_feed(req_url, ex_ents, console, function(event) {
    console.dir(event);
  });
}
