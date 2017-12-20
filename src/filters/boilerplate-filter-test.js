import filterBoilerplate from "/src/filters/boilerplate-filter.js";
import canonicalizeURLs from "/src/filters/canonical-url-filter.js";
import filterBlacklistedElements from "/src/filters/element-blacklist-filter.js";
import filterFrames from "/src/filters/frame-filter.js";
import filterIFrames from "/src/filters/iframe-filter.js";
import setImageSizes from "/src/filters/image-size-filter.js";
import filterScript from "/src/filters/script-filter.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import parseHTML from "/src/utils/html/parse.js";

async function test(urlString) {
  const urlObject = new URL(urlString);
  const response = await fetchHTML(urlObject);
  const responseText = await response.text();
  const document = parseHTML(responseText);

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
  const responseURLString = response.responseURL;
  canonicalizeURLs(document, new URL(responseURLString));

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
