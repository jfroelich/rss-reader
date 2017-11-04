'use strict';

// import base/assert.js
// import base/indexeddb.js
// import net/mime.js
// import opml-document.js
// import opml-outline.js
// import opml-parse.js
// import favicon.js
// import feed.js
// import base/file-utils.js
// import reader-db.js
// import subscription.js

// Import the collection of opml files
// @param files {FileList} a collection of File objects, such as one
// generated by an HTML input element after browsing for files
// @returns status
async function readerImportFiles(files) {
  assert(files instanceof FileList);
  console.log('importing %d files', files.length);

  let readerConn, iconConn;
  try {
    [readerConn, iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);

    const promises = [];
    for(const file of files) {
      promises.push(readerImportFile(file, readerConn, iconConn));
    }

    await promiseEvery(promises);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  } finally {
    indexedDBClose(readerConn, iconConn);
  }

  return RDR_OK;
}

async function readerImportFile(file, readerConn, iconConn) {
  assert(file instanceof File);
  assert(indexedDBIsOpen(readerConn));
  assert(indexedDBIsOpen(iconConn));
  console.log('importing opml file', file.name);

  if(file.size < 1) {
    console.log('file %s is 0 bytes', file.name);
    return 0;
  }

  if(!mime.isXML(file.type)) {
    console.log('file %s is not mime type xml', file.type);
    return 0;
  }

  let fileContent;
  try {
    fileContent = await FileUtils.readAsText(file);
  } catch(error) {
    console.warn(error);
    return 0;
  }

  let [status, document] = OPMLParser.parse(fileContent);
  if(status !== RDR_OK) {
    console.log('error parsing opml file', file.name);
    return 0;
  }

  opmlRemoveOutlinesWithInvalidTypes(document);
  opmlNormalizeOutlineXMLURLs(document);
  opmlRemoveOutlinesMissingXMLURLs(document);

  const outlines = opmlGetOutlineObjects(document);
  if(!outlines.length) {
    console.log('file %s contained 0 outlines', file.name);
    return 0;
  }

  const uniqueOutlines = readerImportGroupOutlines(outlines);
  const dupCount = outlines.length - uniqueOutlines.length;
  console.log('found %d duplicates in file', dupCount, file.name);

  for(const outline of uniqueOutlines) {
    opmlOutlineNormalizeHTMLURL(outline);
  }

  const feeds = [];
  for(const outline of uniqueOutlines) {
    feeds.push(opmlOutlineToFeed(outline));
  }

  const sc = new SubscriptionContext();
  sc.readerConn = readerConn;
  sc.iconConn = iconConn;
  sc.timeoutMs = timeoutMs;
  sc.notify = false;

  // Allow exceptions to bubble
  const sub_results = await subscriptionAddAll.call(sc, feeds);

  // Tally successful subscriptions
  let subCount = 0;
  for(const subResult of sub_results) {
    if(subResult.status === RDR_OK) {
      subCount++;
    }
  }

  console.log('subbed to %d of %d feeds in file', subCount, feeds.length,
    file.name);
  return subCount;
}

// Filter duplicates, favoring earlier in array order
function readerImportGroupOutlines(outlines) {
  const uniqueURLs = [];
  const uniqueOutlines = [];
  for(const outline of outlines) {
    if(!uniqueURLs.includes(outline.xmlUrl)) {
      uniqueOutlines.push(outline);
      uniqueURLs.push(outline.xmlUrl);
    }
  }
  return uniqueOutlines;
}
