import assert from '/src/assert/assert.js';
import {fetch_html} from '/src/fetch-html/fetch-html.js';
import * as html from '/src/html/html.js';
import {filter_dead_images} from '/src/sandoc/filter-dead-images.js';

import {filter_lazy_images} from './filter-lazy-images.js';

// TODO: rewrite in new test format
// TODO: rewrite without input, load a local file internally

export async function filter_lazy_images_test(url_string) {
  /*
    const request_url = new URL(url_string);
    const response = await fetch_html(request_url);
    const response_text = await response.text();
    const document = html.parse_html(response_text);
    filter_lazy_images(document);

    // Call this subsequently because it prints out missing images
    // filter_dead_images(document);
  */
}
