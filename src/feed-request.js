// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedRequest = {};

{ // BEGIN ANONYMOUS NAMESPACE

const map = Array.prototype.map;

// TODO: somehow use responseURL? 
// TODO: intelligently react to redirects
function fetch(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = onFetch.bind(request, url, callback);
  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
}

FeedRequest.fetch = fetch;

function onFetch(url, callback, event) {
  let document = event.target.responseXML;

  if(!document) {
    document = retryMalformedResponse(event.target);
  }

  if(!document || !document.documentElement) {
    callback(event);
    return;
  }

  try {
    const feed = deserialize(document);
    feed.url = url;
    feed.fetched = Date.now();
    
    // TODO: maybe this post-processing is outside the scope
    // of requesting a feed? Maybe these should be the caller's
    // responsibility? Also, it seems like overly tight
    // coupling.

    feed.entries = feed.entries.filter(function(entry) {
      return entry.link;
    });
    
    feed.entries.forEach(function(entry) {
      entry.link = URLUtils.rewrite(entry.link);
    });

    feed.entries = EntryUtils.getUniqueEntries(feed.entries);

    callback(null, feed);
  } catch(exception) {
    // TODO: the type of error passed back as first argument 
    // should be consistent. Mimic an event object here instead
    // of an exception
    callback(exception);
  } 
}

// Private helper for fetch
// responseXML is null when there was an xml parse error
// such as invalid UTF-8 characters. For example:
// error on line 1010 at column 25: Input is not proper UTF-8, 
// indicate encoding ! Bytes: 0x07 0x50 0x72 0x65
// So, access the raw text and try and re-encode and re-parse it
function retryMalformedResponse(response) {

	try {
	  const encoded = utf8.encode(response.responseText);
	  const parser = new DOMParser();
	  const document = parser.parseFromString(encoded, 'application/xml');

	  // XML parsing exceptions are not thrown, they are embedded 
	  // as nodes within the result. Behavior varies by browser.
	  const error = document.querySelector('parsererror');
	  if(error) {
	  	error.remove();
	  }

	  return document;
	} catch(exception) {

	}
}

class FeedRequestError extends Error {
  // TODO: use ES6 rest syntax? Chrome keeps whining
  constructor() {
    super(...arguments);
  }
}

function selectChild(parent, selector) {
  return parent.childNodes.find(function(node) {
    return node.matches(name);
  });
}

function selectChildren(parent, name) {
  return parent.childNodes.filter(function(node) {
    return node.matches(name);
  });
}


// Generates a feed object based on the xml
// TODO: querySelector is not depth-sensitive. Maybe increase 
// the strictness to searching immediate node children
function deserialize(document) {

  const documentElement = document.documentElement;
  validateDocumentElement(documentElement);

  const isAtom = documentElement.matches('feed');
  const isRDF = documentElement.matches('rdf');

  // <channel> is required for feeds and rdf
  if(!isAtom && !document.querySelector(
    documentElement.localName + ' > channel')) {
    throw new FeedRequestError('Missing required channel element');
  }

  const channel = isAtom ? documentElement : 
    //documentElement.querySelector('channel');
    document.querySelector(documentElement.localName + ' > channel');

  const feed = {};

  // TODO: make sure the type values conform to the OPML standard
  // Record the feed's original format as a type property to increase
  // compliance with the OPML standard
  if(isAtom) {
    feed.type = 'feed';
  } else if(isRDF) {
    feed.type = 'rdf';
  } else {
    feed.type = 'rss';
  }

  const getText = getElementText;

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
    entries = documentElement.querySelectorAll('entry');
  } else if(isRDF) {
    entries = documentElement.querySelectorAll('item');
  } else {
    entries = channel.querySelectorAll('item');
  }

  feed.entries = map.call(entries, deserializeEntry.bind(null, isAtom));

  return feed;
}

// Export a global. This is not really used by anything currently 
// in the app but it is available as a standalone feature
FeedRequest.deserialize = deserialize;

function validateDocumentElement(element) {
  if(!element) {
    throw new FeedRequestError('Undefined document element');
  }

  if(!element.matches('feed, rss, rdf')) {
    throw new FeedRequestError('Unsupported document element: ' + 
      element.localName);
  }
}


// Private helper for deserialize, deserializes an item
function deserializeEntry(isAtom, entry) {
  const getText = getElementText;
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

  // NOTE: under dev, untested
  const enclosure = entry.querySelector('enclosure');
  if(enclosure) {
    console.debug('Encountered enclosure: %o', enclosure);
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
}

// Returns the text content of the first element matching the 
// selector within the parent, or undefined
// Private helper for deserialize
function getElementText(parent, selector) {
  const element = parent.querySelector(selector);
  if(element) {
    const text = element.textContent;
    if(text) {
      return text.trim();
    }
  }
}

} // END ANONYMOUS NAMESPACE
