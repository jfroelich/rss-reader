/**
 * Export/import functions, specifically OPML
 */



/************************ FEED IMPORT/EXPORT FUNCTIONALITY ********************************
 * TODO: refactor as a part of change to backend.js, add comments
 */


/************* OPML FUNCTIONS ******************************************
 * TODO: refactor
 */

function createOPMLDocument(feeds, titleValue) {

  var doc = document.implementation.createDocument(null, null);

  var elementOPML = doc.createElement('opml');
  elementOPML.setAttribute('version', '2.0');
  doc.appendChild(elementOPML);

  var head = doc.createElement('head');
  elementOPML.appendChild(head);

  var title = doc.createElement('title');
  title.textContent = titleValue || 'subscriptions.xml';
  head.appendChild(title);

  var dateNow = new Date();
  var rfc822DateString = dateNow.toUTCString();

  var dateCreated = doc.createElement('dateCreated');
  dateCreated.textContent = rfc822DateString;
  head.appendChild(dateCreated);

  var dateModified = doc.createElement('dateModified');
  dateModified.textContent = rfc822DateString;
  head.appendChild(dateModified);

  var elementDocs = doc.createElement('docs');
  elementDocs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(elementDocs);

  var body = doc.createElement('body');
  elementOPML.appendChild(body);

  (feeds || []).forEach(function(feed) {

    if(!feed.title || !feed.url)
      return;

    var outline = doc.createElement('outline');
    outline.setAttribute('type', 'rss');

    var title = stripControls(feed.title);
    outline.setAttribute('text', title);
    outline.setAttribute('title', title);
    outline.setAttribute('xmlUrl', feed.url);

    if(feed.description)
      outline.setAttribute('description', stripControls(stripTags(feed.description||'','')));

    if(feed.link)
        outline.setAttribute('htmlUrl', feed.link);

    body.appendChild(outline);
  });

  return doc;
}

function parseOPMLFromString(str) {
  var xmlDocument = parseXML(str);
  return parseOPMLDocument(xmlDocument);
}

/**
 * TODO: rename, we are not parsing here, we are coercing or something
 * TODO: use getElementsByTagName instead of $$ which is querySelectorAll
 * because we are reading, not writing
 */
function parseOPMLDocument(xmlDocument) {

  var outlineNodes, feedOutlineNodes;

  if(xmlDocument && xmlDocument.documentElement &&
    xmlDocument.documentElement.localName == 'opml') {

    outlineNodes = $$('outline', xmlDocument);
    feedOutlineNodes = filter(outlineNodes, isOPMLNodeTypeFeed);
    return feedOutlineNodes.map(coerceOPMLOutline);

  } else {
    return [];
  }
}

/**
 * TODO: again, choose a more appropriate name for this
 */
function coerceOPMLOutline(node) {
  return {
    title: node.getAttribute('title') || node.getAttribute('text'),
    description: stripTags(stripControls(node.getAttribute('description'))),
    url: stripControls(node.getAttribute('xmlUrl')),
    link: stripControls(node.getAttribute('htmlUrl'))
  };
}

function isOPMLNodeTypeFeed(node) {
  var type = node.getAttribute('type');
  return /rss|rdf|feed/i.test(type);
}



/**
 * Async.
 *
 * @param files a FileList object
 * @param callback called when completed
 */
function importOPMLFiles(files, callback) {

  if(!files || !files.length) {
    callback();
    return;
  }

  var fileCounter = files.length, exceptions = [], feedsHash = {};

  var aggregateByURL = function(feed) {
    if(feed.url) feedsHash[feed.url] = feed;
  };

  var onFileLoad = function(event) {
    try {
      var parsedFeeds = parseOPMLString(event.target.result);
      parsedFeeds.forEach(aggregateByURL);
    } catch(exception) {
      exceptions.push(exception);
    }

    if(--fileCounter == 0) {
      importFeeds(values(feedsHash), exceptions, callback);
    }
  };

  each(files, function(file) {
    var reader = new FileReader();
    reader.onload = onFileLoad;
    reader.readAsText(file);
  });
}

function importFeeds(feeds, exceptions, callback) {
  var feedsProcessed = 0, feedsAdded = 0;
  callback = callback || function(){};

  if(!feeds || !feeds.length) {
    console.log('no feeds to import');
    console.dir(exceptions);
    callback(feedsAdded, feedsProcessed, exceptions);
    return;
  }

  var params = {};
  params.onerror = onSuccessOrError;
  params.oncomplete = function() {
    feedsAdded++;
    onSuccessOrError();
  };

  var onSuccessOrError = function() {
    feedsProcessed++;
    if(feedsProcessed >= feeds.length) {
      console.log('Imported %s of %s feeds with %s exceptions',
        feedsAdded, feeds.length, exceptions.length);
      callback(feedsAdded, feeds.length, exceptions);
    }
  };

  openDB(function(db) {
    // TODO: this is out of date
    // Pack in an open db conn so subscriptions.add
    // can reuse it per call.
    params.db = db;
    feeds.forEach(function(feed) {
      params.url = feed.url ? feed.url.trim() : '';
      if(params.url) {
        addSubscription(params);
      }
    });
  });
}
