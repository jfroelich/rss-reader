import assert from '/src/lib/assert.js';
import {set_image_sizes} from '/src/lib/filters/set-image-sizes.js';
import {set_base_uri} from '/src/lib/html-document.js';
import * as html from '/src/lib/html.js';
import {register_test} from '/test/test-registry.js';

// Assert the ordinary case of a basic html document with an image with unknown
// attributes
async function set_image_sizes_basic_test() {
  const doc = await fetch_local('basic.html');

  await set_sizes(doc, undefined, url => true);

  const image = doc.querySelector('img');
  assert(image.width === 16);
  assert(image.height === 12);
}

// Assert that fetching an image that does not exist skips over the image
async function set_image_sizes_404_test() {
  const doc = await fetch_local('404.html');
  await set_sizes(doc, undefined, url => true);
}


// TODO: test loading a 404 image, i just realized the error handling around
// the fetch call isn't trapped, so it might look like a programmer error
// TODO: test loading a file without any images
// TODO: test image missing src
// TODO: test image missing src with srcset
// TODO: test multiple images
// TODO: test when an image uses attributes different than natural dimensions
// (a resized-by-attribute image), I believe the resized dimensions in this
// case should trump the natural dimensions


// TODO: these tests must be rewritten using new approach

// TODO: move this comment somewhere, i dunno, github issue
// TODO: research http://exercism.io/ svg loading issue
// Actually there is now a separate issue. It's not finding any urls. Something
// is up with parsing. Viewing source shows stuff. Actually it might even be in
// fetching it? Yeah, it serves up garbage when I fetch it, completely
// different. Perhaps because of no cookies or some header. So I can't test that
// particular url until I figure out the problem ok the size was getting loaded,
// attribute filter didn't whitelist image sizes

/*
window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_html(request_url);
  const html = await response.text();
  const document = html.parse_html(html);
  const response_url = new URL(response.url);
  set_base_uri(document, response_url);
  await set_image_sizes(document, undefined, is_allowed_request);
};


window.test2 = async function() {
  const html =
      '<html><body><img src="http://exercism.io/icons/brand-logo.svg">' +
      '</body></html>';
  const document = html.parse_html(html);

  set_base_uri(document, new URL('http://exercism.io'));
  await set_image_sizes(document, undefined, is_allowed_request);
};*/


// Simple private helper that abstracts away the extra params
function set_sizes(doc) {
  return set_image_sizes(doc, undefined, url => true);
}

// Simple private helper that loads a local html file, parses it, and sets its
// base uri
async function fetch_local(filename) {
  const path = '/test/set-image-sizes-test/' + filename;
  const url_string = chrome.extension.getURL(path);
  const response = await fetch(url_string);
  const text = await response.text();
  const doc = html.parse_html(text);
  const base_path = '/test/set-image-sizes-test/';
  const base_url_string = chrome.extension.getURL(base_path);
  const base_url = new URL(base_url_string);
  set_base_uri(doc, base_url);
  return doc;
}

register_test(set_image_sizes_basic_test);
