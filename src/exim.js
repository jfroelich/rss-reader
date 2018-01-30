import {open as openIconDb} from '/src/favicon-service.js';
import subscribe from '/src/feed-ops/subscribe.js';
import {feedPeekURL, getFeeds, open as openReaderDb} from '/src/rdb.js';

// Returns an opml document as a blob that contains outlines representing the
// feeds in the app's db
// @param conn {IDBDatabase} optional, an open connection to the reader database
// @param title {String} optional, the value to use for the title element in the
// document
export async function exportOPML(conn, title) {
  const feeds = await getFeeds(conn);

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
    outlineElement.setAttribute('xmlUrl', feedPeekURL(feed));
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

// Imports one or more opml files into the app
// @param feedConn {IDBDatabase} open conn to reader database
// @param iconConn {IDBDatabase} open conn to favicon database
// @param channel {BroadcastChannel} optional channel to notify of storage
// events
// @param fetchFeedTimeout {Number} parameter fowarded to subscribe
// @param files {FileList} a list of opml files to import
// @return {Promise} a promise that resolves when finished to an array of
// numbers, or rejects with an error. Each number corresponds to one of the
// files. -1 means weak error, otherwise a count of number of feeds subscribed
// from the file. Rejections can leave the db in an inconsistent state.
export function importOPML(
    feedConn, iconConn, channel, fetchFeedTimeout, files) {
  assert(files instanceof FileList);

  console.log('Importing %d opml file(s)', files.length);
  if (!files.length) {
    console.debug('Canceling import, no files found');
    return;
  }

  const subscribeContext = {
    feedConn: feedConn,
    iconConn: iconConn,
    channel: channel,
    fetchFeedTimeout: fetchFeedTimeout,
    notify: false
  };

  // Concurrently import files.
  const promises = [];
  for (const file of files) {
    promises.push(importOPMLFile(subscribeContext, file));
  }

  return Promise.all(promises);
}

// Reads the file, parses the opml, and then subscribes to each of the feeds
// Returns -1 in case of weak error. Returns 0 if no feeds subscribed. Otherwise
// returns the count of feeds subscribed.
async function importOPMLFile(subscribeContext, file) {
  // Calling this with something other than a file is a persistent critical
  // programming error
  assert(file instanceof File);

  console.log('Importing file', file.name, file.type, file.size);

  if (file.size < 1) {
    console.debug('Skipping empty file', file.name);
    return -1;
  }

  // Only process xml files
  const xmlMimeTypes = [
    'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
    'application/xml', 'application/xhtml+xml', 'text/xml'
  ];
  if (!xmlMimeTypes.includes(file.type)) {
    console.debug('Skipping non-xml file', file.name, file.type);
    return -1;
  }

  // The failure to read the file is not a critical error, just log and return
  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch (error) {
    console.error(file.name, error);
    return -1;
  }

  console.debug('Loaded %d characters in file', fileText.length, file.name);

  // The failure to parse a file is not a critical error, just log and return
  let document;
  try {
    document = parseOPML(fileText);
  } catch (error) {
    console.debug('Failed to parse opml', error);
    return -1;
  }

  const urls = getFeedURLs(document);
  if (!urls.length) {
    console.debug('No feeds found in file', file.name);
    return 0;
  }

  const thisArg = null;
  const partialFunc = subscribeNoExcept.bind(thisArg, subscribeContext);
  const promises = urls.map(partialFunc);
  const subscribeReturnValues = await Promise.all(promises);
  const count = subscribeReturnValues.filter(identity).length;
  console.log('Subscribed to %d feeds in file', count, file.name);
  return count;
}

function identity(value) {
  return value;
}

// Call subscribe while suppressing any exceptions. Exceptions are simply logged
// Returns the result of subscribe
async function subscribeNoExcept(subscribeContext, url) {
  try {
    return await subscribe(subscribeContext, url);
  } catch (error) {
    console.debug(error);
  }
}


// TODO: this is mixing together dedup with select. It should be two functions

function getFeedURLs(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const typePattern = /^\s*(rss|rdf|feed)\s*$/i;
  const seen = [];  // distinct normalized url strings
  const urls = [];  // output URL objects
  for (const element of elements) {
    const type = element.getAttribute('type');
    if (typePattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if (value) {
        try {
          const url = new URL(value);
          if (!seen.includes(url.href)) {
            seen.push(url.href);
            urls.push(url);
          }
        } catch (error) {
        }
      }
    }
  }

  return urls;
}

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
  assert(typeof xmlString === 'string');
  // Rethrow parseXML errors as parseOPML errors
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
