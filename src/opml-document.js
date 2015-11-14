// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// An in-memory OPMLDocument object
// TODO: maybe extend Document? Research how to extend native/host/builtin
class OPMLDocument {

  // Returns a new OPMLDocument by parsing the given string as XML
  // Throws an exception if various errors occur
  static parse(string) {
    const parser = new DOMParser();
    const MIME_TYPE = 'application/xml';
    const document = parser.parseFromString(string, MIME_TYPE);

    if(!document) {
      throw new Error('Invalid document');
    }

    if(!document.documentElement) {
      throw new Error('Invalid document: No document element');
    }

    if(!document.documentElement.matches('opml')) {
      throw new Error('Invalid document element: ' + 
        document.documentElement.localName);
    }

    // NOTE: parsing errors are actually embedded within the 
    // document itself instead of being thrown. Search for the error
    // and throw it
    const parsererror = document.querySelector('parsererror');
    if(parsererror) {
      throw new Error(parsererror.textContent);
    }

    return new OPMLDocument(document);
  }

  // Returns true if the element appears to be a minimally valid
  // outline element
  static isValidOutline(element) {
    const TYPE_PATTERN = /rss|rdf|feed/i;
    const type = element.getAttribute('type');
    const url = element.getAttribute('xmlUrl') || '';
    return TYPE_PATTERN.test(type) && url.trim();
  }

  // Creates a feed object from an outline element
  static createFeed(element) {
    const outline = {};

    let title = element.getAttribute('title') || '';
    title = title.trim();
    if(!title) {
      title = element.getAttribute('text') || '';
      title = title.trim();
    }
    title = StringUtils.stripControlCharacters(title);
    if(title) {
      outline.title = title;
    }

    let description = element.getAttribute('description');
    if(description) {
      description = StringUtils.stripControlCharacters(description);
    }
    if(description) {
      description = StringUtils.removeTags(description);
    }
    if(description) {
      description = description.trim();
    }
    if(description) {
      outline.description = description;
    }

    let url = element.getAttribute('xmlUrl') || '';
    url = StringUtils.stripControlCharacters(url);
    url = url.trim();
    if(url) {
      outline.url = url;
    }

    let link = element.getAttribute('htmlUrl') || '';
    link = StringUtils.stripControlCharacters(link);
    link = link.trim();
    if(link) {
      outline.link = link;
    }
    return outline;
  }

  // Returns a new instance of an empty XML document
  static _createDocument() {
    return document.implementation.createDocument(null, null);
  }

  // Creates a new OPMLDocument that wraps a Document or 
  // creates a new document
  constructor(document) {
  	if(document) {
      this.document = document;
    } else {
      const create = this.createElement;
      this.document = this._createDocument();
      const documentElement = create('opml');
      documentElement.setAttribute('version', '2.0');
      this.document.appendChild(documentElement);
      const head = create('head');
      documentElement.appendChild(head);
      // TODO: maybe do not create title element by default
      const titleElement = create('title');
      head.appendChild(titleElement);
      const nowString = (new Date()).toUTCString();
      const dateCreated = create('dateCreated');
      dateCreated.textContent = nowString;
      head.appendChild(dateCreated);
      // TODO: maybe do not create dateModified element by default
      const dateModified = create('dateModified');
      dateModified.textContent = nowString;
      head.appendChild(dateModified);
      const docs = create('docs');
      docs.textContent = 'http://dev.opml.org/spec2.html';
      head.appendChild(docs);
      const body = create('body');
      documentElement.appendChild(body);
    }
  }

  get internal() {
    return this.document;
  }

  // Returns the document as a string
  toString() {
    const writer = new XMLSerializer();
    return writer.serializeToString(this.document);
  }

  // Returns the document as a blob
  toBlob() {
    const string = this.toString();
    const blob = new Blob([string], {type: 'application/xml'});
    return blob;
  }

  get body() {
    return this.document.querySelector('opml > body');
  }

  get head() {
    return this.document.querySelector('opml > head');
  }

  get documentElement() {
    return this.document.documentElement;
  }

  createElement(name) {
    return this.document.createElement(name);
  }

  querySelector(selector) {
    return this.document.querySelector(selector);
  }

  // Sets the title element's value
  // TODO: update dateModified as a side effect?
  // TODO: verify that documentElement corresponds to <opml>?
  setTitle(titleString) {
    let title = this.querySelector('head > title');
    if(!titleString) {
      if(title) {
        title.remove();
      }
    } else {
      this._ensureHeadElement();
      if(!title) {
        title = this.createElement('title');
        this.head.appendChild(title);
      }
      
      title.textContent = titleString;
    }
  }

  // Private helper than ensures a head element exists
  _ensureHeadElement() {
    let head = this.querySelector('opml > head');
    if(!head) {
      head = this.createElement('head');
      // TODO: maybe ensure before body
      this.documentElement.appendChild(head);
    }
  }

  // Private helper than ensures a body element exists
  _ensureBodyElement() {
    let body = this.querySelector('opml > body');
    if(!body) {
      body = this.createElement('body');
      // TODO: maybe ensure after head
      this.documentElement.appendChild(body);
    }
  }

  // Appends a feed object to the document as an outline element
  // NOTE: does not verify whether the feed has a link
  // TODO: update dateModified as a side effect
  appendFeed(feed) {

    const outline = this.createElement('outline');

    // TODO: validate type?
    if(feed.type) {
      outline.setAttribute('type', feed.title);
    } else {
      // Set a default type. Note that for now we are not storing 
      // feed.type so this always is set to rss.
      outline.setAttribute('type', 'rss');
    }

    outline.setAttribute('xmlUrl', feed.url);
    if(feed.title) {
      outline.setAttribute('text', feed.title);
      outline.setAttribute('title', feed.title);
    }
    if(feed.description) {
      outline.setAttribute('description', feed.description);
    }
    if(feed.link) {
      outline.setAttribute('htmlUrl', feed.link);
    }

    this._ensureBodyElement();
    this.body.appendChild(outline);  
  }

  // Returns an array of feeds. Only includes outlines that 
  // have URLs
  getFeeds() {
    const wrapped = HTMLDocumentWrapper.wrap(this.document);
    const outlines = wrapped.querySelectorAll(
      'opml > body > outline');
    return outlines.filter(OPMLDocument.isValidOutline).map(
      OPMLDocument.createFeed);
  }
}
