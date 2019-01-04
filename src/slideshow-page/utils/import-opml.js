import * as db from '/src/db/db.js';
import {condense_whitespace} from '/src/condense-whitespace.js';

export function prompt() {
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'application/xml');
  input.onchange = input_onchange;
  input.click();
}

async function input_onchange(event) {
  const session = await db.open_with_channel();
  await import_files(session, event.target.files);
  session.close();
}

export async function import_files(session, files) {
  const read_files_results = await read_files(files);
  const url_array = flatten_file_urls(read_files_results);
  const url_array_set = dedup_urls(url_array);

  const feeds = url_array_set.map(url => {
    const feed = db.create_feed_object();
    db.append_feed_url(feed, url);
    return feed;
  });

  return db.create_feeds(session, feeds);
}

function read_files(files) {
  const promises = [];
  for (const file of files) {
    const promise = read_file_feeds(file);
    // If any one file fails to be read just log an error message and continue
    // instead of having the whole thing fail.
    const catch_promise = promise.catch(console.warn);
    promises.push(catch_promise);
  }
  return Promise.all(promises);
}

function flatten_file_urls(all_files_urls) {
  // per_file_urls may be undefined if there was a problem reading the file
  // that generated it

  const urls = [];
  for (const per_file_urls of all_files_urls) {
    if (per_file_urls) {
      for (const url of per_file_urls) {
        urls.push(url);
      }
    }
  }
  return urls;
}

async function read_file_feeds(file) {
  if (!file_is_opml(file)) {
    const msg = 'Unacceptable type ' + file.type + ' for file ' + file.name;
    throw new TypeError(msg);
  }

  if (!file.size) {
    return [];
  }

  const file_text = await file_read_text(file);
  const document = parse_opml(file_text);
  return find_feed_urls(document);
}

function dedup_urls(urls) {
  const url_set = [], seen = [];
  for (const url of urls) {
    if (!seen.includes(url.href)) {
      url_set.push(url);
      seen.push(url.href);
    }
  }
  return url_set;
}

function find_feed_urls(document) {
  const elements = document.querySelectorAll('opml > body > outline[type]');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const url = parse_url_noexcept(element.getAttribute('xmlUrl'));
      if (url) {
        urls.push(url);
      }
    }
  }
  return urls;
}

function parse_url_noexcept(url_string) {
  if (url_string) {
    try {
      return new URL(url_string);
    } catch (error) {
    }
  }
}

function file_is_opml(file) {
  const opml_mime_types = [
    'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
    'application/opml+xml'
  ];
  return opml_mime_types.includes(file.type);
}

function file_read_text(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}

function parse_opml(xml_string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new ParseError(condense_whitespace(error.textContent));
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new ParseError('Document element is not opml: ' + name);
  }
  return document;
}

export class ParseError extends Error {
  constructor(message = 'Parsing error') {
    super(message);
  }
}
