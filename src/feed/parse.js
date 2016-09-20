// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Returns an event-like object with properties feed and entries.
function parseFeed(doc, shouldExcludeEntries) {
  const docElement = doc.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = findChannel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = getFeedType(docElement);
  feed.title = findChildElementText(channel, 'title');
  feed.description = findChildElementText(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = findFeedLink(channel);
  feed.datePublished = findFeedDatePublished(channel);

  let entries = [];
  if(!shouldExcludeEntries) {
    const entryElements = findEntries(channel);
    for(let entry of entryElements) {
      entries.push(createEntry(feed.datePublished, entry));
    }
  }

  return {
    'feed': feed,
    'entries': entries
  };
}

function findChannel(docElement) {
  if(docElement.matches('feed')) {
    return docElement;
  } else {
    return findChildElementByName(docElement, 'channel');
  }
}

function findEntries(channel) {
  const docElement = channel.ownerDocument.documentElement;
  const entries = [];
  let entryParentElement;
  let entryLocalName;

  if(docElement.matches('feed')) {
    entryParentElement = docElement;
    entryLocalName = 'entry';
  } else if(docElement.matches('rdf')) {
    entryParentElement = docElement;
    entryLocalName = 'item';
  } else {
    entryParentElement = channel;
    entryLocalName = 'item';
  }

  for(let element = entryParentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName === entryLocalName) {
      entries.push(element);
    }
  }

  return entries;
}

function getFeedType(docElement) {
  let type = null;
  if(docElement.matches('feed')) {
    type = 'feed';
  } else if(docElement.matches('rdf')) {
    type = 'rdf';
  } else {
    type = 'rss';
  }
  return type;
}

function findFeedDatePublished(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = findChildElementText(channel, 'updated');
  } else {
    dateText = findChildElementText(channel, 'pubdate') ||
      findChildElementText(channel, 'lastbuilddate') ||
      findChildElementText(channel, 'date');
  }

  if(dateText) {
    try {
      return new Date(dateText);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // TODO: actually i should try and represent the feed as is here, this
  // shouldn't be introducing processing logic, that is a caller responsibility
  // this also means that passing date published to createEntryFromElement
  // needs to have that function account for undefined if i remove this
  // Fall back to the current date
  return new Date();
}

function isLinkRelAlt(element) {
  return element.matches('link[rel="alternate"]');
}

function isLinkRelSelf(element) {
  return element.matches('link[rel="self"]');
}

function isLinkWithHref(element) {
  return element.matches('link[href]');
}

function isLinkWithoutHref(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function findFeedLink(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = findChildElement(channel, isLinkRelAlt) ||
      findChildElement(channel, isLinkRelSelf) ||
      findChildElement(channel, isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = findChildElement(channel, isLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = findChildElement(channel, isLinkWithHref);
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
}

function createEntry(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');

  const entry = {};

  const title = findChildElementText(entryElement, 'title');
  if(title) {
    entry.title = title;
  }

  const author = findEntryAuthor(entryElement);
  if(author) {
    entry.author = author;
  }

  // Set the link url as the entry's initial url
  const entryLinkURL = findEntryLink(entryElement);
  if(entryLinkURL) {
    rdr.entry.addURL(entry, entryLinkURL);
  }

  const entryDatePublished = findEntryDatePublished(entryElement);
  if(entryDatePublished) {
    entry.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entry.datePublished = feedDatePublished;
  } else {
    // TODO: actually i probably shouldn't infer this date and should leave it
    // as not set
    // Fall back to the current date
    entry.datePublished = new Date();
  }

  const content = findEntryContent(entryElement);
  if(content) {
    entry.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = findChildElementByName(entryElement,
    'enclosure');
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
}

function findEntryAuthor(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = findChildElementByName(entry, 'author');
    if(author) {
      return findChildElementText(author, 'name');
    }
  } else {
    return findChildElementText(entry, 'creator') ||
      findChildElementText(entry, 'publisher');
  }
}

function findEntryLink(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = findChildElement(entry, isLinkRelAlt) ||
      findChildElement(entry, isLinkRelSelf) ||
      findChildElement(entry, isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = findChildElementText(entry, 'origlink') ||
      findChildElementText(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText).href;
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function findEntryDatePublished(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let datePublishedString = null;

  if(isAtom) {
    datePublishedString = findChildElementText(entry, 'published') ||
      findChildElementText(entry, 'updated');
  } else {
    datePublishedString = findChildElementText(entry, 'pubdate') ||
      findChildElementText(entry, 'date');
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

  // If we did not find a valid date, then return null. Do not return today's
  // date or infer anything. This only parses the document as is.
  return null;
}

function findEntryContent(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = findChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, getAtomNodeText).join('').trim();
  } else {

    result = findChildElementText(entry, 'encoded') ||
      findChildElementText(entry, 'description') ||
      findChildElementText(entry, 'summary');
  }
  return result;
}

function getAtomNodeText(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function findChildElement(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function findChildElementByName(parentElement, localName) {
  console.assert(localName);
  return findChildElement(parentElement, function(element) {
    return element.localName === localName;
  });
}

function findChildElementText(element, localName) {
  const child = findChildElementByName(element, localName);
  if(child) {
    const childText = child.textContent;
    if(childText) {
      return childText.trim();
    }
  }
}

var rdr = rdr || {};
rdr.feed = rdr.feed || {};
rdr.feed.parse = parseFeed;

} // End file block scope
