import assert from '/src/assert.js';
import * as simple_filters from '/src/dom-filters/simple-filters.js';
import * as net from '/src/net.js';
import {parse_html} from '/src/utils.js';

// TODO: depending on fetch-html is a dependency violation. this cannot rely
// on a module located in a higher layer. therefore, i need a lower layer
// implementation of fetch html. I think a quick intermediate solution is to
// implement a dumb local version of this, but the problem with that might be
// that i get divergent behavior, and divergent behavior is precisely the thing
// you want to avoid when writing tests.
// TODO: rewrite in new test format
// TODO: rewrite without input, load a local file internally

export async function image_lazy_filter_test(url_string) {
  // const request_url = new URL(url_string);
  // const response = await net.fetch_html(request_url);
  // const response_text = await response.text();
  // const document = parse_html(response_text);
  // simple_filters.image_lazy_filter(document);
  // Call this subsequently because it prints out missing images
  // simple_filters.image_dead_filter(document);
}
