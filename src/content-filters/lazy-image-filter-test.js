import * as FetchUtils from '/src/fetch/fetch.js';
import {html_parse} from '/src/html/html.js';
import filterLazyImages from '/src/content-filters/lazy-image-filter.js';
import filterSourcelessImages from '/src/content-filters/sourceless-image-filter.js';

window.test = async function(urlString) {
  const urlObject = new URL(urlString);
  const response = await FetchUtils.fetch_html(urlObject);
  const responseText = await response.text();
  const document = html_parse(responseText);
  filterLazyImages(document);
  // Call this subsequently because it prints out missing images
  filterSourcelessImages(document);
};
