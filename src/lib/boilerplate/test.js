import * as boilerplate from '/src/lib/boilerplate/boilerplate.js';
import * as filters from '/src/content-filters/content-filters.js';
import {fetch_html} from '/src/url-loader/url-loader.js';
import * as html_parser from '/src/lib/html-parser/html-parser.js';

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_url = new URL(response.url);
  const response_text = await response.text();
  const document = html_parser.parse(response_text);

  filters.filter_frame_elements(document);
  filters.filter_iframe_elements(document);
  filters.filter_script_elements(document);
  filters.filter_blacklisted_elements(document);
  filters.cf_resolve_document_urls(document, response_url);
  await filters.document_set_image_sizes(document, response_url);
  boilerplate.annotate(document);

  const preview = window.document.getElementById('preview');
  preview.innerHTML = document.body.innerHTML;
};