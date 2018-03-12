import {fetch_html} from '/src/fetch/fetch.js';

window.test = async function(url_string, timeout) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url, timeout);
  console.dir(response);
  const response_text = await response.text();
  console.log(response_text);
  return response;
};
