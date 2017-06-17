// See license.md

'use strict';

// Parses the input string into a feed object
// @param string {String} the text to parse
// @returns {Object} an object representing the parsed feed and its entries
function jrFeedParserParseFromString(string) {
  const doc = jrFeedParserParseXML(string);
  return jrFeedParserConvertDocumentToFeed(doc);
}

// Parse the string into an XML document
// Throws if there is a parsing error
function jrFeedParserParseXML(string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(string, 'application/xml');
  const error = doc.querySelector('parsererror');
  if(error)
    throw new Error(error.textContent);
  return doc;
}

// @param doc {Document} an XML document representing a feed
// @returns {Object} a simple object representing a feed
function jrFeedParserConvertDocumentToFeed(doc) {
  const name = doc.documentElement.localName.toLowerCase();
  if(name !== 'feed' && name !== 'rss' && name !== 'rdf')
    throw new Error('Invalid document element');
  const channel = jrFeedParserFindChannel(doc.documentElement);
  if(!channel)
    throw new Error('Missing channel element');
  return {
    'type': jrFeedParserFindFeedType(doc.documentElement),
    'title': jrFeedParserFindFeedTitle(channel),
    'description': jrFeedParserFindFeedDescription(doc, channel),
    'link': jrFeedParserFindFeedLink(channel),
    'datePublished': jrFeedParserFindFeedDate(channel),
    'entries': jrFeedParserFindEntries(channel).map(jrFeedParserCreateEntry)
  };
}

function jrFeedParserFindFeedTitle(channel) {
  return jrFeedParserFindChildText(channel, 'title');
}

function jrFeedParserFindFeedDescription(doc, channel) {
  const docElement = doc.documentElement;
  const name = docElement.localName.toLowerCase() === 'feed' ?
    'subtitle' : 'description';
  return jrFeedParserFindChildText(channel, name);
}

function jrFeedParserFindChannel(docElement) {
  if(docElement.localName.toLowerCase() === 'feed')
    return docElement;
  else
    return jrFeedParserFindChildByName(docElement, 'channel');
}

function jrFeedParserFindEntries(channel) {
  const docElement = channel.ownerDocument.documentElement;
  const rootName = docElement.localName.toLowerCase();
  const entries = [];
  let parent, name;

  if(rootName === 'feed') {
    parent = docElement;
    name = 'entry';
  } else if(rootName === 'rdf') {
    parent = docElement;
    name = 'item';
  } else if(rootName === 'rss') {
    parent = channel;
    name = 'item';
  } else {
    throw new Error(`Unsupported document element ${docElement.nodeName}`);
  }

  for(let e = parent.firstElementChild; e; e = e.nextElementSibling) {
    if(e.localName.toLowerCase() === name)
      entries.push(e);
  }

  return entries;
}

function jrFeedParserFindFeedType(docElement) {
  return docElement.localName.toLowerCase();
}

function jrFeedParserFindFeedDate(channel) {
  const docElement = channel.ownerDocument.documentElement;
  let dateText;
  if(docElement.localName.toLowerCase() === 'feed') {
    dateText = jrFeedParserFindChildText(channel, 'updated');
  } else {
    dateText = jrFeedParserFindChildText(channel, 'pubdate');
    dateText = dateText || jrFeedParserFindChildText(channel, 'lastbuilddate');
    dateText = dateText || jrFeedParserFindChildText(channel, 'date');
  }

  if(!dateText)
    return;
  try {
    return new Date(dateText);
  } catch(error) {
    console.warn(error);
  }
}

function jrFeedParserFindFeedLink(channel) {
  const docElement = channel.ownerDocument.documentElement;
  let linkText, linkElement;
  if(docElement.localName.toLowerCase() === 'feed') {
    linkElement = jrFeedParserFindChild(channel, jrFeedParserIsLinkRelAlt);
    linkElement = linkElement ||
      jrFeedParserFindChild(channel, jrFeedParserIsLinkRelSelf);
    linkElement = linkElement ||
      jrFeedParserFindChild(channel, jrFeedParserIsLinkWithHref);
    if(linkElement)
      linkText = linkElement.getAttribute('href');
  } else {
    linkElement = jrFeedParserFindChild(channel,
      jrFeedParserIsLinkWithoutHref);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = jrFeedParserFindChild(channel,
        jrFeedParserIsLinkWithHref);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  return linkText;
}

function jrFeedParserIsLinkRelAlt(element) {
  return element.matches('link[rel="alternate"]');
}

function jrFeedParserIsLinkRelSelf(element) {
  return element.matches('link[rel="self"]');
}

function jrFeedParserIsLinkWithHref(element) {
  return element.matches('link[href]');
}

function jrFeedParserIsLinkWithoutHref(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function jrFeedParserCreateEntry(entry) {
  return {
    'title': jrFeedParserFindEntryTitle(entry),
    'author': jrFeedParserFindEntryAuthor(entry),
    'link': jrFeedParserFindEntryLink(entry),
    'datePublished': jrFeedParserFindEntryDate(entry),
    'content': jrFeedParserFindEntryContent(entry),
    'enclosure': jrFeedParserFindEntryEnclosure(entry)
  };
}

function jrFeedParserFindEntryTitle(entry) {
  return jrFeedParserFindChildText(entry, 'title');
}

function jrFeedParserFindEntryEnclosure(entry) {
  const enclosureElement = jrFeedParserFindChildByName(entry, 'enclosure');
  if(enclosureElement) {
    const enclosureObject = {};
    enclosureObject.url = enclosureElement.getAttribute('url');
    // Cannot use property 'length'
    enclosureObject.enclosure_length = enclosureElement.getAttribute('length');
    enclosureObject.type = enclosureElement.getAttribute('type');
    return enclosureObject;
  }
}

function jrFeedParserFindEntryAuthor(entry) {
  const author = jrFeedParserFindChildByName(entry, 'author');
  if(author) {
    const name = jrFeedParserFindChildText(author, 'name');
    if(name)
      return name;
  }

  const creator = jrFeedParserFindChildText(entry, 'creator');
  if(creator)
    return creator;
  return jrFeedParserFindChildText(entry, 'publisher');
}

function jrFeedParserFindEntryLink(entry) {
  const docElement = entry.ownerDocument.documentElement;
  let linkText;
  if(docElement.localName.toLowerCase() === 'feed') {
    let link = jrFeedParserFindChild(entry, jrFeedParserIsLinkRelAlt);
    link = link || jrFeedParserFindChild(entry, jrFeedParserIsLinkRelSelf);
    link = link || jrFeedParserFindChild(entry, jrFeedParserIsLinkWithHref);
    linkText = link ? link.getAttribute('href') : undefined;
  } else {
    linkText = jrFeedParserFindChildText(entry, 'origlink');
    linkText = linkText || jrFeedParserFindChildText(entry, 'link');
  }
  return linkText;
}

function jrFeedParserFindEntryDate(entry) {
  const docElement = entry.ownerDocument.documentElement;
  let dateStr;
  if(docElement.localName.toLowerCase() === 'feed')
    dateStr = jrFeedParserFindChildText(entry, 'published') ||
      jrFeedParserFindChildText(entry, 'updated');
  else
    dateStr = jrFeedParserFindChildText(entry, 'pubdate') ||
      jrFeedParserFindChildText(entry, 'date');
  if(!dateStr)
    return;
  try {
    return new Date(dateStr);
  } catch(exception) {
    console.warn(exception);
  }
}

function jrFeedParserFindEntryContent(entry) {
  const docElement = entry.ownerDocument.documentElement;
  let result;
  if(docElement.localName.toLowerCase() === 'feed') {
    const content = jrFeedParserFindChildByName(entry, 'content');
    const nodes = content ? content.childNodes : [];
    result = Array.prototype.map.call(nodes,
      jrFeedParserGetAtomNodeText).join('').trim();
  } else {
    result = jrFeedParserFindChildText(entry, 'encoded');
    result = result || jrFeedParserFindChildText(entry, 'description');
    result = result || jrFeedParserFindChildText(entry, 'summary');
  }
  return result;
}

function jrFeedParserGetAtomNodeText(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function jrFeedParserFindChild(parent, predicate) {
  for(let el = parent.firstElementChild; el; el = el.nextElementSibling) {
    if(predicate(el))
      return el;
  }
}

function jrFeedParserFindChildByName(parent, name) {
  const lowerName = name.toLowerCase();
  for(let el = parent.firstElementChild; el; el = el.nextElementSibling) {
    if(el.localName.toLowerCase() === lowerName)
      return el;
  }
}

function jrFeedParserFindChildText(parent, name) {
  const child = jrFeedParserFindChildByName(parent, name);
  const text = child ? child.textContent : null;
  return text ? text.trim() : null;
}
