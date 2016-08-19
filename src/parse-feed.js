// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.parse_feed = function(document, excludeEntries) {
  console.assert(document, 'document is required');

  const docElement = document.documentElement;
  if(!docElement.matches('feed, rss, rdf')) {
    throw new Error('Unsupported document element: ' + docElement.nodeName);
  }

  const channel = find_channel(docElement);
  if(!channel) {
    throw new Error('Missing channel element');
  }

  const feed = new Feed();

  feed.type = get_feed_type(docElement);
  feed.title = find_child_element_text(channel, 'title');
  feed.description = find_child_element_text(channel,
    docElement.matches('feed') ? 'subtitle' : 'description');
  feed.link = find_feed_link(channel);
  feed.datePublished = find_feed_date_published(channel);

  if(!excludeEntries) {
    const entryElements = find_entries(channel);
    const entryObjects = entryElements.map(
      create_entry.bind(null, feed.datePublished));
    for(let entryObject of entryObjects) {
      feed.add_entry(entryObject);
    }
  }

  return feed;
};

function find_channel(documentElement) {
  if(documentElement.matches('feed')) {
    return documentElement;
  } else {
    return find_child_element_by_name(documentElement, 'channel');
  }
}

function find_entries(channel) {
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

function get_feed_type(documentElement) {
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

function find_feed_date_published(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');
  let dateText = null;
  if(isAtom) {
    dateText = find_child_element_text(channel, 'updated');
  } else {
    dateText = find_child_element_text(channel, 'pubdate') ||
      find_child_element_text(channel, 'lastbuilddate') ||
      find_child_element_text(channel, 'date');
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

function is_link_rel_alt(element) {
  return element.matches('link[rel="alternate"]');
}

function is_link_rel_self(element) {
  return element.matches('link[rel="self"]');
}

function is_link_with_href(element) {
  return element.matches('link[href]');
}

function is_link_without_href(element) {
  // return element.matches('link:not([href])');
  return element.localName === 'link' && !element.hasAttribute('href');
}

function find_feed_link(channel) {
  const isAtom = channel.ownerDocument.documentElement.matches('feed');

  let linkText = null;
  let linkElement = null;

  if(isAtom) {
    linkElement = find_child_element(channel, is_link_rel_alt) ||
      find_child_element(channel, is_link_rel_self) ||
      find_child_element(channel, is_link_with_href);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkElement = find_child_element(channel, is_link_without_href);
    if(linkElement) {
      linkText = linkElement.textContent;
    } else {
      linkElement = find_child_element(channel, is_link_with_href);
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

function create_entry(feedDatePublished, entryElement) {
  const isAtom = entryElement.ownerDocument.documentElement.matches('feed');

  const entryObject = new Entry();

  const title = find_child_element_text(entryElement, 'title');
  if(title) {
    entryObject.title = title;
  }

  const author = find_entry_author(entryElement);
  if(author) {
    entryObject.author = author;
  }

  // Set the link url as the entry's initial url
  const entryLinkURL = find_entry_link(entryElement);
  if(entryLinkURL) {
    entryObject.add_url(entryLinkURL);
  }

  const entryDatePublished = find_entry_date_published(entryElement);
  if(entryDatePublished) {
    entryObject.datePublished = entryDatePublished;
  } else if(feedDatePublished) {
    // Fall back to the feed's date
    entryObject.datePublished = feedDatePublished;
  } else {
    // TODO: actually i probably shouldn't infer this date and should leave it
    // as not set
    // Fall back to the current date
    entryObject.datePublished = new Date();
  }

  const content = find_entry_content(entryElement);
  if(content) {
    entryObject.content = content;
  }

  // TODO: move this into a helper function
  const enclosure = find_child_element_by_name(entryElement,
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
      'enclosure_length': enclosure.getAttribute('length'),
      'type': enclosure.getAttribute('type')
    };
  }

  return entryObject;
}

function find_entry_author(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  if(isAtom) {
    const author = find_child_element_by_name(entry, 'author');
    if(author) {
      return find_child_element_text(author, 'name');
    }
  } else {
    return find_child_element_text(entry, 'creator') ||
      find_child_element_text(entry, 'publisher');
  }
}

function find_entry_link(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let linkText;
  let linkElement;
  if(isAtom) {
    linkElement = find_child_element(entry,
        is_link_rel_alt) ||
      find_child_element(entry, is_link_rel_self) ||
      find_child_element(entry, is_link_with_href);
    if(linkElement) {
      linkText = linkElement.getAttribute('href');
    }
  } else {
    linkText = find_child_element_text(entry, 'origlink') ||
      find_child_element_text(entry, 'link');
  }

  if(linkText) {
    try {
      return new URL(linkText);
    } catch(exception) {
      console.debug(exception);
    }
  }
}

function find_entry_date_published(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let datePublishedString = null;

  if(isAtom) {
    datePublishedString = find_child_element_text(entry,
      'published') || find_child_element_text(entry, 'updated');
  } else {
    datePublishedString = find_child_element_text(entry, 'pubdate') ||
      find_child_element_text(entry, 'date');
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

function find_entry_content(entry) {
  const isAtom = entry.ownerDocument.documentElement.matches('feed');
  let result;
  if(isAtom) {
    // Special handling for some strange issue (CDATA-related?)
    const content = find_child_element_by_name(entry, 'content');
    const nodes = content ? content.childNodes : [];
    const map = Array.prototype.map;
    result = map.call(nodes, get_atom_node_text).join('').trim();
  } else {

    result = find_child_element_text(entry, 'encoded') ||
      find_child_element_text(entry, 'description') ||
      find_child_element_text(entry, 'summary');
  }
  return result;
}

function get_atom_node_text(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function find_child_element(parentElement, predicate) {
  for(let element = parentElement.firstElementChild; element;
    element = element.nextElementSibling) {
    if(predicate(element)) {
      return element;
    }
  }
}

function find_child_element_by_name(parentElement, localName) {

  function hasLocalName(element) {
    return element.localName === localName;
  }

  return find_child_element(parentElement, hasLocalName);
}

function find_child_element_text(element, localName) {
  const childElement = find_child_element_by_name(element, localName);
  if(childElement) {
    const childText = childElement.textContent;
    if(childText) {
      return childText.trim();
    }
  }
}

} // End file block scope
