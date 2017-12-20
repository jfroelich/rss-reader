import fetchHTML from "/src/fetch/fetch-html.js";
import filterLazyImages from "/src/filters/lazy-image-filter.js";
import filterSourcelessImages from "/src/filters/sourceless-image-filter.js";
import parseHTML from "/src/utils/html/parse.js";

async function test(urlString) {
  const urlObject = new URL(urlString);
  const response = await fetchHTML(urlObject);
  const responseText = await response.text();
  const document = parseHTML(responseText);

  filterLazyImages(document);

  // Call this subsequently because it prints out missing images
  filterSourcelessImages(document);
}


window.test = test;
