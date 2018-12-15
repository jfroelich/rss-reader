import assert from '/src/assert.js';
import {filter_lazy_images} from '/src/base/filter-lazy-images.js';
import {parse_html} from '/src/base/parse-html.js';
import {filter_dead_images} from '/src/base/sandoc/filter-dead-images.js';
import {fetch_html} from '/src/control/fetch-html.js';

// TODO: depending on fetch-html is a dependency violation. this cannot rely
// on a module located in a higher layer. therefore, i need a lower layer
// implementation of fetch html. I think a quick intermediate solution is to
// implement a dumb local version of this, but the problem with that might be
// that i get divergent behavior, and divergent behavior is precisely the thing
// you want to avoid when writing tests.

// TODO: rewrite in new test format
// TODO: rewrite without input, load a local file internally

export async function filter_lazy_images_test(url_string) {
  /*
    const request_url = new URL(url_string);
    const response = await fetch_html(request_url);
    const response_text = await response.text();
    const document = parse_html(response_text);
    filter_lazy_images(document);

    // Call this subsequently because it prints out missing images
    // filter_dead_images(document);
  */
}
