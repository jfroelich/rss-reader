import {feedPeekURL, getFeeds, isFeed} from "/src/rdb.js";

// TODO: work with elements directly, skip the outline-object intermediate stuff, it is legacy
// code from when i thought a different style of coherency was a good thing, but all it did was
// split up code that changes together.

// Returns an opml document as a blob that contains outlines representing the feeds
// in the app's db
// @param feeds {Array}
// @param title {String} optional
export default function exportFeeds(conn, title) {
  const feeds = await getFeeds(conn);
  const document = createDocumentAndAppendFeeds(feeds, title);
  return xmlToBlob(document);
}

// Create a new OPML document
// @param title {String} optional document title
// @return {Document} an xml-flagged document
function createOPMLDocument(title) {
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

  const titleElement = doc.createElement('title');
  if(title) {
    titleElement.textContent = title;
  }

  const currentDate = new Date();
  const currentUTCString = currentDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = currentUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = currentUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.appendChild(bodyElement);

  return doc;
}

function createDocumentAndAppendFeeds(feeds, title) {
  const doc = createOPMLDocument(title);
  for(const feed of feeds) {
    appendOutlineObject(doc, outlineFromFeed(feed));
  }
  return doc;
}

// Create an outline from a feed
function outlineFromFeed(feed) {
  assert(isFeed(feed));
  const outline = {};
  outline.type = feed.type;
  outline.xmlUrl = feedPeekURL(feed);
  outline.title = feed.title;
  outline.description = feed.description;
  outline.htmlUrl = feed.link;
  return outline;
}

function getOutlineObjects(doc) {
  const elements = getOutlineElements(doc);
  const objects = [];
  for(const element of elements) {
    objects.push(outlineElementToObject(element));
  }
  return objects;
}

function getOutlineElements(doc) {
  assert(doc instanceof Document);
  return doc.querySelectorAll('opml > body > outline');
}

function appendOutlineObject(doc, outline) {
  appendOutlineElement(doc, outlineObjectToElement(doc, outline));
}

function appendOutlineElement(doc, element) {
  assert(doc instanceof Document);
  let bodyElement = doc.querySelector('body');
  if(!bodyElement) {
    bodyElement = doc.createElement('body');
    doc.documentElement.appendChild(bodyElement);
  }
  bodyElement.appendChild(element);
}

function isOutline(outline) {
  return typeof outline === 'object' && outline !== null;
}



function outlineObjectToElement(doc, outline) {
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

function outlineElementToObject(element) {
  const object = {};
  object.description = element.getAttribute('description');
  object.htmlUrl = element.getAttribute('htmlUrl');
  object.text = element.getAttribute('text');
  object.title = element.getAttribute('title');
  object.type = element.getAttribute('type');
  object.xmlUrl = element.getAttribute('xmlUrl');
  return object;
}

function xmlToBlob(document) {
  assert(document instanceof Document);
  const serializer = new XMLSerializer();
  const string = serializer.serializeToString(document);
  return new Blob([string], {type: 'application/xml'});
}

function assert(value, message) {
  if(!value) throw new Error(message || 'Assertion error');
}
