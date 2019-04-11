export function Outline() {
  // The feed type (e.g. rss/atom)
  this.type = undefined;
  // The url of the feed xml file
  this.xml_url = undefined;
  // The title of the feed
  this.title = undefined;
  // The textual description of the feed
  this.description = undefined;
  // A related website location
  this.html_url = undefined;
}

// Returns an in memory OPML document object filled with the given outlines.
// |document_title| is optional dom string (set by textContent).
export async function export_opml(outlines, document_title) {
  const doc = create_opml_template(document_title);
  const body_element = doc.querySelector('body');
  body_element.append('\n');  // pretty print

  for (const outline of outlines) {
    const element = doc.createElement('outline');
    maybe_set(element, 'type', outline.type);
    maybe_set(element, 'xmlUrl', outline.xml_url);
    maybe_set(element, 'title', outline.title);
    maybe_set(element, 'description', outline.description);
    maybe_set(element, 'htmlUrl', outline.html_url);
    body_element.append(element);
    body_element.append('\n');  // pretty print
  }

  return doc;
}

function maybe_set(element, name, value) {
  if (value) {
    element.setAttribute(name, value);
  }
}

function create_opml_template(document_title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const head_element = doc.createElement('head');
  doc.documentElement.append(head_element);

  if (document_title) {
    const title_element = doc.createElement('title');
    title_element.append(document_title);
    head_element.append(title_element);
  }

  const current_date = new Date();
  const current_date_utc_string = current_date.toUTCString();

  const date_created_element = doc.createElement('datecreated');
  date_created_element.textContent = current_date_utc_string;
  head_element.append(date_created_element);

  const date_modified_element = doc.createElement('datemodified');
  date_modified_element.textContent = current_date_utc_string;
  head_element.append(date_modified_element);

  const docs_element = doc.createElement('docs');
  docs_element.textContent = 'http://dev.opml.org/spec2.html';
  head_element.append(docs_element);

  const body_element = doc.createElement('body');
  doc.documentElement.append(body_element);
  return doc;
}
