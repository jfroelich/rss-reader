import {fetch_feed} from '/src/fetch/fetch.js';

window.test = async function(url_string, timeout) {
  const request_url = new URL(url_string);
  const response = await fetch_feed(request_url, timeout);
  console.dir(response);

  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  console.dir(response_text);
};
