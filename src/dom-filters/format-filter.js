import {unwrap_element} from '/src/dom-utils/unwrap-element.js';

const formatting_elements_selector = [
  'abbr', 'acronym', 'center', 'data', 'details', 'help', 'insert', 'legend',
  'mark', 'marquee', 'meter', 'nobr', 'span', 'big', 'blink', 'font',
  'plaintext', 'small', 'tt'
].join(',');

export function format_filter(document) {
  if (document.body) {
    const elements =
        document.body.querySelectorAll(formatting_elements_selector);
    for (const element of elements) {
      unwrap_element(element);
    }
  }
}
