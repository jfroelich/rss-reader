import * as filters from '/src/content-filters/content-filters.js';
import {fetch_html} from '/src/fetch/fetch.js';
import * as html_parser from '/src/html-parser/html-parser.js';

// TODO: research http://exercism.io/ svg loading issue
// Actually there is now a separate issue. It's not finding any urls. Something
// is up with parsing. Viewing source shows stuff. Actually it might even be in
// fetching it? Yeah, it serves up garbage when I fetch it, completely
// different. Perhaps because of no cookies or some header. So I can't test that
// particular url until I figure out the problem ok the size was getting loaded,
// attribute filter didn't whitelist image sizes

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const html = await response.text();
  const document = html_parser.parse(html);
  const response_url = new URL(response.url);
  await filters.document_set_image_sizes(document, response_url);
};

window.test2 = async function() {
  const html =
      '<html><body><img src="http://exercism.io/icons/brand-logo.svg">' +
      '</body></html>';
  const document = html_parser.parse(html);
  await filters.document_set_image_sizes(document);
};
