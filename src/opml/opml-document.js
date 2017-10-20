'use strict';

// import base/assert.js
// import base/debug.js
// import base/status.js
// import markup/xml.js

function opml_parse_from_string(xml_string) {
  let [status, doc] = xml_parse_from_string(xml_string);
  if(status !== STATUS_OK) {
    DEBUG('xml parse error');
    return [status];
  }

  const name = doc.documentElement.localName.toLowerCase();
  if(name !== 'opml') {
    DEBUG('documentElement not opml:', name);
    return [ERR_DOM];
  }

  return [STATUS_OK, doc];
}

function opml_document_set_title(doc, title) {
  // TODO: use document_is_document
  ASSERT(doc);

  const t_title = typeof title;
  ASSERT(t_title === 'undefined' || t_title === 'string');

  let title_element = doc.querySelector('title');
  if(title) {
    if(!title_element) {
      title_element = doc.createElement('title');
      const head_element = doc.querySelector('head');

      // TODO: instead of failing on not finding <head>, create
      // <head> if needed

      if(!head_element) {
        DEBUG('missing head element');
        return ERR_DOM;
      }

      head_element.appendChild(title_element);
    }

    title_element.textContent = title;
  } else {
    if(title_element)
      title_element.remove();
  }

  return STATUS_OK;
}

function opml_document_create() {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

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

  return doc;
}

function opml_get_outline_elements(doc) {
  // TODO: use document_is_document
  ASSERT(doc);
  return doc.querySelectorAll('opml > body > outline');
}

function opml_get_outline_objects(doc) {
  const elements = opml_get_outline_elements(doc);
  const objects = [];
  for(const element of elements)
    objects.push(outline_element_to_object(element));
  return objects;
}

function opml_remove_outlines_with_invalid_types(doc) {

  // TODO: use document_is_document
  ASSERT(doc);

  const elements = opml_get_outline_elements(doc);

  const initial_length = elements.length;
  for(const element of elements) {
    if(!outline_element_has_valid_type(element)) {
      element.remove();
    }
  }

  return initial_length - elements.length;
}

function opml_remove_outlines_missing_xmlurls(doc) {

  // TODO: use document_is_document
  ASSERT(doc);

  const outlines = opml_get_outline_elements(doc);
  for(const outline of outlines) {
    if(!outline_element_has_xmlurl(outline)) {
      outline.remove();
    }
  }
  return STATUS_OK;
}

function opml_normalize_outline_xmlurls(doc) {

  // TODO: use document_is_document
  ASSERT(doc);

  const outlines = opml_get_outline_elements(doc);
  for(const outline of outlines) {
    outline_element_normalize_xmlurl(outline);
  }
  return STATUS_OK;
}

function opml_document_append_outline_object(doc, outline) {
  opml_append_outline_element(doc, outline_to_element(doc, outline));
}

function opml_append_outline_element(doc, element) {

  // TODO: use document_is_document
  ASSERT(doc);

  let body_element = doc.querySelector('body');
  if(!body_element) {
    body_element = doc.createElement('body');
    doc.documentElement.appendChild(body_element);
  }

  body_element.appendChild(element);
}
