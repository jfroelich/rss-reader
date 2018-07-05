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

// TODO: should I be filtering hidden elements for testing purposes? That will
// get me a more accurate view, right?


async function bptest(url_string) {
  const url = new URL(url_string);
  const response = await fetch_html(url, 5000);
  const response_text = await response.text();
  const doc = parse_html(response_text);

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

  // Carry out the actual analysis
  bp.annotate(doc);

  // Reset the view explicitly. There are some strange shenanigans that can
  // happen if just replacing innerHTML (e.g. like head elements getting merged)
  document.body.innerHTML = '';

  // Update the view
  document.body.innerHTML = doc.body.innerHTML;
}

window.bptest = bptest;
