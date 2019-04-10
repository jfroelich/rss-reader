import '/third-party/he.js';
import {parse_xml} from '/lib/parse-xml.js';

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
export function parse_from_string(value) {
  return parse_from_document(parse_xml(value));
}

// Parses a Document object into a Feed object
export function parse_from_document(doc) {
  const doc_element = doc.documentElement;
  const doc_element_name = get_element_name(doc_element);

  const supported_feed_names = ['feed', 'rdf', 'rss'];
  if (!supported_feed_names.includes(doc_element_name)) {
    throw new Error('Unsupported document element ' + doc_element_name);
  }

  const chan_element = find_channel_element(doc_element);
  if (!chan_element) {
    throw new Error('Missing channel element');
  }

  const feed = new Feed();
  feed.type = find_feed_type(doc_element);
  feed.title = find_feed_title(chan_element);
  feed.description = find_feed_description(doc, chan_element);
  feed.link = find_feed_link(chan_element);
  feed.published_date = find_feed_date(chan_element);

  const entry_elements = find_entry_elements(chan_element);
  feed.entries = entry_elements.map(element_to_entry);
  feed_resolve_entry_urls(feed.entries, feed.link);

  return feed;
}

function find_feed_title(chan_element) {
  return find_child_element_text(chan_element, 'title');
}

function find_feed_description(doc, chan_element) {
  const doc_element = doc.documentElement;
  const doc_element_name = doc_element.localName.toLowerCase();
  const element_name = doc_element_name === 'feed' ? 'subtitle' : 'description';
  return find_child_element_text(chan_element, element_name);
}

function find_channel_element(doc_element) {
  if (doc_element.localName.toLowerCase() === 'feed') {
    return doc_element;
  } else {
    return find_child_element_by_name(doc_element, 'channel');
  }
}

function find_entry_elements(chan_element) {
  const doc_element = chan_element.ownerDocument.documentElement;
  const doc_element_name = get_element_name(doc_element);

  let parent_node, entry_element_name;
  if (doc_element_name === 'feed') {
    parent_node = doc_element;
    entry_element_name = 'entry';
  } else if (doc_element_name === 'rdf') {
    parent_node = doc_element;
    entry_element_name = 'item';
  } else if (doc_element_name === 'rss') {
    parent_node = chan_element;
    entry_element_name = 'item';
  } else {
    throw new Error('Reached unreachable');
  }

  const entries = [];
  for (let c = parent_node.firstElementChild; c; c = c.nextElementSibling) {
    if (get_element_name(c) === entry_element_name) {
      entries.push(c);
    }
  }
  return entries;
}

function find_feed_type(doc_element) {
  return doc_element.localName.toLowerCase();
}

function find_feed_date(chan_element) {
  const doc_element = chan_element.ownerDocument.documentElement;
  const feed_type = find_feed_type(doc_element);

  let date_text;
  if (feed_type === 'feed') {
    date_text = find_child_element_text(chan_element, 'updated');
  } else {
    date_text = find_child_element_text(chan_element, 'pubdate');
    date_text =
        date_text || find_child_element_text(chan_element, 'lastbuilddate');
    date_text = date_text || find_child_element_text(chan_element, 'date');
  }

  if (!date_text) {
    return;
  }

  let feed_date;
  try {
    feed_date = new Date(date_text);
  } catch (error) {
  }

  return feed_date;
}

function find_atom_link_element(chan_element) {
  let link_element = find_child_element(chan_element, element_is_link_rel_alt);
  if (link_element) {
    return link_element;
  }

  link_element = find_child_element(chan_element, element_is_link_rel_self);
  if (link_element) {
    return link_element;
  }

  link_element = find_child_element(chan_element, element_is_link_with_href);
  return link_element;
}

function find_feed_link(chan_element) {
  const doc_element = chan_element.ownerDocument.documentElement;
  const doc_element_name = get_element_name(doc_element);
  let link_text, link_element;
  if (doc_element_name === 'feed') {
    link_element = find_atom_link_element(chan_element);
    if (link_element) {
      link_text = link_element.getAttribute('href');
    }
  } else {
    link_element =
        find_child_element(chan_element, element_is_link_without_href);
    if (link_element) {
      link_text = link_element.textContent;
    } else {
      link_element =
          find_child_element(chan_element, element_is_link_with_href);
      if (link_element) {
        link_text = link_element.getAttribute('href');
      }
    }
  }

  return link_text;
}

function element_is_link_rel_alt(element) {
  return element.matches('link[rel="alternate"]');
}

function element_is_link_rel_self(element) {
  return element.matches('link[rel="self"]');
}

function element_is_link_with_href(element) {
  return element.matches('link[href]');
}

function element_is_link_without_href(element) {
  return element.localName === 'link' && !element.hasAttribute('href');
}

function element_to_entry(entry_element) {
  const entry = new Entry();
  entry.title = find_entry_title(entry_element);
  entry.author = find_entry_author(entry_element);
  entry.link = find_entry_link(entry_element);
  entry.published_date = find_entry_date(entry_element);
  entry.content = find_entry_content(entry_element);
  entry.enclosure = find_entry_enclosure(entry_element);
  return entry;
}

function find_entry_title(entry_element) {
  return find_child_element_text(entry_element, 'title');
}

function find_entry_enclosure(entry_element) {
  const enclosure_element =
      find_child_element_by_name(entry_element, 'enclosure');

  if (enclosure_element) {
    const enclosure = {};
    enclosure.url = enclosure_element.getAttribute('url');
    enclosure.enclosure_length = enclosure_element.getAttribute('length');
    enclosure.type = enclosure_element.getAttribute('type');
    return enclosure;
  }
}

function find_entry_author(entry_element) {
  const author_element = find_child_element_by_name(entry_element, 'author');
  if (author_element) {
    const author_name = find_child_element_text(author_element, 'name');
    if (author_name) {
      return author_name;
    }
  }

  const creator = find_child_element_text(entry_element, 'creator');
  if (creator) {
    return creator;
  }
  return find_child_element_text(entry_element, 'publisher');
}

function find_entry_link(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  const doc_element_name = get_element_name(doc_element);
  let link_text;
  if (doc_element_name === 'feed') {
    let link = find_child_element(entry_element, element_is_link_rel_alt);
    link = link || find_child_element(entry_element, element_is_link_rel_self);
    link = link || find_child_element(entry_element, element_is_link_with_href);
    link_text = link ? link.getAttribute('href') : undefined;
  } else {
    link_text = find_child_element_text(entry_element, 'origlink');
    link_text = link_text || find_child_element_text(entry_element, 'link');
  }
  return link_text;
}

function find_entry_date(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  const doc_element_name = get_element_name(doc_element);
  let date_string;
  if (doc_element_name === 'feed') {
    date_string = find_child_element_text(entry_element, 'published') ||
        find_child_element_text(entry_element, 'updated');
  } else {
    date_string = find_child_element_text(entry_element, 'pubdate') ||
        find_child_element_text(entry_element, 'date');
  }
  if (!date_string) {
    return;
  }

  let entry_date;
  try {
    entry_date = new Date(date_string);
  } catch (error) {
    console.debug(error);
  }
  return entry_date;
}

function find_entry_content(entry_element) {
  const doc_element = entry_element.ownerDocument.documentElement;
  const doc_element_name = get_element_name(doc_element);
  let result;
  if (doc_element_name === 'feed') {
    const content = find_child_element_by_name(entry_element, 'content');

    if (!content) {
      return;
    }

    const nodes = content.childNodes;
    const texts = [];
    for (let node of nodes) {
      if (node.nodeType === Node.CDATA_SECTION_NODE) {
        let node_value = node.nodeValue;
        const is_attr_value = false;
        node_value = decode_entities(node_value, is_attr_value);
        texts.push(node_value);
      } else if (node.nodeType === Node.TEXT_NODE) {
        const node_text = node.textContent;
        texts.push(node_text);
      } else {
        console.warn('Unknown node type, next message is dir inspection');
        console.dir(node);
      }
    }

    result = texts.join('').trim();
  } else {
    result = find_child_element_text(entry_element, 'encoded');
    result = result || find_child_element_text(entry_element, 'description');
    result = result || find_child_element_text(entry_element, 'summary');
  }
  return result;
}

function feed_resolve_entry_urls(entries, feed_link_url_string) {
  if (!feed_link_url_string) {
    return;
  }

  let base_url;
  try {
    base_url = new URL(feed_link_url_string);
  } catch (error) {
    console.debug('Invalid base url', feed_link_url_string);
    return;
  }

  for (const entry of entries) {
    if (entry.link) {
      try {
        const url = new URL(entry.link, base_url);
        entry.link = url.href;
      } catch (error) {
        console.debug(error);
      }
    }
  }
}

function find_child_element(parent_element, predicate) {
  for (let e = parent_element.firstElementChild; e; e = e.nextElementSibling) {
    if (predicate(e)) {
      return e;
    }
  }
}

function find_child_element_by_name(parent, name) {
  if (!(parent instanceof Element)) {
    throw new Error('Expected element, got ' + typeof Element);
  }

  if (typeof name !== 'string') {
    throw new Error('Expected string, got ' + typeof name);
  }

  const normal_name = name.toLowerCase();
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if (c.localName.toLowerCase() === normal_name) {
      return c;
    }
  }
}

function find_child_element_text(parent_element, element_name) {
  const child_element =
      find_child_element_by_name(parent_element, element_name);
  if (child_element) {
    const text = child_element.textContent;
    if (text) {
      return text.trim();
    }
  }
}

function get_element_name(element) {
  return element.localName.toLowerCase();
}

function decode_entities(value, is_attr_value = false) {
  return he.decode(value, {strict: false, isAttributeValue: is_attr_value});
}
