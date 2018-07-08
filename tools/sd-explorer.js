import {sanitize_document} from '/src/action/poll/sanitize-document.js';
import {set_base_uri} from '/src/lib/html-document.js';
import {parse_html} from '/src/lib/html.js';
import {fetch_html} from '/src/lib/net/fetch-html.js';

async function explore(url_string) {
  document.body.innerHTML = 'Loading ' + url_string + ' ...';

  const url = new URL(url_string);
  const response = await fetch_html(url, 5000);
  const response_text = await response.text();

  console.debug('Content-Length:', response_text.length);

  document.body.innerHTML = 'Parsing ' + response_text.length + ' characters';
  const doc = parse_html(response_text);

  let element_count = doc.documentElement.getElementsByTagName('*').length;
  console.debug('Element count:', element_count);

  document.body.innerHTML = 'Filtering document';

  set_base_uri(doc, new URL(response.url));

  // TODO: i need to be able to discover problems with sanitization here. Like
  // instead of pruning, this annotates with removal-reason or something

  await sanitize_document(doc);

  element_count = doc.documentElement.getElementsByTagName('*').length;
  console.debug('After filter element count:', element_count);

  document.body.innerHTML = 'Rendering';
  document.body.innerHTML = doc.body.innerHTML;
}

window.explore = explore;
