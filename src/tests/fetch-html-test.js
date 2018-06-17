import {fetch_html} from '/src/net/fetch-html.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: run on a local resource
// TODO: cannot accept param

async function fetch_html_test() {
  return true;
}

/*
async function test(url_string, timeout) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url, timeout);
  console.dir(response);
  const response_text = await response.text();
  console.log(response_text);
  return response;
}
*/

register_test(fetch_html_test);
