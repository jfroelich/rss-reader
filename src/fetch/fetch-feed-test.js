import {fetch_feed} from '/src/fetch/fetch.js';

window.test = async function(url_string, timeout) {
  const response = await fetch_feed(new URL(url_string), timeout);
  console.dir(response);
  const responseText = await response.text();
  console.dir(responseText);
};
