// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FaviconService {
  constructor() {
    this.timeout = null;
    this.cache = new FaviconCache();
    this.cache.name = 'favicon-cache';
    this.minLength = 50;
    this.maxLength = 10000;
    this.expiresAfterMillis = 1000 * 60 * 60 * 24 * 30;
  }

  lookup(url, document, callback) {
    console.debug('Looking up favicon for', url.href);
    const context = {
      'url': url,
      'callback': callback,
      'document': document,
      'connection': null,
      'entry': null
    };

    if(this.cache) {
      console.debug('Detected cache', this.cache.name);
      this.cache.connect(this.onConnect.bind(this, context));
    } else if(document) {
      const iconURL = this.findIconURLInDocument(document, url);
      if(iconURL) {
        console.debug('Found icon in prefetched document without cache',
          iconURL.href);
        callback(iconURL);
      } else {
        console.debug('Did not find icon in prefetched document without cache');
        this.fetchDocument(context);
      }
    } else {
      console.debug('No cache or prefetched document, falling back to fetch');
      this.fetchDocument(context);
    }
  }

  onConnect(context, connection) {
    const boundOnFindByURL = this.onFindByURL.bind(this, context);
    if(connection) {
      context.connection = connection;
      if(context.document) {
        const iconURL = this.findIconURLInDocument(context.document,
          context.url);
        if(iconURL) {
          console.debug('Caching from prefetched document',
            context.url.href, iconURL.href);
          this.cache.addEntry(connection, context.url, iconURL);
          context.callback(iconURL);
        } else {
          console.debug(
            'Did not find icon in prefetched document, checking cache');
          this.cache.findByPageURL(connection, context.url, boundOnFindByURL);
        }
      } else {
        console.debug('No prefetched document, checking cache',
          context.url.href);
        this.cache.findByPageURL(context.connection, context.url,
          boundOnFindByURL);
      }
    } else if(context.document) {
      const iconURL = this.findIconURLInDocument(context.document, url);
      if(iconURL) {
        console.error('Connection error, found icon in prefetched document',
          context.url.href, iconURL.href);
        context.callback(iconURL);
      } else {
        console.error('Connection error, did not find ' +
          'icon in prefetched document, fetching', context.url.href);
        this.fetchDocument(context);
      }
    } else {
      console.error('Connection error, missing prefetched ' +
        'document, fetching', context.url.href);
      this.fetchDocument(context);
    }
  }

  onFindByURL(context, entry) {
    if(entry && !this.isEntryExpired(entry)) {
      console.debug('Cache hit', context.url.href, entry.iconURLString);
      context.connection.close();
      const iconURL = new URL(entry.iconURLString);
      context.callback(iconURL);
    } else {
      console.debug('Cache miss', context.url.href);
      context.entry = entry;
      this.fetchDocument(context);
    }
  }

  isEntryExpired(entry) {
    return (new Date() - entry.dateUpdated) >= this.expiresAfterMillis;
  }

  fetchDocument(context) {
    if('onLine' in navigator && !navigator.onLine) {
      console.warn('Offline, unable to fetch %s', context.url.href);
      if(context.connection) {
        context.connection.close();
      }
      if(context.entry) {
        console.debug('Offline, falling back to expired entry', context.entry);
        context.callback(new URL(context.entry.iconURLString));
      } else {
        context.callback();
      }
      return;
    }

    console.debug('Fetching %s to search for favicons', context.url.href);
    const boundOnFetch = this.onFetchDocument.bind(this, context);
    const request = new XMLHttpRequest();
    request.timeout = this.timeout;
    request.responseType = 'document';
    request.onerror = boundOnFetch;
    request.ontimeout = boundOnFetch;
    request.onabort = boundOnFetch;
    request.onload = boundOnFetch;
    request.open('GET', context.url.href, true);
    request.setRequestHeader('Accept', 'text/html');
    request.send();
  }

  onFetchDocument(context, event) {
    if(event.type !== 'load') {
      console.debug(event.status, event.type, context.url.href);
      if(context.connection && context.entry) {
        this.cache.deleteByPageURL(context.connection, context.url);
      }
      this.lookupOrigin(context, null);
      return;
    }

    const document = event.target.responseXML;
    const responseURL = new URL(event.target.responseURL);

    if(!document) {
      console.debug('Fetched document is undefined', context.url.href);
      this.lookupRedirectURL(context, new URL(responseURL));
      return;
    }

    console.debug(event.type, event.target.status, context.url.href);
    const iconURL = this.findIconURLInDocument(document, responseURL);
    if(iconURL) {
      console.debug('Found icon in page', context.url.href, iconURL.href);
      if(context.connection) {
        this.cache.addEntry(context.connection, context.url, iconURL);
        if(responseURL.href !== context.url.href) {
          this.cache.addEntry(context.connection, responseURL,
            iconURL);
        }

        // TODO: I should also add origin url here if it is distinct?

        context.connection.close();
      }
      context.callback(iconURL);
    } else {
      console.debug('No icons found in page', context.url.href);
      this.lookupRedirectURL(context, new URL(responseURL));
    }
  }

  lookupRedirectURL(context, redirectURL) {
    if(context.connection && redirectURL &&
      redirectURL.href !== context.url.href) {
      console.debug('Looking up redirect', redirectURL.href);
      this.cache.findByPageURL(context.connection, redirectURL,
        this.onLookupRedirectURL.bind(this, context, redirectURL));
    } else {
      this.lookupOrigin(context, redirectURL);
    }
  }

  onLookupRedirectURL(context, redirectURL, entry) {
    if(entry && !this.isEntryExpired(entry)) {
      console.debug('Found redirect entry', entry);
      context.connection.close();
      context.callback(new URL(entry.iconURLString));
    } else {
      console.debug('Did not find redirect', redirectURL.href);
      this.lookupOrigin(context, redirectURL);
    }
  }

  findIconURLInDocument(document, baseURL) {
    console.debug('Searching for icons in page', baseURL.href);

    if(document.documentElement.localName !== 'html') {
      console.debug('Document is not HTML', baseURL.href,
        document.documentElement.localName);
      return;
    }

    const headElement = document.head;
    if(!headElement) {
      console.debug('Missing <head>', baseURL.href);
      return;
    }

    const selectors = [
      'link[rel="icon"][href]',
      'link[rel="shortcut icon"][href]',
      'link[rel="apple-touch-icon"][href]',
      'link[rel="apple-touch-icon-precomposed"][href]'
    ];

    // NOTE: that it is important to check if href is defined and not empty in
    // the loop because otherwise this could pass an empty string to new URL
    // which would lead to creating a valid url that is just the base url
    // itself.

    for(let selector of selectors) {
      const element = headElement.querySelector(selector);
      if(element) {
        const href = (element.getAttribute('href') || '').trim();
        if(href) {
          try {
            const iconURL = new URL(href, baseURL);
            console.debug('Found element identifying favicon',
              element.outerHTML);
            return iconURL;
          } catch(exception) {
            console.warn(exception);
          }
        }
      }
    }
  }

  isOriginURLDistinct(pageURL, redirectURL, originURL) {
    return originURL.href !== pageURL.href &&
      (!redirectURL || redirectURL.href !== originURL.href);
  }

  lookupOrigin(context, redirectURL) {
    const originURL = new URL(context.url.origin);
    const originIconURL = new URL(context.url.origin + '/favicon.ico');
    if(context.connection &&
      this.isOriginURLDistinct(context.url, redirectURL, originURL)) {
      console.debug('Searching cache for origin', originURL.href);
      this.cache.findByPageURL(context.connection, originURL,
        this.onLookupOrigin.bind(this, context, redirectURL));
    } else {
      this.sendImageHeadRequest(originIconURL,
        this.onFetchOriginIcon.bind(this, context, redirectURL));
    }
  }

  onLookupOrigin(context, redirectURL, entry) {
    const originIconURL = new URL(context.url.origin + '/favicon.ico');
    if(entry && !this.isEntryExpired(entry)) {
      console.debug('Found origin entry in cache', entry);

      // The origin already exists, so we need to store a link between
      // context.url and the icon url. There could already be an entry, but
      // we only reach here if there is no entry in the cache or there is an
      // entry in the cache but it expired. In either case, calling
      // cache.addEntry executes store.put. If an entry with the same pageURL
      // exists then that entry will be replaced. If there is no entry with
      // the same pageURL, then an entry will be added. If replacing the entry,
      // this essentially just means we are updating its dateUpdated field,
      // so that future cache lookups will hit because the entry will no longer
      // be considered expired.
      const iconURL = new URL(entry.iconURLString);
      if(context.url.href !== context.url.origin) {
        this.cache.addEntry(context.connection, context.url, iconURL);
      }
      context.connection.close();
      context.callback(iconURL);
    } else {
      this.sendImageHeadRequest(originIconURL,
        this.onFetchOriginIcon.bind(this, context, redirectURL));
    }
  }

  onFetchOriginIcon(context, redirectURL, iconURLString) {
    const originURL = new URL(context.url.origin);

    if(iconURLString) {
      const iconURL = new URL(iconURLString);
      if(context.connection) {
        this.cache.addEntry(context.connection, context.url, iconURL);
        if(redirectURL && redirectURL.href !== context.url.href) {
          this.cache.addEntry(context.connection, redirectURL, iconURL);
        }
        if(this.isOriginURLDistinct(context.url, redirectURL, originURL)) {
          this.cache.addEntry(context.connection, originURL, iconURL);
        }

        context.connection.close();
      }

      context.callback(iconURL);
    } else {
      if(context.connection) {
        this.cache.deleteByPageURL(context.connection, context.url);
        if(redirectURL && redirectURL.href !== context.url.href) {
          this.cache.deleteByPageURL(context.connection, redirectURL);
        }

        if(this.isOriginURLDistinct(context.url, redirectURL, originURL)) {
          this.cache.deleteByPageURL(context.connection, originURL);
        }

        context.connection.close();
      }

      context.callback();
    }
  }

  sendImageHeadRequest(imageURL, callback) {
    console.debug('HEAD', imageURL.href);
    const onResponse = this.onImageHeadResponse.bind(this, imageURL, callback);
    const request = new XMLHttpRequest();
    request.timeout = this.timeout;
    request.ontimeout = onResponse;
    request.onerror = onResponse;
    request.onabort = onResponse;
    request.onload = onResponse;
    request.open('HEAD', imageURL.href, true);
    request.setRequestHeader('Accept', 'image/*');
    request.send();
  }

  onImageHeadResponse(imageURL, callback, event) {
    const contentLength = event.target.getResponseHeader('Content-Length');
    const contentType = event.target.getResponseHeader('Content-Type');
    console.debug('HEAD', imageURL.href, event.type, event.target.status,
      contentType, contentLength);
    if(event.type === 'load' && this.isContentLengthInRange(contentLength) &&
      this.isMimeTypeImage(contentType)) {
      callback(event.target.responseURL);
    } else {
      callback();
    }
  }

  isContentLengthInRange(contentLengthString) {
    try {
      const numBytes = parseInt(contentLengthString, 10);
      return numBytes >= this.minLength && numBytes <= this.maxLength;
    } catch(exception) {
      console.warn(exception);
    }
  }

  isMimeTypeImage(mimeTypeString) {
    return /^\s*image\//i.test(mimeTypeString);
  }
}
