import {open as openIconDb} from "/src/favicon-service.js";
import subscribe from "/src/feed-ops/subscribe.js";
import {open as openReaderDb} from "/src/rdb.js";

// TODO: review whether importContext is even helpful here. I'm not sure there are all that
// many parameters.

// TODO: conns should be optional params instead of always created locally so that this can
// run on test databases. In other words, conns should be dependency injected.
// TODO: now that channel is injected, caller is responsible for lifetime management. review
// if that is happening

export default async function importOPMLFiles(importContext, files) {
  // TODO: consider relaxing this to array-like or is-iterable style test
  assert(files instanceof FileList);

  console.log('Importing %d opml file(s)', files.length);
  if(!files.length) {
    return;
  }

  // Allow errors to bubble as fatal
  // TODO: connections should be defined externally so that databases can be mocked. I moved
  // them here so that caller has less burden, but it turns out that this removes dependency
  // injection pattern
  const [feedConn, iconConn] = await Promise.all([openReaderDb(), openIconDb()]);

  const subscribeContext = {
    feedConn: feedConn,
    iconConn: iconConn,
    channel: importContext.channel,
    fetchFeedTimeout: importContext.fetchFeedTimeout,
    notify: false
  };

  // Concurrently import files.
  const promises = [];
  for(const file of files) {
    promises.push(importOPMLFile(subscribeContext, file));
  }

  // Any individual promise rejection shortcircuits Promise.all and is fatal to import
  const results = await Promise.all(promises);

  // Check individual results. Just log failures
  for(const perFileResult of results) {
    if(!perFileResult) {
      console.error('Failed to import file');
    }
  }

  // Release resources
  // TODO: lifetime management should probably be moved to caller
  feedConn.close();
  iconConn.close();
}

// Returns -1 in case of weak error. Returns 0 if no feeds subscribed. Otherwise returns the
// count of feeds subscribed.
async function importOPMLFile(subscribeContext, file) {
  // Calling this with something other than a file is a persistent critical programming error
  assert(file instanceof File);

  console.log('Importing file', file.name, file.type, file.size);

  if(file.size < 1) {
    console.debug('Skipping empty file', file.name);
    return -1;
  }

  // Only process xml files
  const xmlMimeTypes = [
    'application/atom+xml',
    'application/rdf+xml',
    'application/rss+xml',
    'application/xml',
    'application/xhtml+xml',
    'text/xml'
  ];
  if(!xmlMimeTypes.includes(file.type)) {
    console.debug('Skipping non-xml file', file.name, file.type);
    return -1;
  }

  // The failure to read the file is not a critical error, just log and return
  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch(error) {
    console.error(file.name, error);
    return -1;
  }

  // The failure to parse a file is not a critical error, just log and return
  let document;
  try {
    document = parseOPML(fileText);
  } catch(error) {
    console.debug(error);
    return -1;
  }

  const urls = getFeedURLs(document);
  if(!urls.length) {
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
  } catch(error) {
    console.debug(error);
  }
}


function getFeedURLs(document) {
  const elements = document.querySelectorAll('opml > body > outline');
  const typePattern = /^\s*(rss|rdf|feed)\s*$/i;
  const seen = [];// distinct normalized url strings
  const urls = [];// output URL objects
  for(const element of elements) {
    const type = element.getAttribute('type');
    if(typePattern.test(type)) {
      const value = element.getAttribute('xmlUrl');
      if(value) {
        try {
          const url = new URL(value);
          if(!seen.includes(url.href)) {
            seen.push(url.href);
            urls.push(url);
          }
        } catch(error) {}
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
  if(error) {
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
  if(name !== 'opml') {
    throw new Error('Document element is not opml: ' + name);
  }
  return document;
}
