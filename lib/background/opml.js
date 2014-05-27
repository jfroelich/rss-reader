/**
 * Utilties for reading and writing OPML
 * The OPML specification: http://dev.opml.org/spec2.html
 *
 * TODO: consider supporting inclusion (sub outline nodes)
 */
var opml = {};

opml.OPML_VERSION = '2.0';

// Creates and returns an OPML XMLDocument object
// feeds array of feed objects with properties title,description,link,url
// Note the document has no declaration/processing instruction, even though it should
opml.createXMLDocument = function(feeds) {
  
  var doc = document.implementation.createDocument(null, null);

  var elementOPML = doc.createElement('opml');
  elementOPML.setAttribute('version', opml.OPML_VERSION);
  doc.appendChild(elementOPML);

  var head = doc.createElement('head');
  elementOPML.appendChild(head);

  var title = doc.createElement('title');
  title.textContent = 'honeybadger-subscriptions.xml';
  head.appendChild(title);

  // As we do not know private user information, and are not 
  // interested in exposing it, abuse ownerName to shove in 
  // some app metadata
  var manifest = chrome.runtime.getManifest();
  if(manifest.name && manifest.version) {
    var ownerName = doc.createElement('ownerName');
    ownerName.textContent = manifest.name + ' version ' + manifest.version;
    head.appendChild(ownerName);      
  }

  // TODO: is UTC rfc822, is this named properly?
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

  if(feeds) {
    feeds.forEach(function(feed) {
      // Panic on missing required attributes
      if(!feed.title || !feed.url) {
         return;
      }

      var outline = doc.createElement('outline');
      outline.setAttribute('type', 'rss');

      var title = feed.title.replace(/[\r\n\t]/g,'');      
      outline.setAttribute('text', title);
      outline.setAttribute('title', title);
      outline.setAttribute('xmlUrl', feed.url);

      if(feed.description) {
        var description = strings.stripTags(feed.description||'','').replace(/[\r\n\t]/g,'');
        outline.setAttribute('description', description);
      }

      if(feed.link) {
        outline.setAttribute('htmlUrl', feed.link);
      }

      body.appendChild(outline);
    });
  }

  return doc;
};

// The default type parameter to DOMParser.parseFromString
opml.DEFAULT_MIME_TYPE = 'application/xml';

// Exception codes corresponding to type of exception
opml.ERROR_PARSER_ERROR_UNKNOWN = 0;
opml.ERROR_PARSER_ERROR_ELEMENT_MESSAGE = 1;
opml.ERROR_PARSER_MISSING_DOCUMENT_ELEMENT = 2;
opml.ERROR_PARSER_DOCUMENT_ELEMENT_NOT_OPML = 3;

/**
 * Creates an exception object with type/file/message props
 */
opml.newException = function(type, fileDescriptor, message) {
  return {
    type: type || opml.ERROR_PARSER_ERROR_UNKNOWN,
    file: fileDescriptor,
    message: message
  };
};

/**
 * Generates an array of feeds as a result of parsing a string 
 * representing a serialized OPML document. mimeType and fileDescriptor 
 * are optional (but must specify null or something if want to use 
 * fileDescriptor). If mimeType undefined, falls back to the default
 * mime type.
 */
opml.parseString = function(str, mimeType, fileDescriptor) {
  var parser = new DOMParser(), xmlDocument = null;

  try {
    xmlDocument = parser.parseFromString(str, mimeType || opml.DEFAULT_MIME_TYPE);  
  } catch(exception) {
    throw opml.newException(null, fileDescriptor, exception);
  }

  // Check if Chrome 
  var parserErrorElement = xmlDocument.querySelector('parsererror');
  if(parserErrorElement && parserErrorElement.firstChild && 
     parserErrorElement.firstChild.nextSibling) {
    throw opml.newException(
      opml.ERROR_PARSER_ERROR_ELEMENT_MESSAGE, fileDescriptor,
      parserErrorElement.firstChild.nextSibling.textContent);
  }

  if(parserErrorElement) {
    throw opml.newException(null, fileDescriptor);
  }

  return opml.parseXML(xmlDocument, fileDescriptor);
};

/**
 * Generates an array of feeds by extracting the feeds from 
 * an OPML XML document. Optional file descriptor for more informative
 * exception properties being thrown
 */
opml.parseXML = function(xmlDocument, fileDescriptor) {

  if(!xmlDocument.documentElement) {
    throw opml.newException(opml.ERROR_PARSER_MISSING_DOCUMENT_ELEMENT, fileDescriptor);
  }

  if(xmlDocument.documentElement.localName != 'opml') {
    throw opml.newException(
      opml.ERROR_PARSER_DOCUMENT_ELEMENT_NOT_OPML, fileDescriptor, 
      xmlDocument.documentElement.localName);
  }

  var feeds = [];
  var outlines = xmlDocument.querySelectorAll('outline');
  collections.each(outlines, function(outline) {
    if(!opml.isAllowedOutlineType(outline.getAttribute('type'))) {
      return;
    }

    var text = outline.getAttribute('text');
    var title = outline.getAttribute('title');
    var url = outline.getAttribute('xmlUrl');
    var link = outline.getAttribute('htmlUrl');
    var description = outline.getAttribute('description');
    var feed = {};
    if(title) title = title.trim(); 
    if(title) feed.title = title;
    if(description) description = description.trim();
    if(description) feed.description = description;
    if(url) url = url.trim();
    if(url) feed.url = url;
    if(link) link = link.trim();
    if(link) feed.link = link;
    feeds.push(feed);
  });

  return feeds;  
};

// Outline types that we are looking for in an RSS context
// Corresponds to <outline type="?">
opml.OUTLINE_TYPES_ = {
  rss:1,'rdf:rdf':1,rdf:1,atom:1,feed:1
};

// Returns truthy if type is undefined or in OUTLINE_TYPES
opml.isAllowedOutlineType = function(type) {
  return opml.OUTLINE_TYPES_[type ? type.replace(/\s+/g,'').toLowerCase() : ' '];
};