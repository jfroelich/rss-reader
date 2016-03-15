// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

(function(exports) {
'use strict';

function parseFeed(document) {
  const documentElement = document.documentElement;
  if(!documentElement) {
    throw new Error('Undefined document element');
  }

  if(!documentElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' +
      element.localName);
  }

  const channel = getChannelElement(documentElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = getFeedType(documentElement);
  feed.title = findText(channel, 'title');
  feed.description = findText(channel,
    documentElement.matches('feed') ? 'subtitle' : 'description');
  feed.date = getFeedDate(channel);
  feed.link = getFeedLink(channel);
  feed.entries = getEntryElements(channel).map(parseEntry);
  return feed;
}

function getEntryElements(channel) {
  const entries = [];
  let entryParent;
  let entryLocalName;
  const documentElement = channel.ownerDocument.documentElement;

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

function getFeedType(documentElement) {
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

function getFeedDate(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    return findText(channel, 'updated');
  } else {
    return findText(channel, 'pubdate') ||
      findText(channel, 'lastbuilddate') ||
      findText(channel, 'date');
  }
}

function isLinkRelAlternate(element) {
  return element.localName === 'link' &&
    element.getAttribute('rel') === 'alternate';
}

function isLinkRelSelf(element) {
  return element.localName === 'link' &&
    element.getAttribute('rel') === 'self';
}

function isLinkWithHref(element) {
  return element.localName === 'link' && element.hasAttribute('href');
}

function isLinkWithoutHref(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function getFeedLink(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText, linkElement;
  if(isAtom) {
    linkElement = findChildElement(channel, isLinkRelAlternate) ||
      findChildElement(channel, isLinkRelSelf) ||
      findChildElement(channel, isLinkWithHref);
    if(linkElement)
      linkText = linkElement.getAttribute('href');
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
    return linkText.trim();
  }
}

function getChannelElement(documentElement) {
  return documentElement.matches('feed') ? documentElement :
    findChildElementByName(documentElement, 'channel');
}

function parseEntry(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  const result = {};
  result.title = findText(entry, 'title');

  // TODO: because i no longer replaceHTML, the caller has to do it somewhere
  //result.author = utils.replaceHTML(author, ' ');
  result.author = getEntryAuthor(entry);
  result.link = getEntryLink(entry);
  result.pubdate = getEntryPubDate(entry);
  result.content = getEntryContent(entry);

  // an enclosure is once per item
  const enclosure = entry.querySelector('enclosure');
  if(enclosure) {
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
}

function getEntryAuthor(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = findChildElementByName(entry, 'author');
    if(author) {
      return findText(author, 'name');
    }
  } else {
    return findText(entry, 'creator') || findText(entry, 'publisher');
  }
}

function getEntryLink(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = findChildElement(entry, isLinkRelAlternate) ||
      findChildElement(entry, isLinkRelSelf) ||
      findChildElement(entry, isLinkWithHref);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = findText(entry, 'origlink') ||
      findText(entry, 'link');
  }
  if(linkText) {
    linkText = linkText.trim();
  }
  return linkText;
}

function getEntryPubDate(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let dateText;
  if(isAtom)
    dateText = findText(entry, 'published') || findText(entry, 'updated');
  else
    dateText = findText(entry, 'pubdate') || findText(entry, 'date');
  if(dateText)
    dateText = dateText.trim();
  return dateText;
}

function getEntryContent(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;

  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = findChildElementByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, getAtomElementTextContent).join('').trim();
  } else {
    result = findText(entry, 'encoded') ||
      findText(entry, 'description') ||
      findText(entry, 'summary');
  }
  return result;
}

function getAtomElementTextContent(node) {
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

function findChildElementByName(parent, localName) {
  return findChildElement(parent, function isNameEqual(element) {
    return element.localName === localName;
  });
}

function findText(element, name) {
  const childElement = findChildElementByName(element, name);
  if(childElement) {
    const text = childElement.textContent;
    if(text) {
      return text.trim();
    }
  }
}

exports.parseFeed = parseFeed;

} (this));
