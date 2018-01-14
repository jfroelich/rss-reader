import parseXML from "/src/common/parse-xml.js";
import * as Status from "/src/common/status.js";
import {FaviconCache} from "/src/favicon-service/favicon-service.js";
import subscribe from "/src/feed-ops/subscribe.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";

export default async function importOPMLFiles(files, timeout) {
  if(!(files instanceof FileList)) {
    return Status.EINVAL;
  }

  console.log('Importing %d opml file(s)', files.length);

  if(!files.length) {
    return Status.OK;
  }

  const context = {
    feedStore: new FeedStore(),
    iconCache: new FaviconCache(),
    fetchFeedTimeoutMs: timeout,
    notify: false,
    concurrent: true
  };

  let status = await openDatabases(context);
  if(status !== Status.OK) {
    console.error('Error opening databases:', Status.toString(status));
    return status;
  }

  // Concurrently import files
  const promises = [];
  for(const file of files) {
    promises.push(importOPMLFile(context, file));
  }
  const results = await Promise.all(promises);

  // Check individual results. Just log failures
  for(const result of results) {
    if(result !== Status.OK) {
      console.error('Failed to import file', Status.toString(status));
    }
  }

  context.feedStore.close();
  context.iconCache.close();

  return Status.OK;
}

async function openDatabases(context) {
  const promise1 = context.feedStore.open();
  const promise2 = context.iconCache.open();
  const statuses = await Promise.all([promise1, promise2]);
  let status = statuses[0];
  if(status !== Status.OK) {
    context.iconCache.close();
    return status;
  }
  status = statuses[1];
  if(status !== Status.OK) {
    context.feedStore.close();
    return status;
  }
  return Status.OK;
}

async function importOPMLFile(context, file) {
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

  // Avoid subscribe overhead if possible
  if(!feedURLs.length) {
    console.debug('No valid feed urls found in file', file.name);
    return Status.OK;
  }

  const promises = [];
  for(const url of feedURLs) {
    promises.push(subscribe(context, url));
  }

  const subscribeResults = await Promise.all(promises);

  // Just log individual sub failures and do not consider the import a failure
  let subCount = 0;
  for(const [subStatus, subFeed] of subscribeResults) {
    if(subStatus === Status.OK) {
      subCount++;
    } else {
      console.debug('Subscription failed:', Status.toString(subStatus));
    }
  }

  console.log('Subscribed to %d new feeds in file', subCount, file.name);
  return Status.OK;
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

function parseOPML(xmlString) {
  if(typeof xmlString !== 'string') {
    console.error('Invalid xmlString argument:', xmlString);
    return [Status.EINVAL];
  }

  let [status, document, message] = parseXML(xmlString);
  if(status !== Status.OK) {
    console.error('XML parsing error:', message);
    return [status];
  }

  const name = document.documentElement.localName.toLowerCase();
  if(name !== 'opml') {
    console.error('Document element is not opml:', name);
    return [Status.EPARSEOPML];
  }

  return [Status.OK, document];
}
