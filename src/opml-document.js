// See license.md

'use strict';

// Represents an OPML document. Provides functions for creating an OPML
// document from an xml string or using a basic template, for appending
// outline elements, and for serializing into a blob
function OPMLDocument() {
  this.doc = null;
}

// Creates and returns a new OPMLDocument instance.
OPMLDocument.parse = function(string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(string, 'application/xml');

  const parser_error_element = doc.querySelector('parsererror');
  if(parser_error_element)
    throw new Error(parser_error_element.textContent);

  const doc_element_name = doc.documentElement.localName.toLowerCase();
  if(doc_element_name !== 'opml')
    throw new Error(`Invalid document element: ${doc_element_name}`);

  const opml_doc = new OPMLDocument();
  opml_doc.doc = doc;
  return opml_doc;
};

// Create and return a new OPMLDocument instance with a default template
OPMLDocument.create = function(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');
  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if(title) {
    const title_element = doc.createElement('title');
    title_element.textContent = title;
    head_element.appendChild(title_element);
  }

  const current_date = new Date();
  const current_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_utc_string;
  head_element.appendChild(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_utc_string;
  head_element.appendChild(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.appendChild(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.appendChild(body_element);

  const opml_doc = new OPMLDocument();
  opml_doc.doc = doc;
  return opml_doc;
};

OPMLDocument.prototype.select_outline_elements = function() {
  return this.doc.querySelectorAll('opml > body > outline');
};

OPMLDocument.prototype.get_outline_objects = function() {
  const elements = this.select_outline_elements();
  const objects = [];
  for(const element of elements)
    objects.push(this.create_outline_object(element));
  return objects;
};

OPMLDocument.prototype.remove_invalid_outline_types = function() {
  const elements = this.select_outline_elements();
  const initial_length = elements.length;
  for(const element of elements) {
    const type_string = element.getAttribute('type');
    if(!type_string) {
      element.remove();
      continue;
    }

    type_string = type_string.trim();
    if(!type_string) {
      element.remove();
      continue;
    }

    if(!/rss|rdf|feed/i.test(type_string)) {
      element.remove();
      continue;
    }
  }

  const remove_count = initial_length - elements.length;
  return remove_count;
};

OPMLDocument.prototype.remove_outlines_missing_xml_urls = function() {
  const elements = this.select_outline_elements();
  const initial_length = elements.length;
  for(const element of elements) {
    const xml_url_string = element.getAttribute('xmlUrl');

    if(!xml_url_string) {
      element.remove();
      continue;
    }
    xml_url_string = xml_url_string.trim();
    if(!xml_url_string) {
      element.remove();
      continue;
    }
  }
  const remove_count = initial_length - elements.length;
  return remove_count;
};

OPMLDocument.prototype.normalize_outline_xml_urls = function() {
  const elements = this.select_outline_elements();
  const initial_length = elements.length;
  for(const element of elements) {
    const url_string = element.getAttribute('xmlUrl');
    if(url_string === undefined || url_string === null)
      continue;
    url_string = url_string.trim();
    if(!url_string.length) {
      element.removeAttribute('xmlUrl');
      continue;
    }

    try {
      const url_object = new URL(url_string);
      const normal_url_string = url_object.href;
      element.setAttribute('xmlUrl', normal_url_string);
    } catch(error) {
      element.removeAttribute('xmlUrl');
    }
  }
};

OPMLDocument.prototype.append_outline_object = function(outline_object) {
  const outline_element = this.create_outline_element(outline_object);
  this.append_outline_element(outline_element);
};

OPMLDocument.prototype.append_outline_element = function(outline_element) {
  let body_element = this.doc.querySelector('body');

  if(!body_element) {
    body_element = this.doc.createElement('body');
    this.doc.documentElement.appendChild(body_element);
  }

  body_element.appendChild(outline_element);
};

OPMLDocument.prototype.create_outline_element = function(outline_object) {
  const outline_element = this.doc.createElement('outline');
  if(outline_object.type)
    outline_element.setAttribute('type', outline_object.type);
  if(outline_object.xmlUrl)
    outline_element.setAttribute('xmlUrl', outline_object.xmlUrl);
  if(outline_object.text)
    outline_element.setAttribute('text', outline_object.text);
  if(outline_object.title)
    outline_element.setAttribute('title', outline_object.title);
  if(outline_object.description)
    outline_element.setAttribute('description', outline_object.description);
  if(outline_object.htmlUrl)
    outline_element.setAttribute('htmlUrl', outline_object.htmlUrl);
  return outline_element;
};

OPMLDocument.prototype.create_outline_object = function(outline_element) {
  const outline_object = {};
  outline_object.description = outline_element.getAttribute('description');
  outline_object.htmlUrl = outline_element.getAttribute('htmlUrl');
  outline_object.text = outline_element.getAttribute('text');
  outline_object.title = outline_element.getAttribute('title');
  outline_object.type = outline_element.getAttribute('type');
  outline_object.xmlUrl = outline_element.getAttribute('xmlUrl');
  return outline_object;
};

OPMLDocument.prototype.to_string = function() {
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(this.doc);
  return opmlString;
};
