import {assert} from '/src/lib/assert.js';
import {parse_html} from '/src/lib/html-utils.js';
import {calc_avg_font_size, get_element_font_size, legible_text_filter} from '/src/lib/legible-text-filter.js';

export async function legible_text_filter_test() {
  let input = '<p style="font-size:10px">some text</p>';
  let doc = parse_html(input);
  let font_size = get_element_font_size(doc.querySelector('p'));
  console.debug('First paragraph font size', font_size);
  let average_font_size = calc_avg_font_size(doc);
  console.debug('Average font size', average_font_size);
}
