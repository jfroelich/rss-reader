import * as FetchUtils from "/src/common/fetch-utils.js";

async function fetchHTML(urlString, timeout) {
  const urlObject = new URL(urlString);
  const fetchResult = await FetchUtils.fetchHTML(urlObject, timeout);
  console.dir(fetchResult);
}

// Expose to console
window.fetchHTML = fetchHTML;
