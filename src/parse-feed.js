// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function parseFeed(document, excludeEntries) {
  console.assert(document, 'document is required');

  const docElement = document.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = parseFeedFindChannel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};

  feed.type = parseFeedGetFeedType(docElement);
  feed.title = parseFeedFindChildElementText(channel, 'title');
  feed.description = parseFeedFindChildElementText(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = parseFeedFindFeedLink(channel);
  feed.datePublished = parseFeedFindFeedDatePublished(channel);

  if(!excludeEntries) {
    const entryElements = parseFeedFindEntries(channel);
    feed.entries = entryElements.map(
      parseFeedCreateEntryFromElement.bind(null, feed.datePublished));
  }

  return feed;
}

function parseFeedFindChannel(documentElement) {
  if(documentElement.matches('feed')) {
    return documentElement;
  } else {
    return parseFeedFindChildElementByName(documentElement, 'channel');
  }
}

function parseFeedFindEntries(channel) {
  const documentElement = channel.ownerDocument.documentElement;
  const entries = [];
  let entryParent;
  let entryLocalName;

  if(documentElement.matches('feed')) {
    entryParent = documentElement;
    entryLocalName = 'entry';
  } else if(documentElement.matches('rdf')) {
    entryParent = documentElement;
    entryLocalName = 'item';
  } else {
    entryParent = channel;
    entryLocalName = 'item';
  }

  for(let element = entryParent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(element.localName === entryLocalName) {
      entries.push(element);
    }
  }

  return entries;
}

function parseFeedGetFeedType(documentElement) {
  let type = null;
  if(documentElement.matches('feed')) {
    type = 'feed';
  } else if(documentElement.matches('rdf')) {
    type = 'rdf';
  } else {
    type = 'rss';
  }
  return type;
}

function parseFeedFindFeedDatePublished(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = parseFeedFindChildElementText(channel, 'updated');
  } else {
    dateText = parseFeedFindChildElementText(channel, 'pubdate') ||
      parseFeedFindChildElementText(channel, 'lastbuilddate') ||
      parseFeedFindChildElementText(channel, 'date');
  }

  if(dateText) {
    try {
      return new Date(dateText);
    } catch(exception) {
      console.debug(exception);
    }
  }

  // Fall back to the current date
  return new Date();
}

function parseFeedIsLinkRelAlternate(element) {
  return element.matches('link[rel="alternate"]');
}

function parseFeedIsLinkRelSelf(element) {
  return element.matches('link[rel="self"]');
}

function parseFeedIsLinkWithHref(element) {
  return element.matches('link[href]');
}

function parseFeedIsLinkWithoutHref(element) {
  // return element.matches('link:not([href])');
  return element.localName === 'link' && !element.hasAttribute('href');
}

function parseFeedFindFeedLink(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = parseFeedFindChildElement(channel,
      parseFeedIsLinkRelAlternate) ||
      parseFeedFindChildElement(channel, parseFeedIsLinkRelSelf) ||
      parseFeedFindChildElement(channel, parseFeedIsLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = parseFeedFindChildElement(channel,
      parseFeedIsLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = parseFeedFindChildElement(channel,
        parseFeedIsLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function parseFeedCreateEntryFromElement(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');
  const entryObject = {};

  const title = parseFeedFindChildElementText(entryElement, 'title');
  if(title) {
    entryObject.title = title;
  }

  const author = parseFeedFindEntryAuthor(entryElement);
  if(author) {
    entryObject.author = author;
  }

  entryObject.urls = [];
  const entryLinkURL = parseFeedFindEntryLink(entryElement);
  if(entryLinkURL) {
    entryObject.urls.push(entryLinkURL);
  }

  const entryDatePublished = parseFeedFindEntryDatePublished(entryElement);
  if(entryDatePublished) {
    entryObject.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entryObject.datePublished = feedDatePublished;
  } else {
    // Fall back to the current date
    entryObject.datePublished = new Date();
  }

  const content = parseFeedFindEntryContent(entryElement);
  if(content) {
    entryObject.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = parseFeedFindChildElementByName(entryElement,
    'enclosure');
  if(enclosure) {
    const enclosureURLString = enclosure.getAttribute('url');
    let enclosureURL = null;
    if(enclosureURLString) {
      try {
        enclosureURL = new URL(enclosureURLString);
      } catch(exception) {
        console.debug(exception);
      }
    }

    entryObject.enclosure = {
      'url': enclosureURL,
      'length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entryObject;
}

function parseFeedFindEntryAuthor(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = parseFeedFindChildElementByName(entry, 'author');
    if(author) {
      return parseFeedFindChildElementText(author, 'name');
    }
  } else {
    return parseFeedFindChildElementText(entry, 'creator') ||
      parseFeedFindChildElementText(entry, 'publisher');
  }
}

function parseFeedFindEntryLink(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = parseFeedFindChildElement(entry,
        parseFeedIsLinkRelAlternate) ||
      parseFeedFindChildElement(entry, parseFeedIsLinkRelSelf) ||
      parseFeedFindChildElement(entry, parseFeedIsLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = parseFeedFindChildElementText(entry, 'origlink') ||
      parseFeedFindChildElementText(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function parseFeedFindEntryDatePublished(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let datePublishedString = null;

  if(isAtom) {
    datePublishedString = parseFeedFindChildElementText(entry,
      'published') || parseFeedFindChildElementText(entry, 'updated');
  } else {
    datePublishedString = parseFeedFindChildElementText(entry, 'pubdate') ||
      parseFeedFindChildElementText(entry, 'date');
  }

  if(datePublishedString) {
    datePublishedString = datePublishedString.trim();
  }

  // Do not fall back to the current date immediately. The feed's date may
  // be used instead.
  if(datePublishedString) {
    try {
      return new Date(datePublishedString);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function parseFeedFindEntryContent(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = parseFeedFindChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, parseFeedGetAtomNodeText).join('').trim();
  } else {

    result = parseFeedFindChildElementText(entry, 'encoded') ||
      parseFeedFindChildElementText(entry, 'description') ||
      parseFeedFindChildElementText(entry, 'summary');
  }
  return result;
}

function parseFeedGetAtomNodeText(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function parseFeedFindChildElement(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function parseFeedFindChildElementByName(parentElement, localName) {

  function hasLocalName(element) {
    return element.localName === localName;
  }

  return parseFeedFindChildElement(parentElement, hasLocalName);
}

function parseFeedFindChildElementText(element, localName) {
  const childElement = parseFeedFindChildElementByName(element, localName);
  if(childElement) {
    const childText = childElement.textContent;
    if(childText) {
      return childText.trim();
    }
  }
}
