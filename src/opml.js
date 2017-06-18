// See license.md

'use strict';

// TODO: logging broken
// TODO: interaction with SubscriptionService broken
// TODO: client calling code broken probably
// TODO: reduce use of map/filter
// TODO: possible bug with createOutline because it was in both import/export
// before refactoring merge and I just did a fast find and replace

function jrOPMLExportFile(feedArray = [], titleString = 'Subscriptions',
  fileNameString = 'subscriptions.xml', logObject) {

  if(logObject) {
    logObject.log('Exporting %d feeds to file', feedArray.length,
      fileNameString);
  }

  const documentObject = jrOPMLCreateXMLDocument(titleString);
  const outlineElementArray = feedArray.map(
    jrOPMLCreateOutlineElementFromFeed.bind(null, documentObject));
  const bodyElement = documentObject.querySelector('body');
  for(let outline of outlineElementArray) {
    bodyElement.appendChild(outline);
  }

  const blobObject = jrOPMLCreateXMLBlob(documentObject);
  const objectURL = URL.createObjectURL(blobObject);

  // Setup the anchor element
  const anchorElement = jrOPMLCreateDownloadAnchor(documentObject,
    fileNameString);
  anchorElement.href = objectURL;

  // Trigger the download
  anchorElement.click();

  // Cleanup
  URL.revokeObjectURL(objectURL);
}

function jrOPMLCreateDownloadAnchor(documentObject, fileNameString) {
  const anchorElement = documentObject.createElement('a');
  anchorElement.setAttribute('download', fileNameString);
  return anchorElement;
}

function jrOPMLCreateXMLBlob(documentObject) {
  const writer = new XMLSerializer();
  const opmlString = writer.serializeToString(documentObject);
  return new Blob([opmlString], {'type': 'application/xml'});
}

// Creates a Document object of type xml that generally follows the OPML spec,
// without any outline elements in its body.
function jrOPMLCreateXMLDocument(titleString) {
  const documentObject = document.implementation.createDocument(
    null, 'opml', null);

  documentObject.documentElement.setAttribute('version', '2.0');

  const headElement = documentObject.createElement('head');
  documentObject.documentElement.appendChild(headElement);

  if(titleString) {
    const titleElement = documentObject.createElement('title');
    titleElement.textContent = titleString;
    headElement.appendChild(titleElement);
  }

  const currentDate = new Date();
  const currentDateUTCString = currentDate.toUTCString();

  const dateCreatedElement = documentObject.createElement('datecreated');
  dateCreatedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateCreatedElement);

  const dateModifiedElement = documentObject.createElement('datemodified');
  dateModifiedElement.textContent = currentDateUTCString;
  headElement.appendChild(dateModifiedElement);

  const docsElement = documentObject.createElement('docs');
  docsElement.textContent = 'http://dev.opml.org/spec2.html';
  headElement.appendChild(docsElement);

  const bodyElement = documentObject.createElement('body');
  documentObject.documentElement.appendChild(bodyElement);
  return documentObject;
}

function jrOPMLCreateOutlineElementFromFeed(documentObject, feedObject) {
  const outlineElement = documentObject.createElement('outline');

  // Only set the type if it is known
  if(feedObject.type) {
    outlineElement.setAttribute('type', feedObject.type);
  }

  // This url corresponds to the fetchable location of the feed itself
  const feedURLString = feedGetURLString(feedObject);
  outlineElement.setAttribute('xmlUrl', feedURLString);

  // Set both title and text, if available
  if(feedObject.title) {
    outlineElement.setAttribute('text', feedObject.title);
    outlineElement.setAttribute('title', feedObject.title);
  }

  // Set description if known
  if(feedObject.description) {
    outlineElement.setAttribute('description', feedObject.description);
  }

  // This url corresponds to the feed's declared associated website
  // link is a url string
  if(feedObject.link) {
    outlineElement.setAttribute('htmlUrl', feedObject.link);
  }

  return outlineElement;
}

//////////////////////////////////////////////////
// Import functions

// Import one or more files into the app
// @param files {Iterable<File>} - e.g. FileList
async function jrOPMLImportFiles(fileList, logObject) {

  if(logObject) {
    logObject.log('Importing %d OPML XML files', fileList.length);
  }

  // TODO: due to refactoring this linking has to be completely refactored
  //const subService = new SubscriptionService();
  //subService.suppressNotifications = true;

  const filesArray = [...fileList];
  const importPromises = filesArray.map(
    jrOPMLImportFileSilently.bind(null, logObject));
  const importPromiseResolutions = await Promise.all(importPromises);
  const numFeedsImported = importPromiseResolutions.reduce(
    (perFileCount, totalCount) => perFileCount + totalCount, 0);

  if(logObject) {
    logObject.log('Imported %d feeds from %d files', numFeedsImported,
    fileList.length);
  }
}

// Decorates jrOPMLImportFile to avoid Promise.all failfast behavior
async function jrOPMLImportFileSilently(logObject, fileObject) {
  let subscriptionCount = 0;
  try {
    subscriptionCount = await jrOPMLImportFile(logObject, fileObject);
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
  return subscriptionCount;
}



// Returns number of feeds added
async function jrOPMLImportFile(logObject, fileObject) {

  if(logObject) {
    logObject.log('Importing OPML file "%s", byte size %d, mime type "%s"',
      fileObject.name, fileObject.size, fileObject.type);
  }

  jrOPMLAssertImportableFile(fileObject);
  const text = await OPMLImporter.jrOPMLReadFileAsText(fileObject);
  const doc = OPMLImporter.jrOPMLParseFromString(text);
  let outlines = OPMLImporter.jrOPMLSelectOutlineElements(doc);
  outlines = outlines.map(jrOPMLCreateOutlineElement);
  outlines = outlines.filter(jrOPMLOutlineObjectHasValidType);
  outlines = outlines.filter(jrOPMLOutlineObjectHasURL);
  outlines = outlines.filter(jrOPMLTransformOutlineURL);

  if(!outlines.length) {
    return 0;
  }


  // Filter duplicates, favoring earlier in document order
  const uniqueURLs = [];
  outlines = outlines.filter((o) => {
    if(!uniqueURLs.includes(o.url)) {
      uniqueURLs.push(o.url);
      return true;
    }
    return false;
  });

  outlines.forEach(jrOPMLNormalizeOutlineObjectLink);
  const feeds = outlines.map(jrOPMLCreateFeedObject);
  const proms = feeds.map(jrOPMLSubscribe);
  const resolutions = await Promise.all(proms);
  return resolutions.reduce((n, result) => result ? n + 1 : n, 0);
}

function jrOPMLCreateOutlineObject(outlineElement) {
  return {
    'description': outlineElement.getAttribute('description'),
    'link': outlineElement.getAttribute('htmlUrl'),
    'text': outlineElement.getAttribute('text'),
    'title': outlineElement.getAttribute('title'),
    'type': outlineElement.getAttribute('type'),
    'url': outlineElement.getAttribute('xmlUrl')
  };
}

function jrOPMLTransformOutlineURL(logObject, outlineObject) {
  try {
    const urlObject = new URL(outlineObject.url);
    outlineObject.url = urlObject.href;
    return true;
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }

  }
  return false;
}

function jrOPMLOutlineObjectHasValidType(outlineObject) {
  return /rss|rdf|feed/i.test(outlineObject.type);
}

function jrOPMLOutlineObjectHasURL(outlineObject) {
  return outlineObject.url;
}

function jrOPMLNormalizeOutlineObjectLink(logObject, outline) {
  if(outline.link) {
    try {
      const url = new URL(outline.link);
      outline.link = url.href;
    } catch(error) {
      if(logObject) {
        logObject.warn(error);
      }

      outline.link = undefined;
    }
  }
}

function jrOPMLCreateFeedObject(outlineObject) {
  const feedObject = {
    'type': outlineObject.type,
    'urls': [],
    'title': outlineObject.title || outlineObject.text,
    'description': outlineObject.description,
    'link': outlineObject.link
  };
  jrAddFeedURL(feedObject, outlineObject.url);
  return feedObject;
}

function jrOPMLAssertImportableFile(fileObject) {
  if(fileObject.size < 1) {
    throw new TypeError(`"${fileObject.name}" is empty`);
  }

  if(!jrOPMLIsSupportedFileType(fileObject.type)) {
    throw new TypeError(
      `"${fileObject.name}" has unsupported type "${fileObject.type}"`);
  }
}

// Returns the result of subscribe, which is the added feed object, or null
// if an error occurs. This wraps so that it can be used with Promise.all
async function jrOPMLSubscribe(logObject, feedObject) {


  // TODO: this is bugged now due to subService not being passed around

  try {
    return await subService.subscribe(feedObject);
  } catch(error) {
    if(logObject) {
      logObject.warn(error);
    }
  }
}

function jrOPMLIsSupportedFileType(fileTypeString) {

  // Noramlize the type
  let normType = fileTypeString || '';
  normType = normType.trim().toLowerCase();

  // Check if the normalized type is supported
  const supportedTypes = ['application/xml', 'text/xml'];
  return supportedTypes.includes(normType);
}


function jrOPMLParseFromString(string) {
  const parser = new DOMParser();
  const documentObject = parser.parseFromString(string, 'application/xml');

  const errorElement = documentObject.querySelector('parsererror');
  if(errorElement) {
    throw new Error(errorElement.textContent);
  }

  const documentElementName = documentObject.documentElement.localName;
  if(documentElementName !== 'opml')
    throw new Error(`Invalid document element: ${documentElementName}`);
  return documentObject;
}

function jrOPMLReadFileAsText(fileObject) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(fileObject);
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
  });
}

function jrOPMLSelectOutlineElements(documentObject) {
  const outlineList = documentObject.querySelectorAll(
    'opml > body > outline');
  return [...outlineList];
}
