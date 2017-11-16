// Feed parsing functionality

// TODO: prefer "item" over "entry" terminology?
// TODO: create a FeedDescriptor object and return it instead of the basic property?

// This TODO was moved from /src/reader/parse-feed.js
// TODO: I think that, before I make any changes, a good change would be to revert the fetchFeed
// function to returning a simple "feed" object that includes an "entries" array property, instead
// of this whole "parseResult" object with two properties. This would be fine because it is now
// very clear that parsing has nothing to do with coercion. Parsing just produces a thing. Then
// the rest of the app has to deal with it and format it. The thing produced by parsing is not
// at all concerned with how the app deals with it. So, here are the individual todos:
// TODO: change parseFeed to return a single feed object with an entries array property
// TODO: change /reader/parse-feed to expect the different format

import assert from "/src/assert.js";
import parseXML from "/src/parse-xml.js";

// Parses the input string into a results object containing feed and entries properties, where
// feed is a feed descriptor object containing channel information, and entries is an array of
// the items/entries from the feed. Throws an error if there is an xml syntax error or for any
// other form of bad input.
export default function parseFeed(feedXMLString) {
  const xmlDocument = parseXML(feedXMLString);
  return unmarshallXML(xmlDocument);
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a simple object with properties feed and entries
function unmarshallXML(document) {
  const documentElement = document.documentElement;

  const emptyResult = {
    'feed': null,
    'entries': []
  };

  const rootNames = ['feed', 'rdf', 'rss'];
  const documentElementName = documentElement.localName.toLowerCase();
  if(!rootNames.includes(documentElementName)) {
    return emptyResult;
  }

  const channelElement = findChannelElement(documentElement);
  if(!channelElement) {
    return emptyResult;
  }

  const feed = {};
  feed.type = findFeedType(documentElement);
  feed.title = findFeedTitle(channelElement);
  feed.description = findFeedDescription(document, channelElement);
  feed.link = findFeedLink(channelElement);
  feed.datePublished = findFeedDate(channelElement);

  const entryObjects = [];
  const entryElements = findEntryElements(channelElement);
  for(const entryElement of entryElements) {
    entryObjects.push(createEntryObject(entryElement));
  }

  const result = {};
  result.feed = feed;
  result.entries = entryObjects;
  return result;
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
  const documentElementName = documentElement.localName.toLowerCase();
  const entries = [];
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
    // This should never happen because we checked previously
    assert(false, 'unsupported document element: ' + documentElement.nodeName);
  }

  for(let childElement = parentNode.firstElementChild; childElement;
    childElement = childElement.nextElementSibling) {
    if(childElement.localName.toLowerCase() === entryElementName) {
      entries.push(childElement);
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

  let linkText, linkElement;
  if(documentElement.localName.toLowerCase() === 'feed') {
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
  let linkText;
  if(documentElement.localName.toLowerCase() === 'feed') {
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
  let dateString;
  if(documentElement.localName.toLowerCase() === 'feed') {
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
  let result;
  if(documentElement.localName.toLowerCase() === 'feed') {
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
      // TODO: I shouldn't normalize, this should return values as is, and move normalization
      // responsibility to caller.
      return text.trim();
    }
  }
}
