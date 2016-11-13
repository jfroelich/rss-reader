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
    this.feedDb = null;
  }

  // @param files {FileList} - file list such as from input element
  async importFiles(files) {
    this.log.log('Starting opml import');

    if(!this.feedDb)
      throw new Error('this.feedDb is undefined');

    if(!files || !('length' in files))
      throw new TypeError('Invalid files parameter ' + files);

    let iconConn;
    let numSubs = 0;
    try {
      iconConn = await Favicon.connect();
      const filesArray = [...files];
      const proms = filesArray.map(
        (file) => this.importFileNoRaise(iconConn, file), this);
      const resolutions = await Promise.all(proms);
      numSubs = resolutions.reduce((n, c) => n + c, 0);
    } finally {
      if(iconConn)
        iconConn.close();
    }

    this.log.debug('Import completed, subscribed to %d feeds', numSubs);
  }

  // Returns number of feeds subscribed
  // Suppresses errors to avoid Promise.all failfast behavior
  async importFileNoRaise(iconConn, file) {
    try {
      return await this.importFile(iconConn, file);
    } catch(error) {
      this.log.warn(error);
    }
    return 0;
  }

  // Returns number of feeds subscribed
  async importFile(iconConn, file) {
    this.log.debug('Importing OPML file "%s", byte size %d, mime type "%s"',
      file.name, file.size, file.type);
    if(file.size < 1) {
      this.log.warn('Not importing file %s because it has size %d',
        file.name, file.size);
      return 0;
    }

    const fileType = this.normalizeFileType(file.type);
    if(!this.isSupportedFileType(fileType)) {
      this.log.warn('Not importing file %s because invalid file type',
        file.name, file.type);
      return 0;
    }

    const text = await this.readFileAsText(file);
    this.log.debug('Read %d characters of file %s', text.length, file.name);
    const doc = this.parseFromString(text);
    let outlines = this.selectOutlines(doc);
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

    // Filter duplicates, favoring earlier in document order
    const uniqueURLs = [];
    outlines = outlines.filter((o) => {
      if(!uniqueURLs.includes(o.url)) {
        uniqueURLs.push(o.url);
        return true;
      }
      return false;
    });

    // Normalize outline link urls
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
    const proms = feeds.map((feed) => this.subscribe(iconConn, feed), this);
    const resolutions = await Promise.all(proms);
    return resolutions.reduce((n, result) => result ? n + 1 : n, 0);
  }

  // Returns the result of subscribe, which is the added feed object, or null
  // if an error occurs
  async subscribe(iconConn, feed) {
    const suppressNotif = true;
    try {
      return await subscribe(this.feedDb, iconConn, feed, suppressNotif,
        this.log);
    } catch(error) {
      this.log.warn(error);
    }
    return null;
  }

  isSupportedFileType(typeString) {
    const supportedTypes = {
      'text/xml': undefined,
      'application/xml': undefined
    };
    return typeString in supportedTypes;
  }

  normalizeFileType(typeString) {
    let output = typeString || '';
    return output.trim().toLowerCase();
  }

  parseFromString(str) {
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

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
    });
  }

  selectOutlines(doc) {
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
