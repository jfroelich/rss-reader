function parse_html(html) {
  'use strict';
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const parser_error_element = document.querySelector('parsererror');
  if(parser_error_element)
    throw new Error(parser_error_element.textContent);
  return document;
}
