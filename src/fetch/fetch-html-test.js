import {fetch_html} from '/src/fetch/fetch.js';

window.test = async function(urlString, timeout) {
  const response = await fetch_html(new URL(urlString), timeout);
  console.dir(response);
};
