const XML_MIME_TYPE = 'application/xml';

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
