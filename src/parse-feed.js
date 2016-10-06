// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.feed = rdr.feed || {};

// Returns an event-like object with properties feed and entries. Throws an
// error if parsing failed
rdr.feed.parse = function(doc, shouldExcludeEntries) {
  const docElement = doc.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = rdr.feed._findChannel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = rdr.feed._getFeedType(docElement);
  feed.title = rdr.feed._findChildElementText(channel, 'title');
  feed.description = rdr.feed._findChildElementText(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = rdr.feed._findFeedLink(channel);
  feed.datePublished = rdr.feed._findFeedDatePublished(channel);

  let entries = [];
  if(!shouldExcludeEntries) {
    const entryElements = rdr.feed._findEntries(channel);
    for(let entry of entryElements) {
      entries.push(rdr.feed._createEntry(feed.datePublished, entry));
    }
  }

  return {
    'feed': feed,
    'entries': entries
  };
};

rdr.feed._findChannel = function(docElement) {
  if(docElement.matches('feed')) {
    return docElement;
  } else {
    return rdr.feed._findChildElementByName(docElement, 'channel');
  }
};

rdr.feed._findEntries = function(channel) {
  const docElement = channel.ownerDocument.documentElement;
  const entries = [];
  let parent;
  let name;

  if(docElement.matches('feed')) {
    parent = docElement;
    name = 'entry';
  } else if(docElement.matches('rdf')) {
    parent = docElement;
    name = 'item';
  } else {
    parent = channel;
    name = 'item';
  }

  for(let e = parent.firstElementChild; e; e = e.nextElementSibling) {
    if(e.localName === name) {
      entries.push(e);
    }
  }

  return entries;
};

rdr.feed._getFeedType = function(docElement) {
  let type = null;
  if(docElement.matches('feed')) {
    type = 'feed';
  } else if(docElement.matches('rdf')) {
    type = 'rdf';
  } else {
    type = 'rss';
  }
  return type;
};

rdr.feed._findFeedDatePublished = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = rdr.feed._findChildElementText(channel, 'updated');
  } else {
    dateText = rdr.feed._findChildElementText(channel, 'pubdate') ||
      rdr.feed._findChildElementText(channel, 'lastbuilddate') ||
      rdr.feed._findChildElementText(channel, 'date');
  }

  if(dateText) {
    try {
      return new Date(dateText);
    } catch(exception) {
      console.debug(exception);
    }
  }

  return new Date();
};

rdr.feed._isLinkRelAlt = function(element) {
  return element.matches('link[rel="alternate"]');
};

rdr.feed._isLinkRelSelf = function(element) {
  return element.matches('link[rel="self"]');
};

rdr.feed._isLinkWithHref = function(element) {
  return element.matches('link[href]');
};

rdr.feed._isLinkWithoutHref = function(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
};

rdr.feed._findFeedLink = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = rdr.feed._findChildElement(channel, rdr.feed._isLinkRelAlt) ||
      rdr.feed._findChildElement(channel, rdr.feed._isLinkRelSelf) ||
      rdr.feed._findChildElement(channel, rdr.feed._isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = rdr.feed._findChildElement(channel,
      rdr.feed._isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = rdr.feed._findChildElement(channel,
        rdr.feed._isLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  if(linkText) {
    try {
      return new URL(linkText).href;
    } catch(exception) {
      console.debug(exception);
    }
  }
};

rdr.feed._createEntry = function(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');

  const entry = {};

  const title = rdr.feed._findChildElementText(entryElement, 'title');
  if(title) {
    entry.title = title;
  }

  const author = rdr.feed._findEntryAuthor(entryElement);
  if(author) {
    entry.author = author;
  }

  // Set the link url as the entry's initial url
  const entryLinkURL = rdr.feed._findEntryLink(entryElement);
  if(entryLinkURL) {
    Entry.addURL(entry, entryLinkURL);
  }

  const entryDatePublished = rdr.feed._findEntryDatePublished(entryElement);
  if(entryDatePublished) {
    entry.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entry.datePublished = feedDatePublished;
  } else {
    entry.datePublished = new Date();
  }

  const content = rdr.feed._findEntryContent(entryElement);
  if(content) {
    entry.content = content;
  }

  const enclosure = rdr.feed._findChildElementByName(entryElement, 'enclosure');
  if(enclosure) {
    const enclosureURLString = enclosure.getAttribute('url');
    let enclosureURL = null;
    if(enclosureURLString) {
      try {
        enclosureURL = new URL(enclosureURLString).href;
      } catch(exception) {
        console.debug(exception);
      }
    }

    entry.enclosure = {
      'url': enclosureURL,
      'enclosure_length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entry;
};

rdr.feed._findEntryAuthor = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = rdr.feed._findChildElementByName(entry, 'author');
    if(author) {
      return rdr.feed._findChildElementText(author, 'name');
    }
  } else {
    return rdr.feed._findChildElementText(entry, 'creator') ||
      rdr.feed._findChildElementText(entry, 'publisher');
  }
};

rdr.feed._findEntryLink = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = rdr.feed._findChildElement(entry, rdr.feed._isLinkRelAlt) ||
      rdr.feed._findChildElement(entry, rdr.feed._isLinkRelSelf) ||
      rdr.feed._findChildElement(entry, rdr.feed._isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = rdr.feed._findChildElementText(entry, 'origlink') ||
      rdr.feed._findChildElementText(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText).href;
    } catch(error) {
      console.debug(error);
    }
  }
};

rdr.feed._findEntryDatePublished = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let datePublishedString = null;

  if(isAtom) {
    datePublishedString = rdr.feed._findChildElementText(entry, 'published') ||
      rdr.feed._findChildElementText(entry, 'updated');
  } else {
    datePublishedString = rdr.feed._findChildElementText(entry, 'pubdate') ||
      rdr.feed._findChildElementText(entry, 'date');
  }

  if(datePublishedString) {
    datePublishedString = datePublishedString.trim();
  }

  if(datePublishedString) {
    try {
      return new Date(datePublishedString);
    } catch(exception) {
      console.debug(exception);
    }
  }

  return null;
};

rdr.feed._findEntryContent = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    const content = rdr.feed._findChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, rdr.feed._getAtomNodeText).join('').trim();
  } else {

    result = rdr.feed._findChildElementText(entry, 'encoded') ||
      rdr.feed._findChildElementText(entry, 'description') ||
      rdr.feed._findChildElementText(entry, 'summary');
  }
  return result;
};

rdr.feed._getAtomNodeText = function(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
};

rdr.feed._findChildElement = function(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
};

rdr.feed._findChildElementByName = function(parentElement, localName) {
  if(typeof localName !== 'string') {
    throw new TypeError('localName is not a string');
  }

  return rdr.feed._findChildElement(parentElement, function(element) {
    return element.localName === localName;
  });
};

rdr.feed._findChildElementText = function(element, localName) {
  const child = rdr.feed._findChildElementByName(element, localName);
  if(child) {
    const childText = child.textContent;
    if(childText) {
      return childText.trim();
    }
  }
};
