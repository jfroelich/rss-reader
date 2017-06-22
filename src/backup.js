// See license.md

'use strict';

// TODO: logging broken
// TODO: interaction with SubscriptionService broken
// TODO: client calling code broken probably
// TODO: reduce use of map/filter

backup.exportFile = function(feedArray = [], titleString = 'Subscriptions',
  fileNameString = 'subscriptions.xml', logObject) {

  if(logObject) {
    logObject.log('Exporting %d feeds to file', feedArray.length,
      fileNameString);
  }

  const documentObject = opml.createDocument(titleString);
  opml.appendFeeds(documentObject, feedArray);
  const blobObject = opml.toBlob(documentObject);
  utils.download(documentObject, fileNameString);
};

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

    dbConn = await dbConnect();
    iconConn = await jrFaviconConnect();

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
    logObject.log('Importing OPML file "%s", byte size %d, mime type "%s"',
      fileObject.name, fileObject.size, fileObject.type);
  }

  if(fileObject.size < 1) {
    throw new TypeError(`"${fileObject.name}" is empty`);
  }

  if(!backup.isSupportedFileType(fileObject.type)) {
    throw new TypeError(
      `"${fileObject.name}" has unsupported type "${fileObject.type}"`);
  }

  const text = await backup.readFileAsText(fileObject);
  const doc = opml.parseFromString(text);

  const outlineElementArray = opml.selectOutlineElements(doc);

  const outlineArray = new Array(outlineElementArray.length);
  for(let outlineElement of outlineElementArray) {
    const outlineObject = opml.createOutlineObject(outlineElement);
    outlineArray.push(outlineObject);
  }

  const validOutlineArray = new Array(outlineArray.length);
  for(let outlineObject of outlineArray) {
    if(!/rss|rdf|feed/i.test(outlineObject.type)) {
      continue;
    }

    if(!outlineObject.url) {
      continue;
    }

    let urlObject;
    try {
      urlObject = new URL(outlineObject.url);
    } catch(error) {
    }

    if(urlObject) {
      outlineObject.url = urlObject.href;
    } else {
      continue;
    }

    validOutlineArray.push(outlineObject);
  }

  if(!validOutlineArray.length) {
    return 0;
  }

  // Filter duplicates, favoring earlier in document order
  const uniqueURLsArray = new Array(validOutlineArray.length);
  const uniqueOutlineArray = new Array(validOutlineArray.length);
  for(let outlineObject of validOutlineArray) {
    if(!uniqueURLsArray.includes(outlineObject.url)) {
      uniqueOutlineArray.push(outlineObject);
      uniqueURLsArray.push(outlineObject.url);
    }
  }

  // Normalize each outline's link property
  for(let outlineObject of uniqueOutlineArray) {
    if(outlineObject.link) {
      try {
        const url = new URL(outlineObject.link);
        outlineObject.link = url.href;
      } catch(error) {
        outlineObject.link = undefined;
      }
    }
  }

  // Convert the outlines into feeds
  const feedArray = new Array(uniqueOutlineArray.length);
  for(let outlineObject of uniqueOutlineArray) {
    const feedObject = opml.createFeed(outlineObject);
    feedArray.push(feedObject);
  }

  // Attempt to subscribe to each of the feeds
  const subscribePromiseArray = new Array(feedArray.length);
  for(let feedObject of feedArray) {
    const promise = backup.subscribe(dbConn, iconDbConn, feedObject, logObject);
    subscribePromiseArray.push(promise);
  }

  const subscribeResolutionArray = await Promise.all(subscribePromiseArray);

  // Count the number of successful subscriptions
  let numSubscribed = 0;
  for(let resolution of subscribeResolutionArray) {
    if(resolution) {
      numSubscribed++;
    }
  }

  return numSubscribed;
};

// Returns the result of subscribe, which is the added feed object, or null
// if an error occurs. This wraps so that it can be used with Promise.all
backup.subscribe = async function(dbConn, iconDbConn, feedObject, logObject) {

  const subscribeOptionsObjects = {
    'suppressNotifications': true
  };

  try {
    const subscribedFeedObject = await subscribe(dbConn, iconDbConn,
      subscribeOptionsObjects, feedObject);

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
