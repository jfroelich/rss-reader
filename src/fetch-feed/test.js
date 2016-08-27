'use strict';

function test_fetch_feed(url_string) {
  fetch_feed(new URL(url_string), 0, false, test_on_fetch);
}

function test_on_fetch(event) {
  console.dir(event);
}
