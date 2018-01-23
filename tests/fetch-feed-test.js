import {fetchFeed} from "/src/common/fetch-utils.js";

window.test = async function(url, timeout) {
  const response = await fetchFeed(new URL(url), timeout);
  console.dir(response);
  const responseText = await response.text();
  console.dir(responseText);
};
