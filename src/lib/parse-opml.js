// TODO: recouple with parseXML, this should merely decorate it with the extra check

export default function parseOPML(xmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xmlString, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const message = condenseWhitespace(error.textContent);
    throw new OPMLParseError(message);
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new OPMLParseError(`Document element is not opml: ${name}`);
  }

  return document;
}

export class OPMLParseError extends Error {
  constructor(message = 'OPML parse error') {
    super(message);
  }
}

function condenseWhitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
