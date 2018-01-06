import {fetchHTML} from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";
import filterBoilerplate from "/src/feed-poll/filters/boilerplate-filter.js";
import canonicalizeURLs from "/src/feed-poll/filters/canonical-url-filter.js";
import filterBlacklistedElements from "/src/feed-poll/filters/element-blacklist-filter.js";
import filterFrames from "/src/feed-poll/filters/frame-filter.js";
import filterIFrames from "/src/feed-poll/filters/iframe-filter.js";
import setImageSizes from "/src/feed-poll/filters/image-size-filter.js";
import filterScript from "/src/feed-poll/filters/script-filter.js";

async function test(urlString) {
  const urlObject = new URL(urlString);

  let status, response, document, message;

  [status, response] = await fetchHTML(urlObject);
  if(status !== Status.OK) {
    console.warn('Fetch error:', status);
    return;
  }

  const responseText = await response.text();

  [status, document, message] = parseHTML(responseText);
  if(status !== Status.OK) {
    console.warn(message);
    return;
  }

  // Strip some annoying iframe stuff
  filterFrames(document);
  filterIFrames(document);

  // Filter scripts to at least make an attempt at security. Not terribly important technically
  // because of CSP protections.
  filterScript(document);

  // Strip some object stuff
  filterBlacklistedElements(document);

  // Get rid of some annoying console errors, and ensure images canonical to allow for
  // setting image size.
  canonicalizeURLs(document, new URL(response.url));

  // Set image sizes to more accurately test image bias
  await setImageSizes(document);

  // Finally filter boilerplate, use annotations and do not prune
  const bpfOptions = {
    annotate: true
  };
  filterBoilerplate(document, bpfOptions);

  // Find the best element and outline it.
  const bestElement = document.querySelector('[data-bp-max]');
  if(bestElement) {
    bestElement.style.border = '3px solid green';
  }

  // Update preview
  const preview = window.document.getElementById('preview');
  preview.innerHTML = document.body.innerHTML;
}

// Expose test helper function to console
window.test = test;
