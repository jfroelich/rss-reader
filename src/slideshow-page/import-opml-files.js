import assert from "/src/common/assert.js";
import * as MimeUtils from "/src/common/mime-utils.js";
import * as Status from "/src/common/status.js";
import {FaviconCache} from "/src/favicon-service/favicon-service.js";
import Subscribe from "/src/feed-ops/subscribe.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as OPMLUtils from "/src/slideshow-page/opml-utils.js";

export default function importOPMLFiles(files, fetchFeedTimeoutMs) {
  if(!(files instanceof FileList)) {
    console.error('Invalid files argument', files);
    return Status.EINVAL;
  }

  console.log('Importing %d opml files', files.length);

  const feedStore = new FeedStore();
  const iconCache = new FaviconCache();

  let status = await openDatabases(feedStore, iconCache);
  if(status !== Status.OK) {
    console.error('Error opening databases:', Status.toString(status));
    return status;
  }

  // Concurrently import files
  const promises = [];
  for(const file of files) {
    const promise = importOPMLFile(feedStore, iconCache, file, fetchFeedTimeoutMs);
    promises.push(promise);
  }
  const results = await Promise.all(promises);

  // Check individual results. Just log failures
  for(const result of results) {
    if(result !== Status.OK) {
      console.error('Failed to import file', Status.toString(status));
    }
  }

  feedStore.close();
  iconCache.close();

  return Status.OK;
}

async function openDatabases(feedStore, iconCache) {
  const promises = [feedStore.open(), iconCache.open()];
  const statuses = await Promise.all(promises);
  let status = statuses[0];
  if(status !== Status.OK) {
    iconCache.close();
    return status;
  }
  status = statuses[1];
  if(status !== Status.OK) {
    feedStore.close();
    return status;
  }
  return Status.OK;
}

async function importOPMLFile(feedStore, iconCache, file, fetchFeedTimeoutMs) {
  if(!(file instanceof File)) {
    console.error('Invalid file argument', file);
    return Status.EINVAL;
  }

  console.log('Importing file', file.name);

  if(file.size < 1) {
    console.error('Empty file', file.name);
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
  const mimeType = MimeUtils.fromContentType(file.type);
  if(!xmlMimeTypes.includes(mimeType)) {
    console.error('File mime type is not xml', file.name, mimeType);
    return Status.EINVAL;
  }

  let fileText;
  try {
    fileText = await readFileAsText(file);
  } catch(error) {
    console.error(error);
    return Status.EINVAL;
  }

  // TODO: if this is the only module that parses opml, parseOPML should be a local helper
  let status, document, message;
  [status, document, message] = OPMLUtils.parseOPML(fileText);
  if(status !== Status.OK) {
    console.debug(message);
    return status;
  }

  const feedURLs = getFeedURLs(document);
  if(!feedURLs.length) {
    console.debug('No valid feed urls found in file', file.name);
    return Status.OK;
  }

  const subscribe = new Subscribe();
  subscribe.fetchFeedTimeoutMs = fetchFeedTimeoutMs;
  subscribe.notify = false;
  // Signal to subscribe that it should not poll
  subscribe.concurrent = true;

  // Bypass init
  subscribe.feedStore = feedStore;
  subscribe.iconCache = iconCache;

  const subscribePromises = feedURLs.map(subscribe.subscribe, subscribe);
  const subscribeResults = await Promise.all(subscribePromises);

  let subCount = 0;
  for(const result of subscribeResults) {
    // TODO: isn't result always defined?
    if(result && result.status === Status.OK) {
      subCount++;
    } else {
      // Just log individual sub failures
      console.debug('Subscription error');
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
