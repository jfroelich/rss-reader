import * as FetchUtils from "/src/common/fetch-utils.js";

async function fetchHTML(urlString, timeout) {
  const urlObject = new URL(urlString);
  const response = await FetchUtils.fetchHTML(urlObject, timeout);
  console.log(response);
}

// Expose to console
window.fetchHTML = fetchHTML;
