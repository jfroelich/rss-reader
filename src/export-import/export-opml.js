import {feedPeekURL, getFeeds} from "/src/rdb.js";

// Returns an opml document as a blob that contains outlines representing the feeds
// in the app's db
// @param conn {IDBDatabase} optional
// @param title {String} optional
export default async function exportOPML(conn, title) {
  const feeds = await getFeeds(conn);

  // Create a generic opml document
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

  // Append the feeds to the document as outline elements
  for(const feed of feeds) {
    const outline = doc.createElement('outline');
    if(feed.type) {
      outline.setAttribute('type', feed.type);
    }
    outline.setAttribute('xmlUrl', feedPeekURL(feed));
    if(feed.title) {
      outline.setAttribute('title', feed.title);
    }
    if(feed.description) {
      outline.setAttribute('description', feed.description);
    }
    if(feed.link) {
      outline.setAttribute('htmlUrl', feed.link);
    }

    bodyElement.appendChild(outlineElement);
  }

  // Serialize the document as a string and create and return a blob
  const serializer = new XMLSerializer();
  const string = serializer.serializeToString(doc);
  return new Blob([string], {type: 'application/xml'});
}
