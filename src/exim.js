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
  return new Blob([ string ], {type : 'application/xml'});
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
// with an error. Each number corresponds to one of the files. -1 means weak
// error (e.g. empty file), otherwise a count of number of feeds subscribed
// from the file. Rejections can leave the db in an inconsistent state.
export function importOPML(feedConn, iconConn, channel, fetchFeedTimeout,
                           files) {
  assert(files instanceof FileList);
  console.log('Importing %d opml file(s)', files.length);

  const context = {
    feedConn : feedConn,
    iconConn : iconConn,
    channel : channel,
    fetchFeedTimeout : fetchFeedTimeout,
    notify : false
  };

  const partial = importOPMLFile.bind(null, context, console);
  return Promise.all(files.map(partial));
}

// TODO: why distinguish weak errors like empty files or incorrect file types?
// Maybe just consider it part of the processing logic and just exit early. I
// don't think any caller currently cares about it, or will any time soon, so
// why did I distinguish it so exactly and carefully? At least explicitly
// state why.

// Reads the file, parses the opml, and then subscribes to each of the feeds
// Returns -1 in case of weak error. Returns 0 if no feeds subscribed. Otherwise
// returns the count of feeds subscribed.
// @param subscribeContext {Object} parameters for subscribing to a feed
// @param file {File} the file to import
// @param console {Object} a console-like object for logging
async function importOPMLFile(subscribeContext, console, file) {
  assert(file instanceof File);
  console.log('Importing file', file.name, file.type, file.size);

  if (file.size < 1) {
    console.warn('Skipping empty file', file.name);
    return -1;
  }

  // Only process xml files
  const xmlMimeTypes = [
    'application/atom+xml', 'application/rdf+xml', 'application/rss+xml',
    'application/xml', 'application/xhtml+xml', 'text/xml'
  ];
  if (!xmlMimeTypes.includes(file.type)) {
    console.warn('Skipping non-xml file', file.name, file.type);
    return -1;
  }

  // I/O errors are not fatal to the batch import
  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch (error) {
    console.warn(file.name, error);
    return -1;
  }

  console.debug('Loaded %d characters in file', fileText.length, file.name);

  // Parse errors are not fatal to batch import
  let document;
  try {
    document = parseOPML(fileText);
  } catch (error) {
    console.warn(file.name, error);
    return -1;
  }

  const urls = dedupURLs(findFeedURLs(document));
  if (!urls.length) {
    console.debug('No feeds found in file', file.name);
    return 0;
  }

  const thisArg = null;
  const partialFunc = subscribeNoExcept.bind(thisArg, subscribeContext);
  const promises = urls.map(partialFunc);
  // Any subscribe rejections are thrown
  const subscribeReturnValues = await Promise.all(promises);
  const count = subscribeReturnValues.filter(identity).length;
  console.log('Subscribed to %d feeds in file', count, file.name);
  return count;
}

function identity(value) { return value; }

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
  if (!value)
    throw new Error(message || 'Assertion error');
}
