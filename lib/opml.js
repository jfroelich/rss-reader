/**
 * Generates an OPML XMLDocument object. feeds should be
 * an array of feed objects. feed objects should have properties
 * title, url, description, and link. url is the only required.
 */
function createOPMLDocument(feeds, titleElementValue) {

  feeds = feeds || [];

  var opmlDocument = document.implementation.createDocument(null, null);

  var elementOPML = opmlDocument.createElement('opml');
  elementOPML.setAttribute('version', '2.0');
  opmlDocument.appendChild(elementOPML);

  var head = opmlDocument.createElement('head');
  elementOPML.appendChild(head);

  var title = opmlDocument.createElement('title');
  title.textContent = titleElementValue || 'subscriptions.xml';
  head.appendChild(title);

  var dateNow = new Date();
  var rfc822DateString = dateNow.toUTCString();

  var dateCreated = opmlDocument.createElement('dateCreated');
  dateCreated.textContent = rfc822DateString;
  head.appendChild(dateCreated);

  var dateModified = opmlDocument.createElement('dateModified');
  dateModified.textContent = rfc822DateString;
  head.appendChild(dateModified);

  var elementDocs = opmlDocument.createElement('docs');
  elementDocs.textContent = 'http://dev.opml.org/spec2.html';
  head.appendChild(elementDocs);

  var body = opmlDocument.createElement('body');
  elementOPML.appendChild(body);

  feeds.forEach(function(feed) {

    // feed.url is required for outlines
    if(!feed.url) {
      return;
    }

    var outline = opmlDocument.createElement('outline');
    outline.setAttribute('type', 'rss');

    var title = feed.title || feed.url;
    outline.setAttribute('text', title);
    outline.setAttribute('title', title);

    outline.setAttribute('xmlUrl', feed.url);

    if(feed.description) {
      outline.setAttribute('description', feed.description);
    }

    if(feed.link) {
      outline.setAttribute('htmlUrl', feed.link);
    }

    body.appendChild(outline);
  });

  return opmlDocument;
}

/**
 * Creates an array of outline objects by
 * parsing the string into an XMLDocument
 * and then extracting its content into a
 * an array. Basically a facade around
 * createOutlinesFromXML that allows starting
 * with a string.
 */
function parseOPMLDocument(str) {
  var xmlDocument = parseXML(str);
  return createOutlinesFromXML(xmlDocument);
}

/**
 * Generates an array of outline objects from an OPML XMLDocument object
 *
 * Returns undefined if the document is not an opml document, or if there
 * are no outlines found. Outlines are not created unless there is a url.
 */
function createOutlinesFromXML(xmlDocument) {

  if(!isOPMLDocument(xmlDocument)) {
    return;
  }

  var filter = Array.prototype.filter;

  var outlineElements = xmlDocument.getElementsByTagName('outline');

  // OPML can store non-feed outlines so filter by type
  var feedElements = filter.call(outlineElements, function(element) {
    return /rss|rdf|feed/i.test(element.getAttribute('type'));
  });

  // Create an outline object corresponding to each outline element
  var outlineObjects = feedElements.map(createOutlineFromXML);

  // Remove outlineObjects without URLs.
  var outlineObjectsWithURLs = outlineObjects.filter(function(outlineObject) {
    return outlineObject.url;
  });

  // Only return the array if there are outlines present in the array.
  // Otherwise return undefined.
  if(outlineObjectsWithURLs.length) {
    return outlinesWithURLs;
  }
}

/**
 * Tests whether xmlDocument is defined and has an OPML
 * document element
 */
function isOPMLDocument(xmlDocument) {
  return xmlDocument &&
         xmlDocument.documentElement &&
         xmlDocument.documentElement.matches('opml');
}

/**
 * Convert an <outline> element to an outline object
 */
function createOutlineFromXML(element) {
  var outline = {};

  var title = element.getAttribute('title') || '';
  title = title.trim();
  if(!title) {
    title = element.getAttribute('text') || '';
    title = title.trim();
  }

  title = stripControls(title);

  if(title) {
    outline.title = title;
  }

  var description = element.getAttribute('description');
  description = stripControls(description);
  description = stripTags(description);
  description = description.trim();

  if(description) {
    outline.description = description;
  }

  var url = element.getAttribute('xmlUrl') || '';
  url = stripControls(url);
  url = url.trim();

  if(url) {
    outline.url = url;
  }

  var link = element.getAttribute('htmlUrl') || '';
  link = stripControls(link);
  link = link.trim();

  if(link) {
    outline.link = link;
  }

  return outline;
}