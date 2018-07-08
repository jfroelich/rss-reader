import * as bp from '/src/lib/boilerplate2.js';
import {canonicalize_urls} from '/src/lib/filters/canonicalize-urls.js';
import {deframe} from '/src/lib/filters/deframe.js';
import {filter_blacklisted_elements} from '/src/lib/filters/filter-blacklisted-elements.js';
import {filter_comments} from '/src/lib/filters/filter-comments.js';
import {filter_iframes} from '/src/lib/filters/filter-iframes.js';
import {filter_script_elements} from '/src/lib/filters/filter-script-elements.js';
import {set_image_sizes} from '/src/lib/filters/set-image-sizes.js';
import {set_base_uri} from '/src/lib/html-document.js';
import {parse_html} from '/src/lib/html.js';
import {fetch_html} from '/src/lib/net/fetch-html.js';

// TODO: will filtering hidden elements help exploration?

async function bptest(url_string) {
  document.body.innerHTML = 'Loading ' + url_string + ' ...';

  const url = new URL(url_string);
  const response = await fetch_html(url, 5000);
  const response_text = await response.text();

  document.body.innerHTML = 'Parsing ' + response_text.length + ' characters';
  const doc = parse_html(response_text);

  document.body.innerHTML = 'Filtering document before analysis';

  // Do some pre-analysis filtering
  filter_comments(doc);
  deframe(doc);
  filter_script_elements(doc);
  filter_iframes(doc);
  filter_blacklisted_elements(doc);
  set_base_uri(doc, url);
  canonicalize_urls(doc);

  // The algorithm now considers image sizes so I need to ensure those are set
  // in order to properly test. Allow all image requests. No timeout (wait
  // indefinitely).
  await set_image_sizes(doc, undefined, request => true);

  // I don't think I have a filter for this, but running into this issue
  // frequently, I need a filter that does a better job of this
  const svgs = doc.querySelectorAll('svg');
  for (const svg of svgs) {
    svg.remove();
  }

  // Not happy with the current filter behavior, so just remove
  const noscripts = doc.querySelectorAll('noscript');
  for (const noscript of noscripts) {
    noscript.remove();
  }

  const elements = doc.body.getElementsByTagName('*');
  for (const element of elements) {
    element.removeAttribute('style');
  }

  const styles = doc.querySelectorAll('style');
  for (const style of styles) {
    style.remove();
  }

  document.body.innerHTML = 'Analyzing boilerplate';

  const dataset = bp.create_block_dataset(doc);
  const model = bp.create_model();
  const scored_dataset = bp.classify(dataset, model);
  bp.annotate_document(doc, scored_dataset);

  document.body.innerHTML = 'Analysis completed, rendering document view';
  document.body.innerHTML = doc.body.innerHTML;
}

window.bptest = bptest;
