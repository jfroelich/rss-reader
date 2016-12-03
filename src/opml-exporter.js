// See license.md

'use strict';

class OPMLExporter {
  constructor() {
    this.verbose = false;
  }

  exportFile(feeds = [], title = 'Subscriptions', fileName = 'subs.xml') {
    if(this.verbose)
      console.log('Exporting %d feeds to file', feeds.length, fileName);
    const doc = this.createDocument(title);
    const outlines = feeds.map(this.createOutline.bind(this, doc));
    const body = doc.querySelector('body');
    for(let outline of outlines) {
      body.appendChild(outline);
    }

    const blob = this.toXMLBlob(doc);
    const anchor = this.createDownloadAnchor(fileName);
    const objURL = URL.createObjectURL(blob);
    anchor.href = objURL;
    anchor.click();
    URL.revokeObjectURL(objURL);
  }

  createDownloadAnchor(fileName) {
    const anchor = document.createElement('a');
    anchor.setAttribute('download', fileName);
    return anchor;
  }

  toXMLBlob(doc) {
    const writer = new XMLSerializer();
    const opmlString = writer.serializeToString(doc);
    const blob = new Blob([opmlString], {'type': 'application/xml'});
    return blob;
  }

  createDocument(title) {
    const doc = document.implementation.createDocument(null, 'opml', null);
    doc.documentElement.setAttribute('version', '2.0');
    const head = doc.createElement('head');
    doc.documentElement.appendChild(head);
    if(title) {
      const titleEl = doc.createElement('title');
      titleEl.textContent = title;
      head.appendChild(titleEl);
    }
    const currentDate = new Date();
    const currentDateUTC = currentDate.toUTCString();
    const dateCreatedEl = doc.createElement('datecreated');
    dateCreatedEl.textContent = currentDateUTC;
    head.appendChild(dateCreatedEl);
    const dateModifiedEl = doc.createElement('datemodified');
    dateModifiedEl.textContent = currentDateUTC;
    head.appendChild(dateModifiedEl);
    const docs = doc.createElement('docs');
    docs.textContent = 'http://dev.opml.org/spec2.html';
    head.appendChild(docs);
    const body = doc.createElement('body');
    doc.documentElement.appendChild(body);
    return doc;
  }

  createOutline(doc, feed) {
    const outline = doc.createElement('outline');
    if(feed.type)
      outline.setAttribute('type', feed.type);
    const feedURL = Feed.getURL(feed);
    outline.setAttribute('xmlUrl', feedURL);
    if(feed.title) {
      outline.setAttribute('text', feed.title);
      outline.setAttribute('title', feed.title);
    }
    if(feed.description)
      outline.setAttribute('description', feed.description);
    if(feed.link)
      outline.setAttribute('htmlUrl', feed.link);
    return outline;
  }
}
