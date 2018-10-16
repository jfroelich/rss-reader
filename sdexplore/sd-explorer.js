import {fetch_html} from '/src/control/fetch-html.js';
import {set_base_uri} from '/src/base/set-base-uri.js';
import {parse_html} from '/src/base/html.js';
import {sanitize_document} from '/src/base/sandoc/sandoc.js';

// TODO: i need to be able to discover problems with sanitization here. Like
// instead of pruning, this annotates with removal-reason or something

async function explore(url_string) {
  document.body.innerHTML = 'Loading ' + url_string + ' ...';
  const url = new URL(url_string);
  const response = await fetch_html(url, 5000);
  const response_text = await response.text();
  document.body.innerHTML = 'Parsing ' + response_text.length + ' characters';
  const doc = parse_html(response_text);
  document.body.innerHTML = 'Filtering document';
  set_base_uri(doc, new URL(response.url));

  const sdopts = {};
  await sanitize_document(doc, sdopts);

  document.body.innerHTML = 'Rendering';
  document.body.innerHTML = doc.body.innerHTML;
}

window.explore = explore;
