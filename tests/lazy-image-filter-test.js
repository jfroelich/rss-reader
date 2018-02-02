import * as FetchUtils from '/src/common/fetch-utils.js';
import {html_parse} from '/src/common/html-utils.js';
import filterLazyImages from '/src/feed-poll/filters/lazy-image-filter.js';
import filterSourcelessImages from '/src/feed-poll/filters/sourceless-image-filter.js';

window.test = async function(urlString) {
  const urlObject = new URL(urlString);
  const response = await FetchUtils.fetch_html(urlObject);
  const responseText = await response.text();
  const document = html_parse(responseText);
  filterLazyImages(document);
  // Call this subsequently because it prints out missing images
  filterSourcelessImages(document);
};
