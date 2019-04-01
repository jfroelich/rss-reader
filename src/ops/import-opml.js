import create_feeds from '/src/db/ops/create-feeds.js';
import * as resource_utils from '/src/db/resource-utils.js';

// Create and store feed objects in the database based on urls extracted from
// zero or more opml files. |files| should be a FileList or an Array.
export async function import_opml(conn, files) {
  console.log('Importing %d OPML files', files.length);

  // Grab urls from each of the files. Per-file errors are logged not thrown.
  const promises = Array.prototype.map.call(
      files, file => file_find_urls(file).catch(console.warn));
  const results = await Promise.all(promises);

  // Flatten results into a simple array of urls
  const urls = [];
  for (const result of results) {
    if (result) {
      for (const url of result) {
        urls.push(url);
      }
    }
  }

  // Filter dups
  const url_set = [], seen_hrefs = [];
  for (const url of urls) {
    if (!seen_hrefs.includes(url.href)) {
      url_set.push(url);
      seen_hrefs.push(url.href);
    }
  }

  const feeds = url_set.map(url => {
    const feed = {};
    feed.active = true;
    resource_utils.set_url(feed, url);
    return feed;
  });

  return create_feeds(conn, feeds);
}

// Return an array of outline urls (as URL objects) from OPML outline elements
// found in the plaintext representation of the given file
async function file_find_urls(file) {
  return find_outline_urls(parse_opml(await file_read_text(file)));
}

// Return an array of outline urls (as URL objects) from outlines found in an
// OPML document
export function find_outline_urls(doc) {
  // Assume the document is semi-well-formed. As a compromise between a deep
  // strict validation and no validation at all, use the CSS restricted-parent
  // selector syntax. We also do some filtering of outlines here up front to
  // only those with a type attribute because it is slightly better performance
  // and less code.
  const outlines = doc.querySelectorAll('opml > body > outline[type]');

  // Although I've never seen it in the wild, apparently OPML outline elements
  // can represent non-feed data. Use this pattern to restrict the outlines
  // considered to those properly configured.
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;

  const urls = [];
  for (const outline of outlines) {
    const type = outline.getAttribute('type');
    if (type_pattern.test(type)) {
      const xml_url_value = outline.getAttribute('xmlUrl');
      try {
        urls.push(new URL(xml_url_value));
      } catch (error) {
        // Ignore the error, skip the url
      }
    }
  }

  return urls;
}

export function file_read_text(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = _ => resolve(reader.result);
    reader.onerror = _ => reject(reader.error);
  });
}

export function parse_opml(xml_string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(xml_string, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new OPMLParseError(message);
  }

  // Need to normalize localName when document is xml-flagged
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new OPMLParseError('Document element is not opml: ' + name);
  }
  return document;
}

export class OPMLParseError extends Error {
  constructor(message = 'OPML parse error') {
    super(message);
  }
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}
