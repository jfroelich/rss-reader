// See license.md

'use strict';

class ResourceLoader {

  constructor(log) {
    this.log = log || {
      'log': function(){},
      'debug': function(){},
      'warn': function(){},
      'error': function(){}
    };
  }

  // Throws if the url is not a valid url string
  // @param url {String}
  assertValidURL(url) {
    if(typeof url !== 'string' || !url.length)
      throw new TypeError(`Invalid url ${url}`);
  }

  // Returns a promise that rejects after a delay in milliseconds
  fetchTimeout(url, timeout) {
    return new Promise((_, reject) => {
      const error = new Error(`Request timed out ${url}`);
      setTimeout(reject, timeout, error);
    });
  }

  // Throws an exception if the response's Content-Type header does not
  // represent an XML resource. This also allows for html.
  assertResponseTypeIsXML(url, response) {
    const types = [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml',
      'text/xml',
      'text/html'
    ];

    let typeHeader = response.headers.get('Content-Type') || '';
    const scPos = typeHeader.indexOf(';');
    if(scPos !== -1)
      typeHeader = typeHeader.substring(0, scPos);
    typeHeader = typeHeader.trim().toLowerCase();
    if(!types.includes(typeHeader))
      throw new Error(`Invalid content type ${typeHeader} ${url}`);
  }

  buildFeedAcceptHeader() {
    return [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml;q=0.9',
      'text/xml;q=0.8'
    ].join(',');
  }

  getResponseLastModifiedDate(response) {
    const lastModified = response.headers.get('Last-Modified');
    if(!lastModified)
      return;
    try {
      return new Date(lastModified);
    } catch(error) {
      this.log.warn(error);
    }
  }

  async fetch(url, options, timeout) {
    const method = options.method || 'GET';
    this.log.log(method.toUpperCase(), url);

    let response;
    if(timeout) {
      const promises = [fetch(url, options), this.fetchTimeout(url, timeout)];
      response = await Promise.race(promises);
    } else {
      response = await fetch(url, options);
    }
    return response;
  }

  buildFetchFeedOptions() {
    return {
      'credentials': 'omit',
      'method': 'get',
      'headers': {'Accept': this.buildFeedAcceptHeader()},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };
  }

  // Resolves with a basic object with properties feed and entries
  // @param url {String}
  // @param timeout {Number}
  async fetchFeed(url, timeout = 0) {
    this.assertValidURL(url);
    const options = this.buildFetchFeedOptions();
    const response = await this.fetch(url, options, timeout);
    if(!response.ok || response.status === 204)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    this.assertResponseTypeIsXML(url, response);
    const text = await response.text();
    const parsedFeed = FeedParser.parseFromString(text);
    const entries = parsedFeed.entries;
    const feed = parsedFeed;
    delete feed.entries;

    // Supply a default date for the feed
    feed.datePublished = feed.datePublished || new Date();

    // Normalize the feed's link value
    if(feed.link) {
      try {
        feed.link = new URL(feed.link).href;
      } catch(error) {
        console.warn(error);
        delete feed.link;
      }
    }

    // Suppy a default date for entries
    entries.filter((e)=> !e.datePublished).forEach((e) =>
      e.datePublished = feed.datePublished);

    // Convert entry.link into entry.urls array
    // TODO: decouple Entry.addURL
    entries.forEach((e) => {
      if(!e.link) return;
      Entry.addURL(e, e.link);
      delete e.link;
    });

    // TODO: decouple Feed.addURL
    Feed.addURL(feed, url);
    Feed.addURL(feed, response.url);
    feed.dateFetched = new Date();
    feed.dateLastModified = this.getResponseLastModifiedDate(response);
    return {'feed': feed, 'entries': entries};
  }

  buildFetchHTMLOptions() {
    return {
      'credentials': 'omit',
      'method': 'get',
      'headers': {'Accept': 'text/html'},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };
  }

  assertResponseTypeIsHTML(url, response) {
    let type = response.headers.get('Content-Type');
    type = type || '';
    type = type.trim();
    type = type.toLowerCase();

    if(!type.includes('text/html'))
      throw new Error(`Invalid mime type ${type} ${url}`);
  }

  // Returns a Document object or throws an error. When a timeout occurs, the
  // fetch is not canceled, but this still rejects early.
  async fetchHTML(url, timeout = 0) {
    this.assertValidURL(url);
    const options = this.buildFetchHTMLOptions();
    const response = await this.fetch(url, options, timeout);
    if(!response.ok || response.status === 204)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    this.assertResponseTypeIsHTML(url, response);

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const docElement = doc.documentElement;
    if(docElement.localName.toLowerCase() !== 'html')
      throw new Error(`Invalid document element ${docElement.nodeName} ${url}`);
    return {
      'doc': doc,
      'response_url': response.url
    };
  }
}
