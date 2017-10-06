'use strict';

// TODO: in hindsight, deprecate. This feels not the C way.

// Represents an OPML document and provides utilities for working with opml
// documents. Essentially wraps an XML document.
class OPMLDocument {

  // Creates a new opml document. If doc is provided then it is used as the
  // wrapped xml document. If not provided then a basic xml document is created
  // internally with a default opml template.
  constructor(doc) {
    this.doc = doc || this.createTemplate();
  }

  // Change the value of the title element
  updateTitle(title) {
    let title_element = this.doc.querySelector('title');
    if(title) {
      if(!title_element) {
        title_element = this.doc.createElement('title');
        const head_element = this.doc.querySelector('head');
        head_element.appendChild(title_element);
      }

      title_element.textContent = title;
    } else {
      if(title_element)
        title_element.remove();
    }
  }

  // Returns a new xml document containing basic xml tags and no outlines
  createTemplate() {
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

  selectOutlineElements() {
    return this.doc.querySelectorAll('opml > body > outline');
  }

  getOutlineObjects() {
    const elements = this.selectOutlineElements();
    const objects = [];
    for(const element of elements)
      objects.push(this.createOutlineObject(element));
    return objects;
  }

  // TODO: This does not belong here
  removeInvalidOutlineTypes() {
    const elements = this.selectOutlineElements();
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

  // TODO: This does not belong here
  removeOutlinesMissingXMLUrls() {
    const elements = this.selectOutlineElements();
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
    const remove_count = initial_length - elements.length;
    return remove_count;
  }

  // TODO: This does not belong here
  normalizeOutlineXMLUrls() {
    const elements = this.selectOutlineElements();
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

  appendOutlineObject(outline_object) {
    const outline_element = this.createOutlineElement(outline_object);
    this.appendOutlineElement(outline_element);
  }

  appendOutlineElement(outline_element) {
    let body_element = this.doc.querySelector('body');
    if(!body_element) {
      body_element = this.doc.createElement('body');
      this.doc.documentElement.appendChild(body_element);
    }

    body_element.appendChild(outline_element);
  }

  createOutlineElement(outline_object) {
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
  }

  createOutlineObject(outline_element) {
    const outline_object = {};
    outline_object.description = outline_element.getAttribute('description');
    outline_object.htmlUrl = outline_element.getAttribute('htmlUrl');
    outline_object.text = outline_element.getAttribute('text');
    outline_object.title = outline_element.getAttribute('title');
    outline_object.type = outline_element.getAttribute('type');
    outline_object.xmlUrl = outline_element.getAttribute('xmlUrl');
    return outline_object;
  }
}
