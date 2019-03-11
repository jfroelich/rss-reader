import {assert} from '/src/assert.js';

// Create and store feed objects in the database based on urls extracted from
// zero or more opml files. |files| should be a FileList or an Array.
export async function import_opml(session, files) {
  // TODO: stricter guard
  assert(files);
  console.log('Importing %d OPML files', files.length);

  // Grab urls from each of the files. Per-file errors are logged not thrown.
  const promises = Array.prototype.map.call(files, file => {
    const promise = read_feeds_from_file(file);
    return promise.catch(console.warn);
  });
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
  // TODO: use array-utils.unique_compute
  const url_set = [], seen_hrefs = [];
  for (const url of urls) {
    if (!seen_hrefs.includes(url.href)) {
      url_set.push(url);
      seen_hrefs.push(url.href);
    }
  }

  // Convert urls into feeds
  const feeds = url_set.map(url => {
    const feed = new Feed();
    feed.appendURL(url);
    return feed;
  });

  return session.createFeeds(feeds);
}

async function read_feeds_from_file(file) {
  // TODO: this is user input, not programmer input, because we do not want to
  // place the burden on the caller to provide the correct file type. Therefore
  // this should just log a warning and return an empty array?
  // TODO: maybe we should not be trying to consider the mime type at all, and
  // just allow the parsing to fail later.
  const opml_mime_types = [
    'application/xml', 'application/xhtml+xml', 'text/xml', 'text/x-opml',
    'application/opml+xml'
  ];
  if (!opml_mime_types.includes(file.type)) {
    const msg = 'Unacceptable type ' + file.type + ' for file ' + file.name;
    throw new TypeError(msg);
  }

  if (!file.size) {
    return [];
  }

  const file_text = await file_read_text(file);
  const document = parse_opml(file_text);

  const elements = document.querySelectorAll('opml > body > outline[type]');
  const type_pattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (type_pattern.test(type)) {
      const url_string = element.getAttribute('xmlUrl');
      try {
        const url = new URL(url_string);
        urls.push(url);
      } catch (error) {
        // Ignore the error, skip the url
        console.debug('Invalid opml outline url', url_string, error);
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