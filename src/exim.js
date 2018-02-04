import {open as openIconDb} from '/src/favicon-service.js';
import subscribe from '/src/feed-ops/subscribe.js';
import {feed_peek_url, open as openReaderDb, reader_db_get_feeds} from '/src/rdb.js';

// Returns an opml document as a blob that contains outlines representing the
// feeds in the app's db
// @param conn {IDBDatabase} optional, an open connection to the reader database
// @param title {String} optional, the value to use for the title element in the
// document
export async function export_opml(conn, title) {
  const feeds = await reader_db_get_feeds(conn);

  // Create a generic opml document
  const doc = document.implementation.createDocument(null, 'opml', null);
  doc.documentElement.setAttribute('version', '2.0');

  const headElement = doc.createElement('head');
  doc.documentElement.appendChild(headElement);

  const titleElement = doc.createElement('title');
  if (title) {
    titleElement.textContent = title;
  }

  const currentDate = new Date();
  const currentUTCString = currentDate.toUTCString();

  const dateCreatedElement = doc.createElement('datecreated');
  dateCreatedElement.textContent = currentUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = doc.createElement('datemodified');
  dateModifiedElement.textContent = currentUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = doc.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = doc.createElement('body');
  doc.documentElement.appendChild(bodyElement);

  // Append the feeds to the document as outline elements
  for (const feed of feeds) {
    const outlineElement = doc.createElement('outline');
    if (feed.type) {
      outlineElement.setAttribute('type', feed.type);
    }
    outlineElement.setAttribute('xmlUrl', feed_peek_url(feed));
    if (feed.title) {
      outlineElement.setAttribute('title', feed.title);
    }
    if (feed.description) {
      outlineElement.setAttribute('description', feed.description);
    }
    if (feed.link) {
      outlineElement.setAttribute('htmlUrl', feed.link);
    }

    bodyElement.appendChild(outlineElement);
  }

  // Serialize the document as a string and create and return a blob
  const serializer = new XMLSerializer();
  const string = serializer.serializeToString(doc);
  return new Blob([string], {type: 'application/xml'});
}

// TODO: add optional console argument, default it to null NULL_CONSOLE

// Imports one or more opml files into the app
// @param feedConn {IDBDatabase} open conn to reader database
// @param iconConn {IDBDatabase} open conn to favicon database
// @param channel {BroadcastChannel} optional channel to notify of storage
// events
// @param fetchFeedTimeout {Number} parameter forwarded to subscribe
// @param files {FileList} a list of opml files to import
// @return {Promise} a promise that resolves to an array of numbers, or rejects
// with an error. Each number corresponds to a count of the number of feeds
// subscribed from the file. That some files fail to import does not mean
// other files were not imported
export function import_opml(
    feedConn, iconConn, channel, fetchFeedTimeout, files) {
  assert(files instanceof FileList);
  console.log('Importing %d opml file(s)', files.length);

  const context = {
    feedConn: feedConn,
    iconConn: iconConn,
    channel: channel,
    fetchFeedTimeout: fetchFeedTimeout,
    notify: false
  };

  const partial = importOPMLFileNoExcept.bind(null, context, console);
  const promises = Array.prototype.map.call(files, partial);
  return Promise.all(promises);
}

async function importOPMLFileNoExcept(context, console, file) {
  try {
    return await importOPMLFile(context, console, file);
  } catch (error) {
    console.warn(error);
    return 0;
  }
}

// Reads the file, parses the opml, and then subscribes to each of the feeds
// Returns the count of feeds subscribed.
// @param context {Object} parameters for subscribing to a feed
// @param file {File} the file to import
// @param console {Object} a console-like object for logging
async function importOPMLFile(context, console, file) {
  assert(context);
  assert(console);
  assert(file instanceof File);
  assert(file.size);
  assert(fileHasFeedType(file));

  console.debug(file);
  const fileText = await readFileAsText(file);
  const document = parseOPML(fileText);
  const urls = dedupURLs(findFeedURLs(document));
  if (!urls.length) {
    return 0;
  }

  const partial = subscribeNoExcept.bind(null, context);
  const promises = urls.map(partial);
  const subscribeReturnValues = await Promise.all(promises);
  const count = subscribeReturnValues.filter(identity).length;
  console.debug(file.name, count);
  return count;
}

function fileHasFeedType(file) {
  const types = [
    'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
    'application/xml', 'application/xhtml+xml', 'text/xml'
  ];
  return types.includes(file.type);
}

function identity(value) {
  return value;
}

// Call subscribe while suppressing any exceptions. Exceptions are simply logged
async function subscribeNoExcept(subscribeContext, url) {
  try {
    return await subscribe(subscribeContext, url);
  } catch (error) {
    console.debug(error);
  }
}

// Searches an OPML document for urls of feeds. Returns an array of 0 or more
// urls found. Each element is a URL object. Only outlines that are correctly
// typed as a representing a feed are included in the result. Only valid urls
// are included in the result. By using URL objects, the urls are also
// normalized. The resulting urls are not guaranteed to be distinct.
function findFeedURLs(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const typePattern = /^\s*(rss|rdf|feed)\s*$/i;
  const urls = [];
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (typePattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if (value) {
        try {
          urls.push(new URL(value));
        } catch (error) {
        }
      }
    }
  }

  return urls;
}

// Given an array of URL objects, returns a new array where duplicate urls
// have been removed.
function dedupURLs(urls) {
  const uniqueURLs = [], seenURLStrings = [];
  for (const url of urls) {
    if (!seenURLStrings.includes(url.href)) {
      uniqueURLs.push(url);
      seenURLStrings.push(url.href);
    }
  }
  return uniqueURLs;
}

// TODO: the error thrown should indicate file name
function readFileAsText(file) {
  return new Promise(function executor(resolve, reject) {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

function parseXML(xmlString) {
  assert(typeof xmlString === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(xmlString, 'application/xml');
  const error = document.querySelector('parsererror');
  if (error) {
    const prettyMessage = error.textContent.replace(/\s{2,}/g, ' ');
    throw new Error(prettyMessage);
  }
  return document;
}

function parseOPML(xmlString) {
  // Rethrow parseXML errors
  const document = parseXML(xmlString);
  const name = document.documentElement.localName.toLowerCase();
  if (name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
