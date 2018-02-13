import filterBoilerplate from '/src/content-filters/boilerplate.js';
import canonicalizeURLs from '/src/content-filters/canonical-url-filter.js';
import filterBlacklistedElements from '/src/content-filters/element-blacklist-filter.js';
import filterFrames from '/src/content-filters/frame-filter.js';
import filterIFrames from '/src/content-filters/iframe-filter.js';
import setImageSizes from '/src/content-filters/image-size-filter.js';
import filterScript from '/src/content-filters/script-filter.js';
import {fetch_html} from '/src/fetch-utils.js';
import {html_parse} from '/src/html-utils.js';

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
