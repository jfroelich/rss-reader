export function parse(html_string) {
  if (typeof html_string !== 'string') {
    throw new TypeError('html_string is not a string');
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html_string, 'text/html');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(error.textContent.replace(/\s{2,}/g, ' '));
  }
  return document;
}
