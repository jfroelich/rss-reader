import * as Status from "/src/common/status.js";

// Parses an xml string into an xml-flagged document. Returns an array of status, document object,
// and error message. Partial xml is implicitly converted into a full document.
export default function parseXML(xmlString) {
  if(typeof xmlString !== 'string') {
    throw new TypeError('Expected string, got ' + typeof xmlString);
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(xmlString, 'application/xml');
  const error = document.querySelector('parsererror');

  return error ? [Status.XML_PARSE_ERROR, null, error.textContent.replace(/\s{2,}/g, ' ')] :
    [Status.OK, document];
}
