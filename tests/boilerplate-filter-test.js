import {fetch_html} from '/src/common/fetch-utils.js';
import {html_parse} from '/src/common/html-utils.js';
import filterBoilerplate from '/src/content-filter/boilerplate-filter.js';
import canonicalizeURLs from '/src/content-filter/canonical-url-filter.js';
import filterBlacklistedElements from '/src/content-filter/element-blacklist-filter.js';
import filterFrames from '/src/content-filter/frame-filter.js';
import filterIFrames from '/src/content-filter/iframe-filter.js';
import setImageSizes from '/src/content-filter/image-size-filter.js';
import filterScript from '/src/content-filter/script-filter.js';

window.test = async function(urlString) {
  const response = await fetch_html(new URL(urlString));
  const responseText = await response.text();
  const document = html_parse(responseText);

  // Strip some annoying iframe stuff
  filterFrames(document);
  filterIFrames(document);

  // Filter scripts to at least make an attempt at security. Not terribly
  // important technically because of CSP protections.
  filterScript(document);

  // Strip some object stuff
  filterBlacklistedElements(document);

  // Get rid of some annoying console errors, and ensure images canonical to
  // allow for setting image size.
  canonicalizeURLs(document, new URL(response.url));

  // TODO: I don't think I need to canonicalize urls any longer now that
  // setImageSizes accepts an optional base url

  // Set image sizes to more accurately test image bias
  await setImageSizes(document, new URL(response.url));

  // Finally filter boilerplate
  filterBoilerplate(document, {annotate: true});

  // Find the best element and outline it.
  const bestElement = document.querySelector('[data-bp-max]');
  if (bestElement) {
    bestElement.style.border = '3px solid green';
  }

  // Update preview
  const preview = window.document.getElementById('preview');
  preview.innerHTML = document.body.innerHTML;
};
