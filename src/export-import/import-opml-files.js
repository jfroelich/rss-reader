import * as Status from "/src/common/status.js";
import {open as openIconDb} from "/src/favicon-service.js";
import subscribe from "/src/feed-ops/subscribe.js";
import {open as openReaderDb} from "/src/rdb.js";

// TODO: revert to no status

// TODO: conns should be optional params instead of always created locally so that this can
// run on test databases. In other words, conns should be dependency injected.


// TODO: now that channel is injected, caller is responsible for lifetime management


export default async function importOPMLFiles(importContext, files) {
  if(!(files instanceof FileList)) {
    return Status.EINVAL;
  }

  console.log('Importing %d opml file(s)', files.length);

  if(!files.length) {
    return Status.OK;
  }

  // Open databases
  let feedConn, iconConn;
  try {
    [feedConn, iconConn] = await Promise.all([openReaderDb(), openIconDb()]);
  } catch(error) {
    return Status.EDB;
  }

  const subscribeContext = {
    feedConn: feedConn,
    iconConn: iconConn,
    channel: importContext.channel,
    fetchFeedTimeout: importContext.fetchFeedTimeout,
    notify: false
  };

  // Concurrently import files
  const promises = [];
  for(const file of files) {
    promises.push(importOPMLFile(subscribeContext, file));
  }
  const results = await Promise.all(promises);

  // Check individual results. Just log failures
  for(const result of results) {
    if(result !== Status.OK) {
      console.error('Failed to import file', Status.toString(status));
    }
  }

  feedConn.close();
  iconConn.close();

  return Status.OK;
}


async function importOPMLFile(subscribeContext, file) {
  if(!(file instanceof File)) {
    console.error('Invalid file argument', file);
    return Status.EINVAL;
  }

  console.log('Importing file', file.name, file.type, file.size);

  if(file.size < 1) {
    console.error('File %s is empty', file.name);
    return Status.EINVAL;
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
    console.error('File %s is not xml, it is', file.name, file.type);
    return Status.EINVAL;
  }

  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch(error) {
    console.error(file.name, error);
    return Status.EINVAL;
  }

  let [status, document] = parseOPML(fileText);
  if(status !== Status.OK) {
    console.error('OPML parsing error:', Status.toString(status));
    return status;
  }

  const feedURLs = getFeedURLs(document);

  let subCount = 0;
  if(feedURLs.length) {
    const promises = [];
    for(const url of feedURLs) {
      promises.push(subscribeNoExcept(subscribeContext, url));
    }

    const subscribeResults = await Promise.all(promises);
    for(const subscribedFeed of subscribeResults) {
      if(subscribedFeed) {
        subCount++;
      }
    }
  }

  console.log('Subscribed to %d feeds in file %s', subCount, file.name);
  return Status.OK;
}

// Call subscribe while suppressing any exceptions. Exceptions are simply logged to debug.
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
  if(typeof xmlString !== 'string') {
    throw new TypeError('Expected string, got ' + typeof xmlString);
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(xmlString, 'application/xml');
  const error = document.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent.replace(/\s{2,}/g, ' '));
  }

  return document;
}

function parseOPML(xmlString) {
  if(typeof xmlString !== 'string') {
    console.error('Invalid xmlString argument:', xmlString);
    return [Status.EINVAL];
  }

  let document;
  try {
    document = parseXML(xmlString);
  } catch(error) {
    console.error(error);
    return [Status.EPARSEOPML];
  }

  const name = document.documentElement.localName.toLowerCase();
  if(name !== 'opml') {
    console.error('Document element is not opml:', name);
    return [Status.EPARSEOPML];
  }

  return [Status.OK, document];
}
