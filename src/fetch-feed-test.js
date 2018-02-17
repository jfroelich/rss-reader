import {fetch_feed} from '/src/fetch-utils.js';

window.test = async function(url, timeout) {
  const response = await fetch_feed(new URL(url), timeout);
  console.dir(response);
  const responseText = await response.text();
  console.dir(responseText);
};
