// Parses an xml string into a Document object (that is internally xml-flagged).
// TODO: make exceptionless. One idea is that this just wraps domparser call,
// and provides a separate helper method that accepts a document and returns
// whether the document has a parsererror element. The caller can avoid using
// try/catch. The caller can ignore errors by not calling the helper. Or the
// caller can check for errors by calling the helper. The helper would return
// boolean.
// TODO: reintroduce condense-whitespace helper, depend on the string library
export function parse_xml(xml_string) {
  if (typeof xml_string !== 'string') {
    throw new TypeError('xml_string is not a String');
  }

  const xml_mime_type = 'application/xml';

  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, xml_mime_type);
  const error = document.querySelector('parsererror');
  if (error) {
    const pretty_message = error.textContent.replace(/\s{2,}/g, ' ');
    throw new Error(pretty_message);
  }
  return document;
}
