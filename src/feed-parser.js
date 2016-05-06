// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: now that the parser sets the type property, all the other code needs
// to support it (e.g. save it, update it properly) - this is a general note

// TODO: store URL strings as URL objects

// Lib for unmarshalling an xml document into a feed object. The values stored
// in the feed object are not sanitized, and should be sanitized later by the
// caller before rendering/storing
// Requires: /src/string.js

// Unmarshall an xml document into a feed object
function feed_parser_parse_document(document) {
  const documentElement = document.documentElement;
  if(!documentElement) {
    throw new Error('Undefined document element');
  }

  // NOTE: selector must be lowercase to match, I do not have a clear
  // understanding of why, i suppose it is related to the document being
  // xml-flagged?

  if(!documentElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' +
      documentElement.nodeName);
  }

  const channel = feed_parser_find_channel(documentElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = {};
  feed.type = feed_parser_get_feed_type(documentElement);
  feed.title = feed_parser_find_child_element_text(channel, 'TITLE');
  feed.description = feed_parser_find_child_element_text(channel,
    documentElement.matches('feed') ? 'SUBTITLE' : 'DESCRIPTION');
  feed.date = feed_parser_get_feed_date(channel);
  feed.link = feed_parser_get_feed_link(channel);

  const entryElements = feed_parser_get_entries(channel);
  feed.entries = entryElements.map(feed_parser_parse_entry);
  return feed;
}

function feed_parser_find_channel(documentElement) {
  if(documentElement.matches('feed')) {
    return documentElement;
  } else {
    return feed_parser_find_child_element_by_name(documentElement, 'CHANNEL');
  }
}

function feed_parser_get_entries(channelElement) {
  const documentElement = channelElement.ownerDocument.documentElement;
  const entries = [];
  let entryParent;
  let entryNodeName;

  if(documentElement.matches('feed')) {
    entryParent = documentElement;
    entryNodeName = 'ENTRY';
  } else if(documentElement.matches('rdf')) {
    entryParent = documentElement;
    entryNodeName = 'ITEM';
  } else {
    entryParent = channelElement;
    entryNodeName = 'ITEM';
  }

  // TODO: this should probably be delegated to some general purpose
  // dom-find-all or dom-filter-children function
  for(let element = entryParent.firstElementChild; element;
    element = element.nextElementSibling) {
    if(utils.string.equalsIgnoreCase(element.nodeName, entryNodeName)) {
      entries.push(element);
    }
  }

  return entries;
}

// Returns a lowercase type of the feed's type
// TODO: maybe this shouldn't assume validity and should also check
// for whether matches rss, and otherwise return null/undefined.
function feed_parser_get_feed_type(documentElement) {
  let typeString = null;
  if(documentElement.matches('feed')) {
    typeString = 'feed';
  } else if(documentElement.matches('rdf')) {
    typeString = 'rdf';
  } else {
    typeString = 'rss';
  }

  return typeString;
}

function feed_parser_get_feed_date(channelElement) {
  const isAtom = channelElement.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    return feed_parser_find_child_element_text(channelElement, 'UPDATED');
  } else {
    return feed_parser_find_child_element_text(channelElement, 'PUBDATE') ||
      feed_parser_find_child_element_text(channelElement, 'LASTBUILDDATE') ||
      feed_parser_find_child_element_text(channelElement, 'DATE');
  }
}

function feed_parser_is_link_rel_alternate(element) {
  // TODO: maybe just use element.matches('link[rel="alternate"]')

  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    utils.string.equalsIgnoreCase(element.getAttribute('rel'), 'ALTERNATE');
}

function feed_parser_is_link_rel_self(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    utils.string.equalsIgnoreCase(element.getAttribute('rel'), 'SELF');
}

function feed_parser_is_link_with_href(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    element.hasAttribute('href');
}

// NOTE: this is not necessarily the simple inverse of
// feed_parser_is_link_with_href, because that could be any element
function feed_parser_is_link_without_href(element) {
  return utils.string.equalsIgnoreCase(element.nodeName, 'LINK') &&
    !element.hasAttribute('href');
}

function feed_parser_get_feed_link(channelElement) {
  const isAtom = channelElement.ownerDocument.documentElement.matches('feed');

  let linkText, linkElement;
  if(isAtom) {
    linkElement = feed_parser_find_child_element(channelElement,
      feed_parser_is_link_rel_alternate) ||
      feed_parser_find_child_element(channelElement,
        feed_parser_is_link_rel_self) ||
      feed_parser_find_child_element(channelElement,
        feed_parser_is_link_with_href);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }

  } else {
    linkElement = feed_parser_find_child_element(channelElement,
      feed_parser_is_link_without_href);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = feed_parser_find_child_element(channelElement,
        feed_parser_is_link_with_href);
      if(linkElement)
        linkText = linkElement.getAttribute('href');
    }
  }

  if(linkText) {
    return linkText.trim();
  }
}

// TODO: maybe I should define an Entry object within entry.js and this
// should create a new Entry object and populate its fields
function feed_parser_parse_entry(entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');
  const result = {};
  result.title = feed_parser_find_child_element_text(entryElement, 'TITLE');
  result.author = feed_parser_get_entry_author(entryElement);
  result.link = feed_parser_get_entry_link(entryElement);
  result.pubdate = feed_parser_get_entry_date(entryElement);
  result.content = feed_parser_get_entry_content(entryElement);

  // NOTE: An enclosure is once per item
  // TODO: i suppose the url resolution processing that happens in other Lib
  // needs to remember to also account for enclosure urls, most enc urls are
  // absolute so it is not an urgent issue
  // TODO: move this into a separate function similar to the helper functions
  // for other entry fields
  const enclosure = feed_parser_find_child_element_by_name(entryElement,
    'ENCLOSURE');
  if(enclosure) {
    result.enclosure = {
      url: enclosure.getAttribute('url'),
      length: enclosure.getAttribute('length'),
      type: enclosure.getAttribute('type')
    };
  }

  return result;
}

function feed_parser_get_entry_author(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = feed_parser_find_child_element_by_name(entry, 'AUTHOR');
    if(author) {
      return feed_parser_find_child_element_text(author, 'NAME');
    }
  } else {
    return feed_parser_find_child_element_text(entry, 'CREATOR') ||
      feed_parser_find_child_element_text(entry, 'PUBLISHER');
  }
}

function feed_parser_get_entry_link(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');

  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = feed_parser_find_child_element(entry,
        feed_parser_is_link_rel_alternate) ||
      feed_parser_find_child_element(entry, feed_parser_is_link_rel_self) ||
      feed_parser_find_child_element(entry, feed_parser_is_link_with_href);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = feed_parser_find_child_element_text(entry, 'ORIGLINK') ||
      feed_parser_find_child_element_text(entry, 'LINK');
  }
  if(linkText) {
    linkText = linkText.trim();
  }
  return linkText;
}

function feed_parser_get_entry_date(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let value = null;

  if(isAtom) {
    value = feed_parser_find_child_element_text(entry, 'PUBLISHED') ||
      feed_parser_find_child_element_text(entry, 'UPDATED');
  } else {
    value = feed_parser_find_child_element_text(entry, 'PUBDATE') ||
      feed_parser_find_child_element_text(entry, 'DATE');
  }

  if(value) {
    value = value.trim();
  }

  return value;
}

function feed_parser_get_entry_content(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;

  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = feed_parser_find_child_element_by_name(entry, 'CONTENT');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes,
      feed_parser_get_atom_entry_content).join('').trim();
  } else {

    // TODO: now that I am using nodeName, look into whether
    // content:encoded still works, my instinct is no

    result = feed_parser_find_child_element_text(entry, 'ENCODED') ||
      feed_parser_find_child_element_text(entry, 'DESCRIPTION') ||
      feed_parser_find_child_element_text(entry, 'SUMMARY');
  }
  return result;
}

function feed_parser_get_atom_entry_content(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

// TODO: move into general purpose dom.js module
function feed_parser_find_child_element(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function feed_parser_find_child_element_by_name(parentElement, nodeName) {
  // NOTE: nodeName is possibly or always lowercase, this has something to
  // do with the document containing the node being xml
  // I know that we are needlessly uppercasing the name each time here, but
  // I like using the same function call used everywhere where names are tested
  function isNodeNameEqual(element) {
    return utils.string.equalsIgnoreCase(element.nodeName, nodeName);
  }

  return feed_parser_find_child_element(parentElement, isNodeNameEqual);
}

function feed_parser_find_child_element_text(element, nodeName) {
  const childElement = feed_parser_find_child_element_by_name(element,
    nodeName);

  if(childElement) {
    const childText = childElement.textContent;
    if(childText) {
      return childText.trim();
    }
  }
}
