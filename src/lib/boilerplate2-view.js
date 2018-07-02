import * as bp from '/src/lib/boilerplate2.js';
import {canonicalize_urls} from '/src/lib/filters/canonicalize-urls.js';
import {deframe} from '/src/lib/filters/deframe.js';
import {filter_blacklisted_elements} from '/src/lib/filters/filter-blacklisted-elements.js';
import {filter_comments} from '/src/lib/filters/filter-comments.js';
import {filter_iframes} from '/src/lib/filters/filter-iframes.js';
import {filter_script_elements} from '/src/lib/filters/filter-script-elements.js';
import {set_base_uri} from '/src/lib/html-document.js';
import {parse_html} from '/src/lib/html.js';
import {fetch_html} from '/src/lib/net/fetch-html.js';

async function bptest(url_string) {
  // TODO: load the url, clean it up a bit, run boilerplate2 on it, then
  // render it into document.body here
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

  const svgs = doc.querySelectorAll('svg');
  for (const svg of svgs) {
    svg.remove();
  }

  const noscripts = doc.querySelectorAll('noscript');
  for (const noscript of noscripts) {
    noscript.remove();
  }

  bp.annotate(doc);

  document.body.innerHTML = '';
  document.body.innerHTML = doc.body.innerHTML;
}

window.bptest = bptest;
