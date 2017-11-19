// OPML outline utilities

// TODO: I am tempted to create the class OPMLOutline. But I have to resolve the issue that some
// of these functions operate on elements. So maybe they are out of place, or maybe I should not
// try. Or, I should create the class and functions operating on elements should be refactored to
// operate on class properties.

import assert from "/src/utils/assert.js";

export function isOutline(outline) {
  return typeof outline === 'object';
}

export function elementHasValidType(element) {
  assert(element instanceof Element);
  const TYPE_PATTERN = /\s*(rss|rdf|feed)\s*/i;
  return TYPE_PATTERN.test(element.getAttribute('type'));
}

export function elementHasXMLURL(element) {
  const xmlUrl = element.getAttribute('xmlUrl');
  return xmlUrl && xmlUrl.trim();
}

export function elementNormalizeXMLURL(element) {
  let url = element.getAttribute('xmlUrl');
  if(url) {
    try {
      const urlObject = new URL(url);
      element.setAttribute('xmlUrl', urlObject.href);
    } catch(error) {
      element.removeAttribute('xmlUrl');
    }
  }
}

export function normalizeHTMLURL(outline) {
  assert(isOutline(outline));

  if(outline.htmlUrl === undefined) {
    return;
  }

  // Setting to undefined is preferred over deleting in order to maintain v8 object shape
  if(outline.htmlUrl === null) {
    outline.htmlUrl = undefined;
    return;
  }

  if(outline.htmlUrl === '') {
    outline.htmlUrl = undefined;
    return;
  }

  try {
    const urlObject = new URL(outline.htmlUrl);
    outline.htmlUrl = urlObject.href;
  } catch(error) {
    outline.htmlUrl = undefined;
  }
}

export function toElement(doc, outline) {
  assert(doc instanceof Document);
  assert(isOutline(outline));

  const element = doc.createElement('outline');
  if(outline.type) {
    element.setAttribute('type', outline.type);
  }

  if(outline.xmlUrl) {
    element.setAttribute('xmlUrl', outline.xmlUrl);
  }

  if(outline.text) {
    element.setAttribute('text', outline.text);
  }

  if(outline.title) {
    element.setAttribute('title', outline.title);
  }

  if(outline.description) {
    element.setAttribute('description', outline.description);
  }

  if(outline.htmlUrl) {
    element.setAttribute('htmlUrl', outline.htmlUrl);
  }

  return element;
}

export function fromElement(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}
