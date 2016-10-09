// See license.md

/*
TODO:
- do not require entries to have urls, that is some other modules responsibility
- support <media:thumbnail url="imgurl" /> (atom)
- do not introduce fallback dates, if date is not set then do not use
- do not cascade feed date to entry date
- add helper for entry enclosure instead of how it is inlined
- figure out the atom text node issue (cdata related?)
- setup testing
*/


'use strict';

const FeedParser = {};

// Returns an event-like object with properties feed and entries. Throws an
// error if parsing failed
FeedParser.parse = function(doc, shouldExcludeEntries) {
  const docElement = doc.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = FeedParser._findChannel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = FeedParser.getFeedType(docElement);
  feed.title = FeedParser.findChildText(channel, 'title');
  feed.description = FeedParser.findChildText(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = FeedParser.getFeedLink(channel);
  feed.datePublished = FeedParser.findPubDate(channel);

  let entries = [];
  if(!shouldExcludeEntries) {
    const entryElements = FeedParser.findEntries(channel);
    for(let entry of entryElements) {
      entries.push(FeedParser.createEntry(feed.datePublished, entry));
    }
  }

  return {
    'feed': feed,
    'entries': entries
  };
};

FeedParser._findChannel = function(docElement) {
  if(docElement.matches('feed')) {
    return docElement;
  } else {
    return FeedParser.findChildByName(docElement, 'channel');
  }
};

FeedParser.findEntries = function(channel) {
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

FeedParser.getFeedType = function(docElement) {
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

FeedParser.findPubDate = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = FeedParser.findChildText(channel, 'updated');
  } else {
    dateText = FeedParser.findChildText(channel, 'pubdate') ||
      FeedParser.findChildText(channel, 'lastbuilddate') ||
      FeedParser.findChildText(channel, 'date');
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

FeedParser.isLinkRelAlt = function(element) {
  return element.matches('link[rel="alternate"]');
};

FeedParser.isLinkRelSelf = function(element) {
  return element.matches('link[rel="self"]');
};

FeedParser.isLinkWithHref = function(element) {
  return element.matches('link[href]');
};

FeedParser.isLinkWithoutHref = function(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
};

FeedParser.getFeedLink = function(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = FeedParser.findChild(channel, FeedParser.isLinkRelAlt) ||
      FeedParser.findChild(channel, FeedParser.isLinkRelSelf) ||
      FeedParser.findChild(channel, FeedParser.isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = FeedParser.findChild(channel,
      FeedParser.isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = FeedParser.findChild(channel,
        FeedParser.isLinkWithHref);
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

FeedParser.createEntry = function(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');

  const entry = {};

  const title = FeedParser.findChildText(entryElement, 'title');
  if(title) {
    entry.title = title;
  }

  const author = FeedParser.findEntryAuthor(entryElement);
  if(author) {
    entry.author = author;
  }

  // Set the link url as the entry's initial url
  const entryLinkURL = FeedParser.findEntryLink(entryElement);
  if(entryLinkURL) {
    Entry.addURL(entry, entryLinkURL);
  }

  const entryDatePublished = FeedParser.findEntryPubDate(entryElement);
  if(entryDatePublished) {
    entry.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entry.datePublished = feedDatePublished;
  } else {
    entry.datePublished = new Date();
  }

  const content = FeedParser.findEntryContent(entryElement);
  if(content) {
    entry.content = content;
  }

  const enclosure = FeedParser.findChildByName(entryElement, 'enclosure');
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

FeedParser.findEntryAuthor = function(entry) {
  const authorEl = FeedParser.findChildByName(entry, 'author');
  if(authorEl) {
    const nameText = FeedParser.findChildText(authorEl, 'name');
    if(nameText) {
      return nameText;
    }
  }

  // In atom it is "dc:creator" but querySelector uses localName and ignores
  // qualified name so just search by localName
  const creator = FeedParser.findChildText(entry, 'creator');
  if(creator) {
    return creator;
  }

  return FeedParser.findChildText(entry, 'publisher');
};

FeedParser.findEntryLink = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = FeedParser.findChild(entry, FeedParser.isLinkRelAlt) ||
      FeedParser.findChild(entry, FeedParser.isLinkRelSelf) ||
      FeedParser.findChild(entry, FeedParser.isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = FeedParser.findChildText(entry, 'origlink') ||
      FeedParser.findChildText(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText).href;
    } catch(error) {
      console.debug(error);
    }
  }
};

FeedParser.findEntryPubDate = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let pubDateStr = null;

  if(isAtom) {
    pubDateStr = FeedParser.findChildText(entry, 'published') ||
      FeedParser.findChildText(entry, 'updated');
  } else {
    pubDateStr = FeedParser.findChildText(entry, 'pubdate') ||
      FeedParser.findChildText(entry, 'date');
  }

  if(pubDateStr) {
    pubDateStr = pubDateStr.trim();
  }

  if(pubDateStr) {
    try {
      return new Date(pubDateStr);
    } catch(exception) {
      console.debug(exception);
    }
  }

  return null;
};

FeedParser.findEntryContent = function(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    const content = FeedParser.findChildByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, FeedParser.getAtomNodeText).join('').trim();
  } else {

    result = FeedParser.findChildText(entry, 'encoded') ||
      FeedParser.findChildText(entry, 'description') ||
      FeedParser.findChildText(entry, 'summary');
  }
  return result;
};

FeedParser.getAtomNodeText = function(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
};

FeedParser.findChild = function(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
};

FeedParser.findChildByName = function(parentElement, localName) {
  if(typeof localName !== 'string') {
    throw new TypeError('localName is not a string');
  }

  return FeedParser.findChild(parentElement, function(element) {
    return element.localName === localName;
  });
};

FeedParser.findChildText = function(element, localName) {
  const child = FeedParser.findChildByName(element, localName);
  if(child) {
    const childText = child.textContent;
    if(childText) {
      return childText.trim();
    }
  }
};
