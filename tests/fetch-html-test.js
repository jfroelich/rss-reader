import {fetchHTML} from "/src/common/fetch-utils.js";

window.test = async function(urlString, timeout) {
  const response = await fetchHTML(new URL(urlString), timeout);
  console.dir(response);
};
