// See license.md

'use strict';

class ResourceLoader {

  static async fetchFeed(url, timeout) {
    const acceptHeader = [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml;q=0.9',
      'text/xml;q=0.8'
    ].join(',');

    const options = {
      'credentials': 'omit',
      'method': 'get',
      'headers': {'Accept': acceptHeader},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };

    const response = await ResourceLoader.fetch(url, options, timeout);
    const statusNoContent = 204;
    if(!response.ok || response.status === statusNoContent)
      throw new Error(`${response.status} ${response.statusText} ${url}`);

    const acceptedTypes = [
      'application/rss+xml',
      'application/rdf+xml',
      'application/atom+xml',
      'application/xml',
      'text/xml',
      'text/html'
    ];
    const type = ResourceLoader.getMimeType(response);
    if(!acceptedTypes.includes(type))
      throw new Error(`Unacceptable content type ${type}`);

    const text = await response.text();
    const parsedFeed = FeedParser.parseFromString(text);

    // TODO: all of this post fetch processing does not belong here
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
    feed.dateLastModified = ResourceLoader.getLastModifiedDate(response);
    return {'feed': feed, 'entries': entries};
  }

  static async fetchHTML(url, timeout) {
    const options = {
      'credentials': 'omit',
      'method': 'get',
      'headers': {'Accept': 'text/html'},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };
    const response = await ResourceLoader.fetch(url, options, timeout);
    const statusNoContent = 204;
    if(!response.ok || response.status === statusNoContent)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    const type = ResourceLoader.getMimeType(response);
    if(type !== 'text/html')
      throw new Error(`Unacceptable mime type ${type}`);

    const text = await response.text();
    const doc = (new DOMParser()).parseFromString(text, 'text/html');
    return {
      'doc': doc,
      'response_url': response.url
    };
  }

  static async fetch(url, options, timeout = 0) {
    let response;
    if(timeout) {
      response = await Promise.race([
        fetch(url, options),
        ResourceLoader.fetchTimeout(url, timeout)
      ]);
    } else {
      response = await fetch(url, options);
    }
    return response;
  }

  static fetchTimeout(url, timeout) {
    return new Promise((_, reject) => {
      const error = new Error(`Request timed out ${url}`);
      setTimeout(reject, timeout, error);
    });
  }

  static getMimeType(response) {
    const contentType = response.headers.get('Content-Type');
    if(!contentType)
      return;
    let type = contentType.trim().toLowerCase();
    const scPos = type.indexOf(';');
    if(scPos !== -1)
      type = type.substring(0, scPos);
    return type.replace(/\s+/g, '');
  }

  static getLastModifiedDate(response) {
    const lastModified = response.headers.get('Last-Modified');
    if(!lastModified)
      return;
    try {
      return new Date(lastModified);
    } catch(error) {
      console.warn(error);
    }
  }
}
