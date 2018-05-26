const XML_MIME_TYPE = 'application/xml';

/*

# xml-parser

### TODOs
* Make exceptionless. One idea is that this just wraps domparser call, and
provides a separate helper method that accepts a document and returns whether
the document has a parsererror element. The caller can avoid using try/catch.
The caller can ignore errors by not calling the helper. Or the caller can check
for errors by calling the helper. The helper would return boolean.


*/

export function parse(xml_string) {
  if (typeof xml_string !== 'string') {
    throw new TypeError('xml_string is not a String');
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, XML_MIME_TYPE);
  const error = document.querySelector('parsererror');
  if (error) {
    const pretty_message = error.textContent.replace(/\s{2,}/g, ' ');
    throw new Error(pretty_message);
  }
  return document;
}
