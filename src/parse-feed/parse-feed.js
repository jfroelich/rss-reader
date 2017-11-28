import assert from "/src/assert/assert.js";
import {check, ParseError} from "/src/utils/errors.js";
import parseXML from "/src/xml/parse.js";
import {getElementName} from "/src/xml/utils.js";

// Feed parsing functionality

// TODO: prefer "item" over "entry" terminology?
// TODO: create a FeedDescriptor-like object and return it instead of a basic object?
// TODO: findChildElementText should not normalize, this should return values as is, and move
// normalization responsibility to caller. In fact nothing in this parser should do any
// normalization. All of that validation and sanitization and coercion should be the caller's
// responsibility. This function should not be concerned with those things. The goal is to maintain
// fidelity to the input. In fact I probably should not even be trying to change strings into
// date objects and such.

// I would prefer to export a default function, but ran into a problem when trying to rename the
// default import in a module that imports this module that happens to use the same name as this
// function. So, for now, I am not exporting a default. This may change.


// Parses the input string into a feed object. The feed object will always have a defined entries
// array, although it may be zero length. Throws both checked and unchecked errors if the feed
// is not well formed or something unexpected happened.
export function parseFeed(feedXMLString) {
  const xmlDocument = parseXML(feedXMLString);
  return unmarshallXML(xmlDocument);
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a feed object
function unmarshallXML(document) {
  const documentElement = document.documentElement;
  const documentElementName = getElementName(documentElement);
  const supportedNames = ['feed', 'rdf', 'rss'];
  check(supportedNames.includes(documentElementName), ParseError,
    'unsupported document element', documentElementName);
  const channelElement = findChannelElement(documentElement);
  check(channelElement, ParseError, 'missing channel element');

  const feed = {};
  feed.type = findFeedType(documentElement);
  feed.title = findFeedTitle(channelElement);
  feed.description = findFeedDescription(document, channelElement);
  feed.link = findFeedLink(channelElement);
  feed.datePublished = findFeedDate(channelElement);

  const entryElements = findEntryElements(channelElement);
  feed.entries = entryElements.map(createEntryObject);

  return feed;
}

function findFeedTitle(channelElement) {
  return findChildElementText(channelElement, 'title');
}

function findFeedDescription(document, channelElement) {
  const documentElement = document.documentElement;
  const documentElementName = documentElement.localName.toLowerCase();
  const elementName = documentElementName === 'feed' ? 'subtitle' : 'description';
  return findChildElementText(channelElement, elementName);
}

function findChannelElement(documentElement) {
  if(documentElement.localName.toLowerCase() === 'feed') {
    return documentElement;
  } else {
    return findChildElementByName(documentElement, 'channel');
  }
}

function findEntryElements(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);

  let parentNode, entryElementName;
  if(documentElementName === 'feed') {
    parentNode = documentElement;
    entryElementName = 'entry';
  } else if(documentElementName === 'rdf') {
    parentNode = documentElement;
    entryElementName = 'item';
  } else if(documentElementName === 'rss') {
    parentNode = channelElement;
    entryElementName = 'item';
  } else {
    assert(false);
  }

  const entries = [];
  for(let c = parentNode.firstElementChild; c; c = c.nextElementSibling) {
    if(getElementName(c) === entryElementName) {
      entries.push(c);
    }
  }
  return entries;
}

function findFeedType(documentElement) {
  return documentElement.localName.toLowerCase();
}

function findFeedDate(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const feedType = findFeedType(documentElement);

  let dateText;
  if(feedType === 'feed') {
    dateText = findChildElementText(channelElement, 'updated');
  } else {
    dateText = findChildElementText(channelElement, 'pubdate');
    dateText = dateText || findChildElementText(channelElement, 'lastbuilddate');
    dateText = dateText || findChildElementText(channelElement, 'date');
  }

  if(!dateText) {
    return;
  }

  let feedDate;
  try {
    feedDate = new Date(dateText);
  } catch(error) {
  }

  return feedDate;
}

function findAtomFeedLinkElement(channelElement) {
  let linkElement = findChildElement(channelElement, isLinkRelAltElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, isLinkRelSelfElement);
  if(linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, isLinkWithHrefElement);
  return linkElement;
}

function findFeedLink(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let linkText, linkElement;
  if(documentElementName === 'feed') {
    linkElement = findAtomFeedLinkElement(channelElement);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = findChildElement(channelElement, isLinkWithoutHrefElement);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = findChildElement(channelElement, isLinkWithHrefElement);
      if(linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    }
  }

  return linkText;
}

function isLinkRelAltElement(element) {
  return element.matches('link[rel="alternate"]');
}

function isLinkRelSelfElement(element) {
  return element.matches('link[rel="self"]');
}

function isLinkWithHrefElement(element) {
  return element.matches('link[href]');
}

function isLinkWithoutHrefElement(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function createEntryObject(entryElement) {
  return {
    title: findEntryTitle(entryElement),
    author: findEntryAuthor(entryElement),
    link: findEntryLink(entryElement),
    datePublished: findEntryDate(entryElement),
    content: findEntryContent(entryElement),
    enclosure: findEntryEnclosure(entryElement)
  };
}

function findEntryTitle(entryElement) {
  return findChildElementText(entryElement, 'title');
}

function findEntryEnclosure(entryElement) {
  const enclosureElement = findChildElementByName(entryElement, 'enclosure');

  if(enclosureElement) {
    const enclosureObject = {};
    enclosureObject.url = enclosureElement.getAttribute('url');
    enclosureObject.enclosureLength = enclosureElement.getAttribute('length');
    enclosureObject.type = enclosureElement.getAttribute('type');
    return enclosureObject;
  }
}

function findEntryAuthor(entryElement) {
  const authorElement = findChildElementByName(entryElement, 'author');
  if(authorElement) {
    const authorName = findChildElementText(authorElement, 'name');
    if(authorName) {
      return authorName;
    }
  }

  const creator = findChildElementText(entryElement, 'creator');
  if(creator) {
    return creator;
  }
  return findChildElementText(entryElement, 'publisher');
}

function findEntryLink(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let linkText;
  if(documentElementName === 'feed') {
    let link = findChildElement(entryElement, isLinkRelAltElement);
    link = link || findChildElement(entryElement, isLinkRelSelfElement);
    link = link || findChildElement(entryElement, isLinkWithHrefElement);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = findChildElementText(entryElement, 'origlink');
    linkText = linkText || findChildElementText(entryElement, 'link');
  }
  return linkText;
}

function findEntryDate(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let dateString;
  if(documentElementName === 'feed') {
    dateString = findChildElementText(entryElement, 'published') ||
      findChildElementText(entryElement, 'updated');
  } else {
    dateString = findChildElementText(entryElement, 'pubdate') ||
      findChildElementText(entryElement, 'date');
  }
  if(!dateString) {
    return;
  }

  let entryDate;
  try {
    entryDate = new Date(dateString);
  } catch(exception) {
  }
  return entryDate;
}

function findEntryContent(entryElement) {
  const documentElement = entryElement.ownerDocument.documentElement;
  const documentElementName = getElementName(documentElement);
  let result;
  if(documentElementName === 'feed') {
    const content = findChildElementByName(entryElement, 'content');
    const nodes = content ? content.childNodes : [];
    const texts = [];
    for(let node of nodes) {
      const nodeText = getAtomNodeText(node);
      texts.push(nodeText);
    }

    result = texts.join('').trim();
  } else {
    result = findChildElementText(entryElement, 'encoded');
    result = result || findChildElementText(entryElement, 'description');
    result = result || findChildElementText(entryElement, 'summary');
  }
  return result;
}

function getAtomNodeText(node) {
  return node.nodeType === Node.ELEMENT_NODE ? node.innerHTML : node.textContent;
}

function findChildElement(parentElement, predicate) {
  for(let e = parentElement.firstElementChild; e; e = e.nextElementSibling) {
    if(predicate(e)) {
      return e;
    }
  }
}

function findChildElementByName(parent, name) {
  assert(parent instanceof Element);
  assert(typeof name === 'string');

  const normalName = name.toLowerCase();
  for(let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if(c.localName.toLowerCase() === normalName) {
      return c;
    }
  }
}

function findChildElementText(parentElement, elementName) {
  const childElement = findChildElementByName(parentElement, elementName);
  if(childElement) {
    const text = childElement.textContent;
    if(text) {

      return text.trim();
    }
  }
}
