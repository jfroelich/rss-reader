// Parses an xml string into a Document object (that is internally xml-flagged).
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
