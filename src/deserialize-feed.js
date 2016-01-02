// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: querySelector is not depth-sensitive. Maybe increase
// the strictness to searching immediate node children

// TODO: rather than return a basic javascript object, perhaps a Map
// would be more appropriate?

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

// Derives a feed object from an xml document
function deserializeFeed(document) {

  const documentElement = document.documentElement;
  validateDocumentElement(documentElement);

  const isAtom = documentElement.matches('feed');
  const isRDF = documentElement.matches('rdf');

  // <channel> is required for feeds and rdf
  if(!isAtom && !document.querySelector(
    documentElement.localName + ' > channel')) {
    throw new DeserializeError('Missing required channel element');
  }

  const channel = isAtom ? documentElement :
    document.querySelector(documentElement.localName + ' > channel');

  const feed = {};

  // Ensure the type values conform to the OPML standard
  // Record the feed's original format as a type property to increase
  // compliance with the OPML standard
  // TODO: in order for this to matter, feed loading and updating and so
  // forth needs to maintain the type property, which i don't think is
  // currently implemented
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

  const map = Array.prototype.map;

  feed.entries = map.call(entries, deserializeEntry.bind(null, isAtom));

  return feed;
}

this.deserializeFeed = deserializeFeed;

function validateDocumentElement(element) {
  if(!element) {
    throw new DeserializeError('Undefined document element');
  }

  if(!element.matches('feed, rss, rdf')) {
    throw new DeserializeError('Unsupported document element: ' +
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
    result.author = replaceHTML(author, ' ');
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
    const map = Array.prototype.map;
    // TODO: separate out this nested function
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
    // console.debug('Encountered enclosure: %o', enclosure);
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
function getElementText(parent, selector) {
  const element = parent.querySelector(selector);
  if(element) {
    const text = element.textContent;
    if(text) {
      return text.trim();
    }
  }
}

class DeserializeError extends Error {
  // TODO: use ES6 rest syntax? Chrome keeps whining
  constructor() {
    super(...arguments);
  }
}

// NOTE: The following functions are not currently in use, toying with the idea
// of using something other than querySelector to get at immediate children

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

} // END ANONYMOUS NAMESPACE
