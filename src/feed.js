// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class Feed {

  // TODO: somehow use responseURL? 
  // TODO: intelligently react to redirects
  static fetch(url, timeout, callback) {
    const request = new XMLHttpRequest();
    request.timeout = timeout;
    request.onerror = callback;
    request.ontimeout = callback;
    request.onabort = callback;
    request.onload = Feed._onFetch.bind(request, url, callback);
    request.open('GET', url, true);
    request.overrideMimeType('application/xml');
    request.send();
  }

  static _onFetch(url, callback, event) {
    const document = event.target.responseXML;
    if(!document || !document.documentElement) {
      callback(event);
      return;
    }

    try {
      const feed = Feed.fromXML(document);
      feed.url = url;
      feed.fetched = Date.now();
      feed.entries = feed.entries.filter(function(entry) {
        return entry.link;
      });
      feed.entries.forEach(function(entry) {
        entry.link = URLUtils.rewrite(entry.link);
      });
      feed.entries = ArrayUtils.unique(feed.entries);
      callback(null, feed);
    } catch(exception) {
      callback(exception);
    } 
  }

  static findByURL(connection, url, callback) {
    const transaction = connection.transaction('feed');
    const urls = transaction.objectStore('feed').index('schemeless');
    const request = urls.get(URLUtils.getSchemeless(url));
    request.onsuccess = callback;
  }

  static findById(connection, id, callback) {
    const transaction = connection.transaction('feed');
    const feeds = transaction.objectStore('feed');
    const request = feeds.get(id);
    request.onsuccess = callback;
  }

  static forEach(connection, handleFeed, sortByTitle, callback) {
    const transaction = connection.transaction('feed');
    transaction.oncomplete = callback;

    let feeds = transaction.objectStore('feed');
    if(sortByTitle) {
      feeds = feeds.index('title');
    }

    const request = feeds.openCursor();
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(cursor) {
        handleFeed(cursor.value);
        cursor.continue();        
      }
    };
  }

  // TODO: check last modified date of the remote xml file to avoid 
  // pointless updates?
  // TODO: ensure the date is not beyond the current date?
  // TODO: maybe not modify date updated if not dirty
  static put(connection, original, feed, callback) {
    const storable = {};
    if(original) {
      storable.id = original.id;
    }
    storable.url = feed.url;
    if(original) {
      storable.schemeless = original.schemeless;
    } else {
      storable.schemeless = URLUtils.getSchemeless(storable.url);
    }

    const title = Feed.sanitizeValue(feed.title);
    storable.title = title || '';

    const description = Feed.sanitizeValue(feed.description);
    if(description) {
      storable.description = description;
    }

    const link = Feed.sanitizeValue(feed.link);
    if(link) {
      storable.link = link;
    }

    if(feed.date) {
      storable.date = feed.date;
    }

    if(feed.fetched) {
      storable.fetched = feed.fetched;
    }

    if(original) {
      storable.updated = Date.now();
      storable.created = original.created;
    } else {
      storable.created = Date.now();
    }

    // TODO: just use transaction.oncomplete ?
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.put(storable);
    request.onsuccess = function(event) {
      callback();
    };
    request.onerror = function(event) {
      console.debug('Error putting feed %s', JSON.stringify(storable));
      console.dir(event);
      callback();
    };
  }

  // TODO: sanitize html entities?
  static sanitizeValue(value) {
    if(value) {
      value = StringUtils.removeTags(value);
      value = StringUtils.stripControlCharacters(value);
      value = value.replace(/\s+/, ' ');
      value = value.trim();
      return value;
    }
  }

  static remove(connection, id, callback) {
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.delete(id);
    request.onsuccess = callback;
  }

  // TODO: deprecate
  static unsubscribe(connection, id, callback) {
    Feed.remove(connection, id, function(event) {
      Entry.removeByFeed(connection, id, callback);
    });
  }

  // TODO: support Apple iTunes format, embedded media format (??)
  // TODO: store original format as a property
  static fromXML(document) {

    const getText = Feed._getText;

    const root = document.documentElement;
    if(!root) {
      throw new TypeError('Undefined document element');
    }

    if(!root.matches('feed, rss, rdf')) {
      throw new TypeError('Unsupported document element: ' + root.localName);
    }

    const isAtom = root.matches('feed');
    const isRDF = root.matches('rdf');

    // throw exception here?
    if(!isAtom && !root.querySelector('channel')) {
      return {
        entries: []
      };
    }

    const channel = isAtom ? root : root.querySelector('channel');

    const feed = {};
    const title = getText(channel, 'title');
    if(title) {
      feed.title = title;
    }

    const description = getText(channel, isAtom ? 'subtitle' : 'description');
    if(description) {
      feed.description = description;
    }

    const dateUpdated = isAtom ? getText(channel, 'updated') : 
      (getText(channel, 'pubdate') || getText(channel, 'lastBuildDate') ||
      getText(channel, 'date'));
    if(dateUpdated) {
      feed.date = dateUpdated;
    }

    let link = '';
    if(isAtom) {
      link = channel.querySelector('link[rel="alternate"]') || 
        channel.querySelector('link[rel="self"]') ||
        channel.querySelector('link[href]');
      if(link) {
        link = link.getAttribute('href');
      }
    } else {
      link = getText(channel, 'link:not([href])');
      if(!link) {
        link = channel.querySelector('link');
        if(link) {
          link = link.getAttribute('href');
        }
      }
    }
    if(link) {
      link = link.trim();
    }
    if(link) {
      feed.link = link;
    }

    let entries = [];
    if(isAtom) {
      entries = root.querySelectorAll('entry');
    } else if(isRDF) {
      entries = root.querySelectorAll('item');
    } else {
      entries = channel.querySelectorAll('item');
    }

    const map = Array.prototype.map;

    feed.entries = map.call(entries, function(entry) {
      const result = {};
      const title = getText(entry, 'title');
      if(title) {
        result.title = title;
      }

      const author = isAtom ? getText(entry, 'author name') : 
        (getText(entry, 'creator') || getText(entry, 'publisher'));
      if(author) {
        result.author = StringUtils.removeTags(author, ' ');
      }

      let link = '';
      if(isAtom) {
        link = entry.querySelector('link[rel="alternate"]') || 
          entry.querySelector('link[rel="self"]') ||
          entry.querySelector('link[href]');
        if(link) {
          link = link.getAttribute('href');
        }
      } else {
        link = getText(entry, 'origLink') || getText(entry, 'link');
      }
      if(link) {
        link = link.trim();
      }
      if(link) {
        result.link = link;
      }

      let date = '';
      if(isAtom) {
        date = entry.querySelector('published') || entry.querySelector('updated');
        if(date) {
          date = date.textContent;
        }
      } else {
        date = getText(entry, 'pubDate') || getText(entry, 'date');
      }
      if(date) {
        date = date.trim();
      }
      if(date) {
        result.pubdate = date;
      }

      if(isAtom) {
        // Special handling for some strange issue
        const content = entry.querySelector('content');
        const nodes = content ? content.childNodes : [];
        result.content = map.call(nodes, function(node) {
          return node.nodeType === Node.ELEMENT_NODE ?
            node.innerHTML : node.textContent;
        }).join('').trim();
      } else {
        const content = getText(entry, 'encoded') || 
          getText(entry, 'description') || getText(entry, 'summary');
        if(content) {
          result.content = content;
        }
      }

      return result;
    });

    return feed;
  }

  static _getText(parent, selector) {
    const element = parent.querySelector(selector);
    if(element) {
      const text = element.textContent;
      if(text) {
        return text.trim();
      }
    }
  }
}
