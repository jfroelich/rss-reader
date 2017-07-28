// See license.md

'use strict';

// Dependencies
// opml-document.js
// favicon.js
// db.js
// subscribe.js

{ // Begin file block scope

// Import one or more files into the app
// @param files {Iterable<File>} - e.g. FileList
async function importOPMLFiles(files, verbose) {

  if(verbose) {
    console.log('Importing %d OPML XML files', files.length);
  }

  let readerConn;
  let iconConn;
  let importResolutions;
  let iconDbName, iconDbVersion;

  // No catch - allow exceptions to bubbles
  // TODO: open connections concurrently, use Promise.all

  try {
    readerConn = await dbConnect();
    iconConn = await openFaviconDb(iconDbName, iconDbVersion, verbose);
    importResolutions = await importFilesInternal(readerConn, iconConn, files,
      verbose);
  } finally {
    if(readerConn) {
      readerConn.close();
    }
    if(iconConn) {
      iconConn.close();
    }
  }

  let numFeedsImported = 0;
  for(let perFileFeedCount of importResolutions) {
    numFeedsImported += perFileFeedCount;
  }

  if(verbose) {
    console.log('Imported %d feeds from %d files', numFeedsImported,
      files.length);
  }

  return numFeedsImported;
}

this.importOPMLFiles = importOPMLFiles;

async function importFilesInternal(readerConn, iconConn, files, verbose) {
  const promises = new Array(files.length);
  for(let file of files) {
    const promise = importFileSilently(readerConn, iconConn, file, verbose);
    promises.push(promise);
  }

  return await Promise.all(promises);
};

// Decorates importFile to avoid Promise.all failfast behavior
async function importFileSilently(readerConn, iconConn, fileObject, verbose) {

  let subscriptionCount = 0;
  try {
    subscriptionCount = await importFile(readerConn, iconConn, fileObject,
      verbose);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }
  return subscriptionCount;
}

// Returns number of feeds added
async function importFile(readerConn, iconConn, fileObject, verbose) {

  if(verbose) {
    console.log('Importing file', fileObject.name);
  }

  if(fileObject.size < 1) {
    throw new TypeError(`The file "${fileObject.name}" is empty`);
  }

  if(!isSupportedFileType(fileObject.type)) {
    throw new TypeError(
      `"${fileObject.name}" has unsupported type "${fileObject.type}"`);
  }

  const text = await readFileAsText(fileObject);
  const document = OPMLDocument.parse(text);
  document.removeInvalidOutlineTypes();
  document.normalizeOutlineXMLURLs();
  document.removeOutlinesMissingXMLURLs();

  const outlines = document.getOutlineObjects();
  let numSubscribed = 0;
  if(outlines.length) {
    const uniqueOutlineArray = aggregateOutlinesByXMLURL(outlines);

    const duplicateCount = outlines.length - uniqueOutlineArray.length;
    if(duplicateCount && verbose) {
      console.log('Ignored %d duplicate feed(s) in file', duplicateCount,
        fileObject.name);
    }

    normalizeOutlineLinks(uniqueOutlineArray);
    const feeds = convertOutlines(uniqueOutlineArray);
    numSubscribed = batchSubscribe(feeds, iconConn, feed, verbose);
  }

  if(verbose) {
    console.log('Subscribed to %d feeds in file', numSubscribed,
      fileObject.name);
  }

  return numSubscribed;
}

// Filter duplicates, favoring earlier in document order
function aggregateOutlinesByXMLURL(outlines) {
  const uniqueURLsArray = new Array(outlines.length);
  const uniqueOutlineArray = new Array(outlines.length);
  for(let outlineObject of outlines) {
    if(!uniqueURLsArray.includes(outlineObject.xmlUrl)) {
      uniqueOutlineArray.push(outlineObject);
      uniqueURLsArray.push(outlineObject.xmlUrl);
    }
  }
}

// Normalize and validate each outline's link property
function normalizeOutlineLinks(outlines) {

  // Setting to undefined is preferred over deleting in order to maintain v8
  // object shape
  for(let outlineObject of outlines) {
    if(outlineObject.htmlUrl === '') {
      outlineObject.htmlUrl = undefined;
      continue;
    }

    if(outlineObject.htmlUrl === null) {
      outlineObject.htmlUrl = undefined;
      continue;
    }

    if(outlineObject.htmlUrl === undefined) {
      continue;
    }

    try {
      const urlObject = new URL(outlineObject.htmlUrl);
      outlineObject.htmlUrl = urlObject.href;
    } catch(error) {
      outlineObject.htmlUrl = undefined;
    }
  }
}

// Convert outlines into feeds
function convertOutlines(outlines) {
  const feeds = new Array(outlines.length);
  for(let outlineObject of outlines) {
    const feed = convertOutlineToFeed(outlineObject);
    feeds.push(feed);
  }
  return feeds;
}

// Attempt to subscribe to each of the feeds concurrently
async function batchSubscribe(feeds, readerConn, iconConn, verbose) {

  // Map feeds into subscribe promises
  const promises = new Array(feeds.length);
  for(let feed of feeds) {
    const promise = subscribeSilently(readerConn, iconConn, feed, verbose);
    promises.push(promise);
  }

  const resolutions = await Promise.all(promises);

  // Reduce
  // Count the number of successful subscriptions
  let numSubscribed = 0;
  for(let resolution of resolutions) {
    if(resolution) {
      numSubscribed++;
    }
  }

  return numSubscribed;
}

function convertOutlineToFeed(outlineObject) {
  const feed = {};

  if(outlineObject.type) {
    feed.type = outlineObject.type;
  }

  if(outlineObject.title) {
    feed.title = outlineObject.title;
  } else if(outlineObject.text) {
    feed.text = outlineObject.text;
  }

  if(outlineObject.description) {
    feed.description = outlineObject.description;
  }

  if(outlineObject.htmlUrl) {
    feed.link = outlineObject.htmlUrl;
  }

  addFeedURLString(feed, outlineObject.xmlUrl);

  return feed;
}

// Returns the result of subscribe, which is the added feed object, or null
// if an error occurs. This wraps so that it can be used with Promise.all
async function subscribeSilently(readerConn, iconConn, feed, verbose) {
  const options = {
    'suppressNotifications': true,
    'verbose': verbose
  };

  try {
    return await subscribe(readerConn, iconConn, feed, options);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }
};

function isSupportedFileType(fileTypeString) {

  // Noramlize the type
  let normTypeString = fileTypeString || '';
  normTypeString = normTypeString.trim().toLowerCase();

  // Check if the normalized type is supported
  const supportedTypes = ['application/xml', 'text/xml'];
  return supportedTypes.includes(normTypeString);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

} // End file block scope
