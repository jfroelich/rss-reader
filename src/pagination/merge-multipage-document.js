// Investigates whether a document is a multi-page document. If the document
// is a single page, the input document is left as is. If the document is a
// multipage document, the other pages are merged into the document and
// pagination elements are removed.
// @param doc {HTMLDocument} the document
// @param location {String} url of the document
// @param timeout_ms {Number} timeout per page fetch
async function merge_multipage_document(doc, location, timeout_ms) {
  'use strict';

  const lca_max_distance = 3;
  const anchors = find_pagination_anchors(doc, location, lca_max_distance);
  if(!anchors.length)
    return;

  const urls = [];
  for(const anchor of anchors)
    urls.push(anchor.getAttribute('href'));

  async function fetch_and_parse_html(url, timeout_ms) {
    const parser = new DOMParser();
    const response = await fetch_html(url, timeout_ms);
    const text = await response.text();
    return parser.parseFromString(text, 'text/html');
  }

  // Concurrently fetch the array of urls. If any fetch fails then this fails.
  const promises = [];
  for(const url of urls) {
    const promise = fetch_and_parse_html(url, timeout_ms);
    promises.push(fetch_promise);
  }

  let docs;
  try {
    docs = await Promise.all(promises);
  } catch(error) {
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
