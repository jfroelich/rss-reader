import {condense_whitespace} from '/src/condense-whitespace.js';

// TODO: while these are indeed all opml related functions, opml is highly
// unlikely to change. i think each of the two dependencies on this module do
// not share usage of these functions, they each use there own function that
// happens to be located in this module. this smells like bad coupling.
// therefore, this module should be broken up into individual components

export function create_opml_template(document_title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (document_title) {
    const title_element = doc.createElement('title');
    title_element.textContent = document_title;
  }

  const current_date = new Date();
  const current_date_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_date_utc_string;
  head_element.appendChild(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_date_utc_string;
  head_element.appendChild(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.appendChild(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.appendChild(body_element);
  return doc;
}

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
