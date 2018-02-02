import {paginationFindAnchors} from '/experimental/pagination.js';
import {fetch_html} from '/src/common/fetch-utils.js';

// Investigates whether a document is a multi-page document. If the document
// is a single page, the input document is left as is. If the document is a
// multipage document, the other pages are merged into the document and
// pagination elements are removed.
// @param doc {HTMLDocument} the document
// @param location {String} url of the document
// @param timeoutMs {Number} timeout per page fetch
export async function multipageFilter(doc, location, timeoutMs) {
  assert(doc instanceof Document);
  const lcaMaxDistance = 3;
  const anchors = paginationFindAnchors(doc, location, lcaMaxDistance);
  if (!anchors.length) {
    return;
  }

  const urls = [];
  for (const anchor of anchors) {
    urls.push(anchor.getAttribute('href'));
  }

  // TODO: inline
  // TODO: use HTMLParser
  async function fetchAndParseHTML(url, timeoutMs) {
    const parser = new DOMParser();
    const requestURLObject = new URL(url);
    const response = await fetch_html(requestURLObject, timeoutMs);
    const text = await response.text();
    return parser.parseFromString(text, 'text/html');
  }

  // Concurrently fetch the array of urls. If any fetch fails then this fails.
  const promises = [];
  for (const url of urls) {
    promises.push(fetchAndParseHTML(url, timeoutMs));
  }

  let docs;
  try {
    docs = await Promise.all(promises);
  } catch (error) {
    // On fetch error, the merge fails
    // TODO: should I just not catch the error and expect caller to handle it?
    // Otherwise how would the caller differentiate between merge, no merge,
    // and no merge due to fetch error?
    console.debug(error);
    return;
  }

  // TODO: Merge the documents here. Copy each document's body into the body of
  // the main document.
  // TODO: once merged, remove the pagination information from the document
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
