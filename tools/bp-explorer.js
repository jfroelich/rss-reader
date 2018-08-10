import {canonicalize_urls} from '/src/lib/sandoc/canonicalize-urls.js';
import {deframe} from '/src/lib/sandoc/deframe.js';
import {filter_blacklisted_elements} from '/src/lib/sandoc/filter-blacklisted-elements.js';
import {filter_comments} from '/src/lib/sandoc/filter-comments.js';
import {filter_iframes} from '/src/lib/sandoc/filter-iframes.js';
import {filter_script} from '/src/lib/sandoc/filter-script.js';
import {set_image_sizes} from '/src/lib/sandoc/set-image-sizes.js';
import * as bp from '/src/lib/boilerplate.js';
import {set_base_uri} from '/src/lib/html-document.js';
import {parse_html} from '/src/lib/html.js';
import {fetch_html} from '/src/lib/fetch-html.js';

// TODO: will filtering hidden elements help exploration?

const load_button = document.getElementById('load');
load_button.addEventListener('click', load_button_onclick);

const section = document.getElementById('content');

async function load_button_onclick(event) {
  const url_input = document.getElementById('url');
  const url_string = url_input.value;
  await bptest(url_string);
}

async function bptest(url_string) {
  section.innerHTML = 'Loading ' + url_string + ' ...';

  const url = new URL(url_string);
  const response = await fetch_html(url, 5000);
  const response_text = await response.text();

  section.innerHTML = 'Parsing ' + response_text.length + ' characters';
  const doc = parse_html(response_text);

  section.innerHTML = 'Filtering document before analysis';

  // Do some pre-analysis filtering
  filter_comments(doc);
  deframe(doc);
  filter_script(doc);
  filter_iframes(doc);

  const custom_blacklist = ['svg', 'style'];
  filter_blacklisted_elements(doc, custom_blacklist);

  set_base_uri(doc, url);
  canonicalize_urls(doc);

  // The algorithm now considers image sizes so I need to ensure those are set
  // in order to properly test. Allow all image requests. No timeout (wait
  // indefinitely).
  await set_image_sizes(doc, undefined, request => true);


  let elements = doc.body.getElementsByTagName('*');
  for (const element of elements) {
    element.removeAttribute('style');
  }

  section.innerHTML = 'Analyzing boilerplate';

  const dataset = bp.create_block_dataset(doc);
  const model = bp.create_model();
  const scored_dataset = bp.classify(dataset, model);

  bp.annotate_document(doc, scored_dataset);

  // sort of remove ids so it does not muck with form stuff
  elements = doc.body.getElementsByTagName('*');
  for (const element of elements) {
    const id = element.getAttribute('id');
    if (id) {
      element.setAttribute('old-id', id);
      element.removeAttribute('id');
    }
  }

  section.innerHTML = 'Analysis completed, rendering document view';
  section.innerHTML = doc.body.innerHTML;
}

window.bptest = bptest;
