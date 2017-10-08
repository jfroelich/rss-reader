// Library for working with opml documents
// Dependencies:
// assert.js
// debug.js
// status.js
// xml.js

// Parses the input string and returns a document
function opml_parse_from_string(xml_string) {
  'use strict';
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

// Updates the title of an opml document
// @param doc {Document} an opml document
// @param title {String} optional
function opml_update_title(doc, title) {
  'use strict';
  ASSERT(doc);
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

// Returns a new xml document containing basic xml tags and no outlines
function opml_create_document() {
  'use strict';
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

// Returns a list of outline elements in the document. Only outlines in
// the proper location are included.
// @param doc {Document}
// @returns {NodeList}
function opml_get_outline_elements(doc) {
  'use strict';
  ASSERT(doc);
  return doc.querySelectorAll('opml > body > outline');
}

function opml_get_outline_objects(doc) {
  'use strict';
  const elements = opml_get_outline_elements(doc);
  const objects = [];
  for(const element of elements)
    objects.push(opml_create_outline_object(element));
  return objects;
}

function opml_remove_outlines_with_invalid_types(doc) {
  'use strict';
  ASSERT(doc);

  const elements = opml_get_outline_elements(doc);

  const initial_length = elements.length;
  for(const element of elements) {
    let type_string = element.getAttribute('type');
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

  return initial_length - elements.length;
}

function opml_remove_outlines_missing_xmlurls(doc) {
  'use strict';
  const elements = opml_get_outline_elements(doc);

  const initial_length = elements.length;
  for(const element of elements) {
    let xml_url_string = element.getAttribute('xmlUrl');

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
  return initial_length - elements.length;
}

function opml_normalize_outline_xmlurls(doc) {
  'use strict';
  const elements = opml_get_outline_elements(doc);

  const initial_length = elements.length;
  for(const element of elements) {
    let url_string = element.getAttribute('xmlUrl');
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
}

function opml_append_outline_object(doc, outline) {
  'use strict';
  const element = opml_create_outline_element(doc, outline);
  opml_append_outline_element(doc, element);
}

function opml_append_outline_element(doc, element) {
  'use strict';
  let body_element = doc.querySelector('body');
  if(!body_element) {
    body_element = doc.createElement('body');
    doc.documentElement.appendChild(body_element);
  }

  body_element.appendChild(element);
}

function opml_create_outline_element(doc, object) {
  'use strict';
  const element = doc.createElement('outline');
  if(object.type)
    element.setAttribute('type', object.type);
  if(object.xmlUrl)
    element.setAttribute('xmlUrl', object.xmlUrl);
  if(object.text)
    element.setAttribute('text', object.text);
  if(object.title)
    element.setAttribute('title', object.title);
  if(object.description)
    element.setAttribute('description', object.description);
  if(object.htmlUrl)
    element.setAttribute('htmlUrl', object.htmlUrl);
  return element;
}

// Converts an opml outline element into a basic outline object
// @param element {Element}
// @returns {Object}
// This coerces as is, if there are bad values in the element then bad values
// will be in the object
function opml_create_outline_object(element) {
  'use strict';
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
