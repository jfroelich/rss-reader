// See license.md

'use strict';

class OPMLImporter {

  constructor() {
    this.log = {
      'log': function(){},
      'debug': function(){},
      'warn': function(){},
      'error': function(){}
    };

    this.subService = new SubscriptionService();
    this.subService.suppressNotifications = true;
  }

  // @param files {Iterable<File>} - e.g. FileList
  async importFiles(files) {
    this.log.log('Starting opml import');
    if(!files || !('length' in files))
      throw new TypeError('Invalid files parameter ' + files);
    const filesArray = [...files];
    const proms = filesArray.map(this.importFileNoRaise, this);
    const resolutions = await Promise.all(proms);
    const numSubs = resolutions.reduce((n, c) => n + c, 0);
    this.log.debug('Imported %d feeds', numSubs);
  }

  // Decorates importFile to avoid Promise.all failfast behavior
  async importFileNoRaise(file) {
    let numSubs = 0;
    try {
      numSubs = await this.importFile(file);
    } catch(error) {
      this.log.warn(error);
    }
    return numSubs;
  }

  // Returns number of feeds added
  async importFile(file) {
    this.log.debug('Importing OPML file "%s", byte size %d, mime type "%s"',
      file.name, file.size, file.type);
    this.assertImportableFile(file);
    const text = await OPMLImporter.readFileAsText(file);
    const doc = OPMLImporter.parseFromString(text);
    let outlines = OPMLImporter.selectOutlines(doc);
    outlines = outlines.map(this.createOutline, this);
    outlines = outlines.filter(this.outlineHasValidType, this);
    outlines = outlines.filter(this.outlineHasURL, this);
    outlines = outlines.filter(this.transformOutlineURL, this);
    if(!outlines.length)
      return 0;

    // Filter duplicates, favoring earlier in document order
    const uniqueURLs = [];
    outlines = outlines.filter((o) => {
      if(!uniqueURLs.includes(o.url)) {
        uniqueURLs.push(o.url);
        return true;
      }
      return false;
    });

    outlines.forEach(this.normalizeOutlineLink, this);
    const feeds = outlines.map(this.createFeed, this);
    const proms = feeds.map(this.subscribe, this);
    const resolutions = await Promise.all(proms);
    return resolutions.reduce((n, result) => result ? n + 1 : n, 0);
  }

  async connect() {
    await this.subService.connect();
  }

  close() {
    this.subService.close();
  }

  createOutline(outline) {
    return {
      'description': outline.getAttribute('description'),
      'link': outline.getAttribute('htmlUrl'),
      'text': outline.getAttribute('text'),
      'title': outline.getAttribute('title'),
      'type': outline.getAttribute('type'),
      'url': outline.getAttribute('xmlUrl')
    };
  }

  transformOutlineURL(outline) {
    try {
      const url = new URL(outline.url);
      outline.url = url.href;
      return true;
    } catch(error) {
      this.log.warn(error);
    }
    return false;
  }

  outlineHasValidType(outline) {
    return /rss|rdf|feed/i.test(outline.type);
  }

  outlineHasURL(outline) {
    return outline.url;
  }

  normalizeOutlineLink(outline) {
    if(outline.link) {
      try {
        const url = new URL(outline.link);
        outline.link = url.href;
      } catch(error) {
        this.log.warn(error);
        outline.link = undefined;
      }
    }
  }

  createFeed(outline) {
    const feed = {
      'type': outline.type,
      'urls': [],
      'title': outline.title || outline.text,
      'description': outline.description,
      'link': outline.link
    };
    Feed.addURL(feed, outline.url);
    return feed;
  }

  assertImportableFile(file) {
    if(file.size < 1)
      throw new TypeError(`"${file.name}" is empty`);
    if(!OPMLImporter.isSupportedFileType(file.type))
      throw new TypeError(`"${file.name}" has unsupported type "${file.type}"`);
  }


  // Returns the result of subscribe, which is the added feed object, or null
  // if an error occurs. This wraps so that it can be used with Promise.all
  async subscribe(feed) {
    try {
      return await this.subService.subscribe(feed);
    } catch(error) {
      this.log.warn(error);
    }
    return null;
  }

  static isSupportedFileType(fileType) {
    const supportedTypes = ['application/xml', 'text/xml'];
    let normType = fileType || '';
    normType = normType.trim().toLowerCase();
    return supportedTypes.includes(normType);
  }

  static parseFromString(str) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'application/xml');
    const error = doc.querySelector('parsererror');
    if(error)
      throw new Error(error.textContent);
    const rootName = doc.documentElement.localName;
    if(rootName !== 'opml')
      throw new Error(`Invalid document element: ${rootName}`);
    return doc;
  }

  static readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
    });
  }

  static selectOutlines(doc) {
    const outlineNodeList = doc.querySelectorAll('opml > body > outline');
    return [...outlineNodeList];
  }
}
