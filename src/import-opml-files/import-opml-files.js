// See license.md

'use strict';

// Dependencies
// /lib/opml-document/opml-document.js
// /lib/favicon/favicon.js
// /src/db/db.js
// /src/operations.js

{ // Begin file block scope

// Import one or more files into the app
// @param files {Iterable<File>} - e.g. FileList
async function importOPMLFiles(files, verbose) {

  if(verbose) {
    console.log('Importing %d OPML XML files', files.length);
  }

  let dbConn;
  let iconConn;
  let importResolutions;

  // No catch - allow exceptions to bubbles

  try {
    dbConn = await db.connect();
    iconConn = await favicon.connect();
    importResolutions = await importFilesInternal(dbConn, iconConn, files,
      verbose);
  } finally {
    if(dbConn) {
      dbConn.close();
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


async function importFilesInternal(dbConn, iconConn, files, verbose) {
  const promises = new Array(files.length);
  for(let file of files) {
    const promise = importFileSilently(dbConn, iconConn, file, verbose);
    promises.push(promise);
  }

  return await Promise.all(promises);
};

// Decorates importFile to avoid Promise.all failfast behavior
async function importFileSilently(dbConn, iconConn, fileObject, verbose) {

  let subscriptionCount = 0;
  try {
    subscriptionCount = await importFile(dbConn, iconConn, fileObject,
      verbose);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }
  return subscriptionCount;
}

// Returns number of feeds added
async function importFile(dbConn, iconConn, fileObject, verbose) {

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

  const outlineArray = document.getOutlineObjects();
  let numSubscribed = 0;
  if(outlineArray.length) {
    const uniqueOutlineArray = aggregateOutlinesByXMLURL(outlineArray);

    const duplicateCount = outlineArray.length - uniqueOutlineArray.length;
    if(duplicateCount && verbose) {
      console.log('Ignored %d duplicate feed(s) in file', duplicateCount,
        fileObject.name);
    }

    normalizeOutlineLinks(uniqueOutlineArray);
    const feedArray = convertOutlines(uniqueOutlineArray);
    numSubscribed = batchSubscribe(feedArray, iconDbConn, feedObject, verbose);
  }

  if(verbose) {
    console.log('Subscribed to %d feeds in file', numSubscribed,
      fileObject.name);
  }

  return numSubscribed;
}

// Filter duplicates, favoring earlier in document order
function aggregateOutlinesByXMLURL(outlineArray) {
  const uniqueURLsArray = new Array(outlineArray.length);
  const uniqueOutlineArray = new Array(outlineArray.length);
  for(let outlineObject of outlineArray) {
    if(!uniqueURLsArray.includes(outlineObject.xmlUrl)) {
      uniqueOutlineArray.push(outlineObject);
      uniqueURLsArray.push(outlineObject.xmlUrl);
    }
  }
}

// Normalize and validate each outline's link property
function normalizeOutlineLinks(outlineArray) {

  // Setting to undefined is preferred over deleting in order to maintain v8
  // object shape

  for(let outlineObject of outlineArray) {

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

// Convert the outlines into feeds
function convertOutlines(outlineArray) {
  const feedArray = new Array(outlineArray.length);
  for(let outlineObject of outlineArray) {
    const feedObject = convertOutlineToFeed(outlineObject);
    feedArray.push(feedObject);
  }
  return feedArray;
}

// Attempt to subscribe to each of the feeds concurrently
async function batchSubscribe(feedArray, dbConn, iconDbConn, verbose) {

  // Map
  const promiseArray = new Array(feedArray.length);
  for(let feedObject of feedArray) {
    const promise = importSubscribe(dbConn, iconDbConn, feedObject, verbose);
    promiseArray.push(promise);
  }

  const resolutionArray = await Promise.all(promiseArray);

  // Reduce
  // Count the number of successful subscriptions
  let numSubscribed = 0;
  for(let resolution of resolutionArray) {
    if(resolution) {
      numSubscribed++;
    }
  }

  return numSubscribed;
}

function convertOutlineToFeed(outlineObject) {
  const feedObject = {};

  if(outlineObject.type) {
    feedObject.type = outlineObject.type;
  }

  if(outlineObject.title) {
    feedObject.title = outlineObject.title;
  } else if(outlineObject.text) {
    feedObject.text = outlineObject.text;
  }

  if(outlineObject.description) {
    feedObject.description = outlineObject.description;
  }

  if(outlineObject.htmlUrl) {
    feedObject.link = outlineObject.htmlUrl;
  }

  addFeedURLString(feedObject, outlineObject.xmlUrl);

  return feedObject;
}

// Returns the result of subscribe, which is the added feed object, or null
// if an error occurs. This wraps so that it can be used with Promise.all
async function importSubscribe(dbConn, iconDbConn, feedObject, verbose) {

  const options = {
    'suppressNotifications': true
  };

  try {
    const subscribedFeedObject = await operations.subscribe(dbConn, iconDbConn,
      feedObject, options, verbose ? console: null);
    return subscribedFeedObject;
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
