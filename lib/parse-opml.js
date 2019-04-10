export function parse_opml(xml_string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new OPMLParseError(message);
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new OPMLParseError('Document element is not opml: ' + name);
  }

  return document;
}

export class OPMLParseError extends Error {
  constructor(message = 'OPML parse error') {
    super(message);
  }
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
