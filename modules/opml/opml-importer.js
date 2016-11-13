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

  // Convenience function to avoid demeter issue
  async connect() {
    await this.subService.connect();
  }

  // Convenience function to avoid demeter issue
  close() {
    this.subService.close();
  }

  // @param files {FileList} - file list such as from input element
  async importFiles(files) {
    this.log.log('Starting opml import');

    if(!files || !('length' in files))
      throw new TypeError('Invalid files parameter ' + files);

    const filesArray = [...files];
    const proms = filesArray.map((file) => this.importFileNoRaise(file), this);
    const resolutions = await Promise.all(proms);
    const numSubs = resolutions.reduce((n, c) => n + c, 0);
    this.log.debug('Import completed, subscribed to %d feeds', numSubs);
  }

  // Decorates importFiles so that this can be used together with Promise.all
  // by suppressing errors to avoid Promise.all's failfast behavior.
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
    if(file.size < 1)
      throw new TypeError(`"${file.name}" is empty`);
    if(!OPMLImporter.isSupportedFileType(file.type))
      throw new TypeError(`"${file.name}" unsupported type "${file.type}"`);

    const text = await OPMLImporter.readFileAsText(file);
    this.log.debug('Read %d characters of file %s', text.length, file.name);
    const doc = OPMLImporter.parseFromString(text);
    let outlines = OPMLImporter.selectOutlines(doc);
    this.log.debug('Found %d outline elements in file %s',
      outlines.length, file.name);

    // Map outline elements to basic outline objects
    outlines = outlines.map((o) => {
      return {
        'description': o.getAttribute('description'),
        'link': o.getAttribute('htmlUrl'),
        'text': o.getAttribute('text'),
        'title': o.getAttribute('title'),
        'type': o.getAttribute('type'),
        'url': o.getAttribute('xmlUrl')
      };
    });

    // Filter outlines with invalid urls or types
    outlines = outlines.filter((o) => /rss|rdf|feed/i.test(o.type));
    outlines = outlines.filter((o) => o.url);
    outlines = outlines.filter((o) => {
      try {
        const url = new URL(o.url);
        o.url = url.href;
        return true;
      } catch(error) {
        this.log.warn(error);
      }
      return false;
    });

    // Exit earlier in the case of no valid outlines
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

    // Normalize outline link urls and remove invalid ones
    outlines.forEach((o) => {
      if(o.link) {
        try {
          const url = new URL(o.link);
          o.link = url.href;
        } catch(error) {
          this.log.warn(error);
          o.link = undefined;
        }
      }
    });

    const feeds = outlines.map((o) => {
      const feed = {
        'type': o.type,
        'urls': [],
        'title': o.title || o.text,
        'description': o.description,
        'link': o.link
      };
      Feed.addURL(feed, o.url);
      return feed;
    });

    this.log.debug('Attempting to subscribe to %d feeds from OPML file %s',
      feeds.length, file.name);
    const proms = feeds.map((feed) => this.subscribe(feed), this);
    const resolutions = await Promise.all(proms);
    return resolutions.reduce((n, result) => result ? n + 1 : n, 0);
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
    const root_name = doc.documentElement.localName;
    if(root_name !== 'opml')
      throw new Error(`Invalid document element: ${root_name}`);
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
    const body = doc.querySelector('body');
    if(!body)
      return [];
    const outlines = [];
    for(let el = body.firstElementChild; el; el = el.nextElementSibling) {
      if(el.localName.toLowerCase() === 'outline')
        outlines.push(el);
    }
    return outlines;
  }
}
