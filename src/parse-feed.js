// See license.md
'use strict';

{ // Begin file block scope

// Parses the input string into a feed object
// @param string {String} the text to parse
// @returns {Object} an object representing the parsed feed and its entries
function parse_feed(string) {
  const doc = parse_xml(string);
  return convert_doc_to_feed(doc);
}

function parse_xml(string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(string, 'application/xml');
  const error_element = document.querySelector('parsererror');
  if(error_element)
    throw new Error(error_element.textContent);
  return document;
}

// @param document {Document} an XML document representing a feed
// @returns {Object} a simple object with properties feed and entries
function convert_doc_to_feed(document) {
  const doc_element = document.documentElement;
  const doc_element_name = doc_element.localName.toLowerCase();
  if(doc_element_name !== 'feed' && doc_element_name !== 'rss' &&
    doc_element_name !== 'rdf')
    throw new TypeError('document contains invalid document element');

  const channel_element = find_channel_element(doc_element);
  if(!channel_element)
    throw new TypeError('document does not contain channel element');

  const feed = {};
  feed.type = find_feed_type(doc_element);
  feed.title = find_feed_title(channel_element);
  feed.description = find_feed_description(document, channel_element);
  feed.link = find_feed_link(channel_element);
  feed.datePublished = find_feed_date(channel_element);

  const entry_objects = [];
  const entry_elements = find_entry_elements(channel_element);
  for(const entry_element of entry_elements)
    entry_objects.push(create_entry_object(entry_element));

  const result = {};
  result.feed = feed;
  result.entries = entry_objects;
  return result;
}

function find_feed_title(channel_element) {
  return find_child_element_text(channel_element, 'title');
}

function find_feed_description(document, channel_element) {
  const doc_element = document.documentElement;
  const doc_element_name = doc_element.localName.toLowerCase();
  const element_name = doc_element_name === 'feed' ? 'subtitle' : 'description';
  return find_child_element_text(channel_element, element_name);
}

function find_channel_element(doc_element) {
  if(doc_element.localName.toLowerCase() === 'feed')
    return doc_element;
  else
    return find_child_element_by_name(doc_element, 'channel');
}

function find_entry_elements(channel_element) {
  const doc_element = channel_element.ownerDocument.documentElement;
  const doc_element_name = doc_element.localName.toLowerCase();
  const entries = [];
  let parent_node, entry_element_name;

  if(doc_element_name === 'feed') {
    parent_node = doc_element;
    entry_element_name = 'entry';
  } else if(doc_element_name === 'rdf') {
    parent_node = doc_element;
    entry_element_name = 'item';
  } else if(doc_element_name === 'rss') {
    parent_node = channel_element;
    entry_element_name = 'item';
  } else {
    throw new Error(`Invalid document element ${doc_element.nodeName}`);
  }

  for(let child_element = parent_node.firstElementChild; child_element;
    child_element = child_element.nextElementSibling)
    if(child_element.localName.toLowerCase() === entry_element_name)
      entries.push(child_element);
  return entries;
}

function find_feed_type(doc_element) {
  return doc_element.localName.toLowerCase();
}

function find_feed_date(channel_element) {
  const doc_element = channel_element.ownerDocument.documentElement;
  const feed_type = find_feed_type(doc_element);

  let date_text;
  if(feed_type === 'feed')
    date_text = find_child_element_text(channel_element, 'updated');
  else {
    date_text = find_child_element_text(channel_element, 'pubdate');
    date_text = date_text || find_child_element_text(channel_element,
      'lastbuilddate');
    date_text = date_text || find_child_element_text(channel_element, 'date');
  }

  if(!date_text)
    return;

  let feed_date;
  try {
    feed_date = new Date(date_text);
  } catch(error) {
  }
  return feed_date;
}

function find_feed_link(channel_element) {
  const doc_element = channel_element.ownerDocument.documentElement;

  let link_text, link_element;
  if(doc_element.localName.toLowerCase() === 'feed') {
    link_element = find_child_element(channel_element, is_link_rel_alt_element);
    link_element = link_element ||
      find_child_element(channel_element, is_link_rel_self_element);
    link_element = link_element ||
      find_child_element(channel_element, is_link_with_href_element);
    if(link_element)
      link_text = link_element.getAttribute('href');
  } else {
    link_element = find_child_element(channel_element,
      is_link_without_href_element);
    if(link_element)
      link_text = link_element.textContent;
    else {
      link_element = find_child_element(channel_element,
        is_link_with_href_element);
      if(link_element)
        link_text = link_element.getAttribute('href');
    }
  }

  return link_text;
}

function is_link_rel_alt_element(element) {
  return element.matches('link[rel="alternate"]');
}

function is_link_rel_self_element(element) {
  return element.matches('link[rel="self"]');
}

function is_link_with_href_element(element) {
  return element.matches('link[href]');
}

function is_link_without_href_element(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function create_entry_object(entry_element) {
  return {
    'title': find_entry_title(entry_element),
    'author': find_entry_author(entry_element),
    'link': find_entry_link(entry_element),
    'datePublished': find_entry_date(entry_element),
    'content': find_entry_content(entry_element),
    'enclosure': find_entry_enclosure(entry_element)
  };
}

function find_entry_title(entry_element) {
  return find_child_element_text(entry_element, 'title');
}

function find_entry_enclosure(entry_element) {
  const enclosure_element = find_child_element_by_name(entry_element,
    'enclosure');

  if(enclosure_element) {
    const enclosure_object = {};
    enclosure_object.url = enclosure_element.getAttribute('url');
    enclosure_object.enclosureLength = enclosure_element.getAttribute('length');
    enclosure_object.type = enclosure_element.getAttribute('type');
    return enclosure_object;
  }
}

function find_entry_author(entry_element) {
  const author_element = find_child_element_by_name(entry_element, 'author');
  if(author_element) {
    const author_name_text = find_child_element_text(author_element, 'name');
    if(author_name_text)
      return author_name_text;
  }

  const creator_text = find_child_element_text(entry_element, 'creator');
  if(creator_text)
    return creator_text;
  return find_child_element_text(entry_element, 'publisher');
}

function find_entry_link(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  let link_text;
  if(doc_element.localName.toLowerCase() === 'feed') {
    let link = find_child_element(entry_element, is_link_rel_alt_element);
    link = link || find_child_element(entry_element, is_link_rel_self_element);
    link = link || find_child_element(entry_element, is_link_with_href_element);
    link_text = link ? link.getAttribute('href') : undefined;
  } else {
    link_text = find_child_element_text(entry_element, 'origlink');
    link_text = link_text || find_child_element_text(entry_element, 'link');
  }
  return link_text;
}

function find_entry_date(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  let date_string;
  if(doc_element.localName.toLowerCase() === 'feed') {
    date_string = find_child_element_text(entry_element, 'published') ||
      find_child_element_text(entry_element, 'updated');
  } else {
    date_string = find_child_element_text(entry_element, 'pubdate') ||
      find_child_element_text(entry_element, 'date');
  }
  if(!date_string)
    return;
  let entry_date;
  try {
    entry_date = new Date(date_string);
  } catch(exception) {
  }
  return entry_date;
}

function find_entry_content(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  let result;
  if(doc_element.localName.toLowerCase() === 'feed') {
    const content = find_child_element_by_name(entry_element, 'content');
    const nodes = content ? content.childNodes : [];
    const texts = [];
    for(let node of nodes) {
      const node_text = get_atom_node_text(node);
      texts.push(node_text);
    }

    result = texts.join('').trim();
  } else {
    result = find_child_element_text(entry_element, 'encoded');
    result = result || find_child_element_text(entry_element, 'description');
    result = result || find_child_element_text(entry_element, 'summary');
  }
  return result;
}

function get_atom_node_text(node) {
  return node.nodeType === Node.ELEMENT_NODE ?
    node.innerHTML : node.textContent;
}

function find_child_element(parent_element, predicate) {
  for(let element = parent_element.firstElementChild; element;
    element = element.nextElementSibling)
    if(predicate(element))
      return element;
}

function find_child_element_by_name(parent_element, element_name) {
  const normal_element_name = element_name.toLowerCase();
  for(let child_element = parent_element.firstElementChild; child_element;
    child_element = child_element.nextElementSibling)
    if(child_element.localName.toLowerCase() === normal_element_name)
      return child_element;
}

function find_child_element_text(parent_element, element_name) {
  const child_element = find_child_element_by_name(parent_element,
    element_name);
  if(child_element) {
    const child_element_text = child_element.textContent;
    if(child_element_text)
      return child_element_text.trim();
  }
}

this.parse_feed = parse_feed;

} // End file block scope
