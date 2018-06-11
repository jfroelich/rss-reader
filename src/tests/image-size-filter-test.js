import {fetch_html} from '/src/fetch-html.js';
import {fetch_policy} from '/src/fetch-policy.js';
import {set_document_base_uri} from '/src/lib/dom/set-document-base-uri.js';
import {set_image_sizes} from '/src/lib/filters/set-image-sizes.js';
import {parse_html} from '/src/lib/html/parse-html.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: these tests must be rewritten using new approach

// TODO: move this comment somewhere, i dunno, github issue
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
    throw new Error(
        'Failed to fetch ' + request_url.href + ' with status ' +
        response.status);
  }

  const html = await response.text();
  const document = parse_html(html);
  const response_url = new URL(response.url);
  set_document_base_uri(document, response_url);
  await set_image_sizes(document, undefined, fetch_policy);
};


window.test2 = async function() {
  const html =
      '<html><body><img src="http://exercism.io/icons/brand-logo.svg">' +
      '</body></html>';
  const document = parse_html(html);

  set_document_base_uri(document, new URL('http://exercism.io'));

  await set_image_sizes(document, undefined, fetch_policy);
};

// register_test();
// register_test();
