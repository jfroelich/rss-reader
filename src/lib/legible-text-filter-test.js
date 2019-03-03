import {assert} from '/src/lib/assert.js';
import {parse_html} from '/src/lib/html-utils.js';
import * as ltf from '/src/lib/legible-text-filter.js';

export async function legible_text_filter_test() {
  let input = '<p style="font-size:10px">some text</p>';
  let doc = parse_html(input);
  let font_size = ltf.get_element_font_size(doc.querySelector('p'));
  console.debug('p1 font size', font_size);
  let average_font_size = ltf.calc_avg_font_size(doc);
  console.debug('Average font size', average_font_size);

  const p2 = doc.createElement('p');
  p2.appendChild(doc.createTextNode('p2'));
  p2.attributeStyleMap.set('font-size', '20px');
  doc.body.appendChild(p2);

  font_size = ltf.get_element_font_size(p2);
  console.debug('p2 font size', font_size);
  average_font_size = ltf.calc_avg_font_size(doc);
  console.debug('Average font size', average_font_size);

  const p3 = doc.createElement('p');
  p3.appendChild(doc.createTextNode('p3'));
  p3.attributeStyleMap.set('font-size', '50%');
  doc.body.appendChild(p3);
  font_size = ltf.get_element_font_size(p3);
  console.debug('p3 font size', font_size);
  average_font_size = ltf.calc_avg_font_size(doc);
  console.debug('Average font size', average_font_size);
}
