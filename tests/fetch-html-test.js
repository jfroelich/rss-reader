import {fetch_html} from '/src/common/fetch-utils.js';

window.test = async function(urlString, timeout) {
  const response = await fetch_html(new URL(urlString), timeout);
  console.dir(response);
};
