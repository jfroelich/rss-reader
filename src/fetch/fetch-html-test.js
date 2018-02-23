import {fetch_html} from '/src/fetch/fetch.js';

window.test = async function(url_string, timeout) {
  const response = await fetch_html(new URL(url_string), timeout);
  console.dir(response);
};
