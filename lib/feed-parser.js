import '/third-party/he.js';
import parseXML from '/lib/parse-xml.js';

export function Feed() {
  this.type = undefined;
  this.title = undefined;
  this.description = undefined;
  this.link = undefined;
  this.published_date = undefined;
  this.entries = [];
}

export function Entry() {
  this.title = undefined;
  this.author = undefined;
  this.link = undefined;
  this.published_date = undefined;
  this.content = undefined;
  this.enclosure = undefined;
}

// Parses a String into a Feed object. May throw errors.
export function parseFromString(value) {
  return parseFromDocument(parseXML(value));
}

// Parses a Document object into a Feed object
export function parseFromDocument(doc) {
  const { documentElement } = doc;
  const documentElementName = getElementName(documentElement);

  const supportedDocumentElementNames = ['feed', 'rdf', 'rss'];
  if (!supportedDocumentElementNames.includes(documentElementName)) {
    throw new Error(`Unsupported document element ${documentElementName}`);
  }

  const channelElement = findChannelElement(documentElement);
  if (!channelElement) {
    throw new Error('Missing channel element');
  }

  const feed = new Feed();
  feed.type = findFeedType(documentElement);
  feed.title = findFeedTitle(channelElement);
  feed.description = findFeedDescription(doc, channelElement);
  feed.link = findFeedLink(channelElement);
  feed.published_date = findFeedDate(channelElement);

  const entryElements = findEntryElements(channelElement);
  feed.entries = entryElements.map(elementToEntry);
  feedResolveEntryURLs(feed.entries, feed.link);

  return feed;
}

function findFeedTitle(channelElement) {
  return findChildElementText(channelElement, 'title');
}

function findFeedDescription(doc, channelElement) {
  const { documentElement } = doc;
  const documentElementName = documentElement.localName.toLowerCase();
  const elementName = documentElementName === 'feed' ? 'subtitle' : 'description';
  return findChildElementText(channelElement, elementName);
}

function findChannelElement(documentElement) {
  if (documentElement.localName.toLowerCase() === 'feed') {
    return documentElement;
  }

  return findChildElementByName(documentElement, 'channel');
}

function findEntryElements(channelElement) {
  const { documentElement } = channelElement.ownerDocument;
  const documentElementName = getElementName(documentElement);

  let parentNode;
  let entryElementName;
  if (documentElementName === 'feed') {
    parentNode = documentElement;
    entryElementName = 'entry';
  } else if (documentElementName === 'rdf') {
    parentNode = documentElement;
    entryElementName = 'item';
  } else if (documentElementName === 'rss') {
    parentNode = channelElement;
    entryElementName = 'item';
  } else {
    throw new Error('Reached unreachable');
  }

  const entries = [];
  for (let child = parentNode.firstElementChild; child; child = child.nextElementSibling) {
    if (getElementName(child) === entryElementName) {
      entries.push(child);
    }
  }
  return entries;
}

function findFeedType(documentElement) {
  return documentElement.localName.toLowerCase();
}

function findFeedDate(channelElement) {
  const { documentElement } = channelElement.ownerDocument;
  const feedType = findFeedType(documentElement);

  let dateText;
  if (feedType === 'feed') {
    dateText = findChildElementText(channelElement, 'updated');
  } else {
    dateText = findChildElementText(channelElement, 'pubdate');
    dateText = dateText || findChildElementText(channelElement, 'lastbuilddate');
    dateText = dateText || findChildElementText(channelElement, 'date');
  }

  if (!dateText) {
    return undefined;
  }

  let feedDate;
  try {
    feedDate = new Date(dateText);
  } catch (error) {
    // ignore
  }

  return feedDate;
}

function findAtomLinkElement(channelElement) {
  let linkElement = findChildElement(channelElement, elementIsLinkRelAlt);
  if (linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, elementIsLinkRelSelf);
  if (linkElement) {
    return linkElement;
  }

  linkElement = findChildElement(channelElement, elementIsLinkWithHref);
  return linkElement;
}

function findFeedLink(channelElement) {
  const { documentElement } = channelElement.ownerDocument;
  const documentElementName = getElementName(documentElement);
  let linkText;
  let linkElement;

  if (documentElementName === 'feed') {
    linkElement = findAtomLinkElement(channelElement);
    if (linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = findChildElement(channelElement, elementIsLinkWithoutHref);
    if (linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = findChildElement(channelElement, elementIsLinkWithHref);
      if (linkElement) {
        linkText = linkElement.getAttribute('href');
      }
    }
  }

  return linkText;
}

function elementIsLinkRelAlt(element) {
  return element.matches('link[rel="alternate"]');
}

function elementIsLinkRelSelf(element) {
  return element.matches('link[rel="self"]');
}

function elementIsLinkWithHref(element) {
  return element.matches('link[href]');
}

function elementIsLinkWithoutHref(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function elementToEntry(entryElement) {
  const entry = new Entry();
  entry.title = findEntryTitle(entryElement);
  entry.author = findEntryAuthor(entryElement);
  entry.link = findEntryLink(entryElement);
  entry.published_date = findEntryDate(entryElement);
  entry.content = findEntryContent(entryElement);
  entry.enclosure = findEntryEnclosure(entryElement);
  return entry;
}

function findEntryTitle(entryElement) {
  return findChildElementText(entryElement, 'title');
}

function findEntryEnclosure(entryElement) {
  const enclosureElement = findChildElementByName(entryElement, 'enclosure');

  if (enclosureElement) {
    const enclosure = {};
    enclosure.url = enclosureElement.getAttribute('url');
    enclosure.enclosure_length = enclosureElement.getAttribute('length');
    enclosure.type = enclosureElement.getAttribute('type');
    return enclosure;
  }

  return undefined;
}

function findEntryAuthor(entryElement) {
  const authorElement = findChildElementByName(entryElement, 'author');
  if (authorElement) {
    const authorName = findChildElementText(authorElement, 'name');
    if (authorName) {
      return authorName;
    }
  }

  const creator = findChildElementText(entryElement, 'creator');
  if (creator) {
    return creator;
  }
  return findChildElementText(entryElement, 'publisher');
}

function findEntryLink(entryElement) {
  const { documentElement } = entryElement.ownerDocument;
  const documentElementName = getElementName(documentElement);
  let linkText;
  if (documentElementName === 'feed') {
    let link = findChildElement(entryElement, elementIsLinkRelAlt);
    link = link || findChildElement(entryElement, elementIsLinkRelSelf);
    link = link || findChildElement(entryElement, elementIsLinkWithHref);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = findChildElementText(entryElement, 'origlink');
    linkText = linkText || findChildElementText(entryElement, 'link');
  }
  return linkText;
}

function findEntryDate(entryElement) {
  const { documentElement } = entryElement.ownerDocument;
  const documentElementName = getElementName(documentElement);
  let entryDateString;

  if (documentElementName === 'feed') {
    entryDateString = findChildElementText(entryElement, 'published') ||
      findChildElementText(entryElement, 'updated');
  } else {
    entryDateString = findChildElementText(entryElement, 'pubdate') ||
      findChildElementText(entryElement, 'date');
  }

  if (!entryDateString) {
    return undefined;
  }

  let entryDate;
  try {
    entryDate = new Date(entryDateString);
  } catch (error) {
    console.debug(error);
  }

  return entryDate;
}

function findEntryContent(entryElement) {
  const { documentElement } = entryElement.ownerDocument;
  const documentElementName = getElementName(documentElement);
  let result;

  if (documentElementName === 'feed') {
    const content = findChildElementByName(entryElement, 'content');

    if (!content) {
      return undefined;
    }

    const nodes = content.childNodes;
    const texts = [];
    for (const node of nodes) {
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        let { nodeValue } = node;
        const isAttributeValue = false;
        nodeValue = decodeEntities(nodeValue, isAttributeValue);
        texts.push(nodeValue);
      } else if (node.nodeType === Node.TEXT_NODE) {
        const nodeText = node.textContent;
        texts.push(nodeText);
      } else {
        console.warn('Unknown node type, next message is dir inspection');
        console.dir(node);
      }
    }

    result = texts.join('').trim();
  } else {
    result = findChildElementText(entryElement, 'encoded');
    result = result || findChildElementText(entryElement, 'description');
    result = result || findChildElementText(entryElement, 'summary');
  }

  return result;
}

function feedResolveEntryURLs(entries, feedLinkURLString) {
  if (!feedLinkURLString) {
    return;
  }

  let baseURL;
  try {
    baseURL = new URL(feedLinkURLString);
  } catch (error) {
    console.debug('Invalid base url', feedLinkURLString);
    return;
  }

  for (const entry of entries) {
    if (entry.link) {
      try {
        const url = new URL(entry.link, baseURL);
        entry.link = url.href;
      } catch (error) {
        console.debug(error);
      }
    }
  }
}

function findChildElement(parentElement, predicate) {
  for (let e = parentElement.firstElementChild; e; e = e.nextElementSibling) {
    if (predicate(e)) {
      return e;
    }
  }

  return undefined;
}

function findChildElementByName(parent, name) {
  if (!(parent instanceof Element)) {
    throw new Error(`Expected element, got ${typeof Element}`);
  }

  if (typeof name !== 'string') {
    throw new Error(`Expected string, got ${typeof name}`);
  }

  const normalName = name.toLowerCase();
  for (let child = parent.firstElementChild; child; child = child.nextElementSibling) {
    if (child.localName.toLowerCase() === normalName) {
      return child;
    }
  }

  return undefined;
}

function findChildElementText(parentElement, elementName) {
  const childElement = findChildElementByName(parentElement, elementName);
  if (childElement) {
    const text = childElement.textContent;
    if (text) {
      return text.trim();
    }
  }

  return undefined;
}

function getElementName(element) {
  return element.localName.toLowerCase();
}

function decodeEntities(value, isAttributeValue = false) {
  return he.decode(value, { strict: false, isAttributeValue });
}
