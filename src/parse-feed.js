// Feed parsing functionality

// TODO: prefer "item" over "entry" terminology?
// TODO: create a FeedDescriptor object and return it instead of the basic property?
// TODO: findChildElementText should not normalize, this should return values as is, and move
// normalization responsibility to caller. In fact nothing in this parser should do any
// normalization. All of that validation and sanitization and coercion should be the caller's
// responsibility. This function should not be concerned with those things.

import assert from "/src/assert.js";
import parseXML from "/src/parse-xml.js";

// Parses the input string into a feed object. The feed object will always have a defined entries
// array, although it may be zero length. Throws both checked and unchecked errors if the feed
// is not well formed or something unexpected happened.
export default function parseFeed(feedXMLString) {

  // Create a Document from the string. Rethrow any errors.
  const xmlDocument = parseXML(feedXMLString);

  // Any assumptions about the validity of the result produced by parseXML are delegated to
  // unmarshallXML.
  return unmarshallXML(xmlDocument);
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a feed object
function unmarshallXML(document) {
  assert(document instanceof Document);

  // Create and define the output object
  const feed = {};
  // The output always has an entries array as part of its contract
  // TODO: if I am throwing in the case of error, I probably no longer need to do this,
  // because it will happen later?
  feed.entries = [];

  // Check that the root element is one of the supported formats
  const documentElement = document.documentElement;
  const rootNames = ['feed', 'rdf', 'rss'];
  const documentElementName = documentElement.localName.toLowerCase();

  // TODO: change this to throw a checked exception, use check(). I am deferring this change
  // until after I complete the other change to returning feed.

  if(!rootNames.includes(documentElementName)) {
    return feed;
  }

  // Check that the xml has a channel element
  // TODO: change this to throw a checked exception, use check(). I am deferring this change
  // until after I complete the other change to returning feed.
  const channelElement = findChannelElement(documentElement);
  if(!channelElement) {
    return feed;
  }

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

  // Overwrite the default empty entries array property with the processed entries array
  feed.entries = entryObjects;

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

      return text.trim();
    }
  }
}
