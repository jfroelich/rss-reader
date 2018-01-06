import filterLazyImages from "/src/feed-poll/filters/lazy-image-filter.js";
import filterSourcelessImages from "/src/feed-poll/filters/sourceless-image-filter.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";

async function test(urlString) {
  let status, response, document;

  const urlObject = new URL(urlString);
  [status, response] = await FetchUtils.fetchHTML(urlObject);
  if(status !== Status.OK) {
    console.warn('Fetch error', status);
    return;
  }

  const responseText = await response.text();
  [status, document] = parseHTML(responseText);
  if(status !== Status.OK) {
    console.warn('Parse error', status);
    return;
  }

  filterLazyImages(document);

  // Call this subsequently because it prints out missing images
  filterSourcelessImages(document);
}


window.test = test;
