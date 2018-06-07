// Generates an opml document object populated with the given outlines. Only
// outlines with an html_url value are included. Outline objects have the
// following properties (all strings): type, xml_url, title, description, and
// html_url.
// @param outlines {Array} optional, an array of outline objects to append
// @param title {String} optional, value of title element (not validated)
// @return {Document}
export function create_opml_document(outlines = [], title = 'Untitled') {
  const document = create_template(title);
  // document.body only works for html-flagged, this is xml-flagged
  const body_element = document.querySelector('body');
  for (const outline of outlines) {
    if (outline.xml_url) {
      body_element.appendChild(create_outline_element(document, outline));
    }
  }

  return document;
}

// Create a basic opml document template
function create_template(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.appendChild(head_element);

  if (title) {
    const title_element = doc.createElement('title');
    title_element.textContent = title;
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

// Create an xml element from an outline object
function create_outline_element(document, outline) {
  // SEC: use host document, not script container
  const elm = document.createElement('outline');
  set_attr_if_defined(elm, 'type', outline.type);
  set_attr_if_defined(elm, 'xmlUrl', outline.xml_url);
  set_attr_if_defined(elm, 'title', outline.title);
  set_attr_if_defined(elm, 'description', outline.description);
  set_attr_if_defined(elm, 'htmlUrl', outline.html_url);
  return elm;
}

function set_attr_if_defined(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}
