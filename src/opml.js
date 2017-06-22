// See license.md

'use strict';

const opml = {};

opml.parseFromString = function(string) {
  const parser = new DOMParser();
  const documentObject = parser.parseFromString(string, 'application/xml');

  const errorElement = documentObject.querySelector('parsererror');
  if(errorElement) {
    throw new Error(errorElement.textContent);
  }

  const documentElementName = documentObject.documentElement.localName;
  if(documentElementName !== 'opml')
    throw new Error(`Invalid document element: ${documentElementName}`);
  return documentObject;
};

opml.selectOutlineElements = function(documentObject) {
  const outlineList = documentObject.querySelectorAll(
    'opml > body > outline');
  return [...outlineList];
};

opml.appendFeeds = function(documentObject, feedArray) {
  const bodyElement = documentObject.querySelector('body');
  for(let feedObject of feedArray) {
    const outlineElement = opml.createOutlineElementFromFeed(documentObject,
      feedObject);
    bodyElement.appendChild(outlineElement);
  }
};

opml.toBlob = function(documentObject) {
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(documentObject);
  const blobObject = new Blob([opmlString], {'type': 'application/xml'});
  return blobObject;
};


// Creates a Document object of type xml that generally follows the OPML spec,
// without any outline elements in its body.
opml.createDocument = function(titleString) {
  const documentObject = document.implementation.createDocument(
    null, 'opml', null);

  documentObject.documentElement.setAttribute('version', '2.0');

  const headElement = documentObject.createElement('head');
  documentObject.documentElement.appendChild(headElement);

  if(titleString) {
    const titleElement = documentObject.createElement('title');
    titleElement.textContent = titleString;
    headElement.appendChild(titleElement);
  }

  const currentDate = new Date();
  const currentDateUTCString = currentDate.toUTCString();

  const dateCreatedElement = documentObject.createElement('datecreated');
  dateCreatedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = documentObject.createElement('datemodified');
  dateModifiedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = documentObject.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = documentObject.createElement('body');
  documentObject.documentElement.appendChild(bodyElement);
  return documentObject;
};

opml.createOutlineElementFromFeed = function(documentObject, feedObject) {
  const outlineElement = documentObject.createElement('outline');

  // Only set the type if it is known
  if(feedObject.type) {
    outlineElement.setAttribute('type', feedObject.type);
  }

  // This url corresponds to the fetchable location of the feed itself
  const feedURLString = feedGetURLString(feedObject);
  outlineElement.setAttribute('xmlUrl', feedURLString);

  // Set both title and text, if available
  if(feedObject.title) {
    outlineElement.setAttribute('text', feedObject.title);
    outlineElement.setAttribute('title', feedObject.title);
  }

  // Set description if known
  if(feedObject.description) {
    outlineElement.setAttribute('description', feedObject.description);
  }

  // This url corresponds to the feed's declared associated website
  // link is a url string
  if(feedObject.link) {
    outlineElement.setAttribute('htmlUrl', feedObject.link);
  }

  return outlineElement;
};

opml.createOutlineObject = function(outlineElement) {
  return {
    'description': outlineElement.getAttribute('description'),
    'link': outlineElement.getAttribute('htmlUrl'),
    'text': outlineElement.getAttribute('text'),
    'title': outlineElement.getAttribute('title'),
    'type': outlineElement.getAttribute('type'),
    'url': outlineElement.getAttribute('xmlUrl')
  };
};

opml.createFeed = function(outlineObject) {
  const feedObject = {
    'type': outlineObject.type,
    'urls': [],
    'title': outlineObject.title || outlineObject.text,
    'description': outlineObject.description,
    'link': outlineObject.link
  };
  jrAddFeedURL(feedObject, outlineObject.url);
  return feedObject;
};
