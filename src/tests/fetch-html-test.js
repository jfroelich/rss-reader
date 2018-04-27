import {fetch_html} from '/src/ops/fetch.js';
import {assert} from '/src/tests/assert.js';

// TODO: run on a local resource
// TODO: cannot accept param

export async function fetch_html_test() {
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
