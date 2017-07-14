// See license.md

'use strict';

// TODO: update callsites
// TODO: this is no longer general backup, this is now just importFiles.
// Reorient by removing the backup namespace object, just export a single
// public function named importOPMLFiles, rename file to import-opml-files.js

const backup = {};

// Import one or more files into the app
// @param files {Iterable<File>} - e.g. FileList
backup.importFiles = async function(fileList, logObject) {

  if(logObject) {
    logObject.log('Importing %d OPML XML files', fileList.length);
  }

  const importPromises = new Array(fileList.length);

  let dbConn;
  let iconConn;
  let importResolutions;

  try {

    dbConn = await db.connect();
    iconConn = await favicon.connect();

    for(let fileObject of fileList) {
      const promise = backup.importFileSilently(dbConn, iconConn, fileObject,
        logObject);
      importPromises.push(promise);
    }

    importResolutions = await Promise.all(importPromises);
  } catch(error) {
    // ?
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

  if(logObject) {
    logObject.log('Imported %d feeds from %d files', numFeedsImported,
    fileList.length);
  }

  return numFeedsImported;
};

// Decorates backup.importFile to avoid Promise.all failfast behavior
backup.importFileSilently = async function(dbConn, iconConn, fileObject,
  logObject) {

  let subscriptionCount = 0;
  try {
    subscriptionCount = await backup.importFile(dbConn, iconConn, fileObject,
      logObject);
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
  return subscriptionCount;
};

// Returns number of feeds added
backup.importFile = async function(dbConn, iconConn, fileObject, logObject) {

  if(logObject) {
    logObject.log('Importing file:', fileObject.name);
  }

  if(fileObject.size < 1) {
    throw new TypeError(`The file "${fileObject.name}" is empty`);
  }

  if(!backup.isSupportedFileType(fileObject.type)) {
    throw new TypeError(
      `"${fileObject.name}" has unsupported type "${fileObject.type}"`);
  }

  const text = await backup.readFileAsText(fileObject);
  const document = OPMLDocument.parse(text);
  document.removeInvalidOutlineTypes();
  document.normalizeOutlineXMLURLs();
  document.removeOutlinesMissingXMLURLs();

  const outlineArray = document.getOutlineObjects();
  let numSubscribed = 0;
  if(outlineArray.length) {
    const uniqueOutlineArray = backup.aggregateOutlinesByXMLURL(outlineArray);

    const duplicateCount = outlineArray.length - uniqueOutlineArray.length;
    if(duplicateCount && logObject) {
      logObject.log('Ignored %d duplicate feed(s) in file', duplicateCount,
        fileObject.name);
    }

    backup.normalizeOutlineLinks(uniqueOutlineArray);
    const feedArray = backup.convertOutlines(uniqueOutlineArray);
    numSubscribed = backup.batchSubscribe(feedArray, iconDbConn, feedObject,
      logObject);
  }

  if(logObject) {
    logObject.log('Subscribed to %d feeds in file', numSubscribed,
      fileObject.name);
  }

  return numSubscribed;
};

// Filter duplicates, favoring earlier in document order
backup.aggregateOutlinesByXMLURL = function(outlineArray) {
  const uniqueURLsArray = new Array(outlineArray.length);
  const uniqueOutlineArray = new Array(outlineArray.length);
  for(let outlineObject of outlineArray) {
    if(!uniqueURLsArray.includes(outlineObject.xmlUrl)) {
      uniqueOutlineArray.push(outlineObject);
      uniqueURLsArray.push(outlineObject.xmlUrl);
    }
  }
};

// Normalize and validate each outline's link property
backup.normalizeOutlineLinks = function(outlineArray) {

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
};

// Convert the outlines into feeds
backup.convertOutlines = function(outlineArray) {
  const feedArray = new Array(outlineArray.length);
  for(let outlineObject of outlineArray) {
    const feedObject = backup.convertOutlineToFeed(outlineObject);
    feedArray.push(feedObject);
  }
  return feedArray;
};

// Attempt to subscribe to each of the feeds concurrently
backup.batchSubscribe = async function(feedArray, dbConn, iconDbConn,
  logObject) {

  // Map
  const promiseArray = new Array(feedArray.length);
  for(let feedObject of feedArray) {
    const promise = backup.subscribe(dbConn, iconDbConn, feedObject, logObject);
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
};


backup.convertOutlineToFeed = function(outlineObject) {
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
};

// Returns the result of subscribe, which is the added feed object, or null
// if an error occurs. This wraps so that it can be used with Promise.all
backup.subscribe = async function(dbConn, iconDbConn, feedObject, logObject) {

  const options = {
    'suppressNotifications': true
  };

  try {
    const subscribedFeedObject = await operations.subscribe(dbConn, iconDbConn,
      feedObject, options, logObject);

    return subscribedFeedObject;
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
};

backup.isSupportedFileType = function(fileTypeString) {

  // Noramlize the type
  let normTypeString = fileTypeString || '';
  normTypeString = normTypeString.trim().toLowerCase();

  // Check if the normalized type is supported
  const supportedTypes = ['application/xml', 'text/xml'];
  return supportedTypes.includes(normTypeString);
};

backup.readFileAsText = function(fileObject) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(fileObject);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
};
