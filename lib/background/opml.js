/**
 * Utilties for reading and writing OPML, and merging
 * the feeds into this app
 * The OPML specification: http://dev.opml.org/spec2.html
 */
var opml = {};

// Outline types that we are looking for in an RSS context
// Corresponds to <outline type="?">
opml.OUTLINE_TYPES_ = {
  rss:1,'rdf:rdf':1,rdf:1,atom:1,feed:1
};

// Creates and returns an OPML XMLDocument object
// feeds array of feed objects with properties title,description,link,url
opml.createXMLDocument = function(feeds) {
  
  var doc = document.implementation.createDocument(null, null);

  var elementOPML = doc.createElement('opml');
  elementOPML.setAttribute('version', '2.0');
  doc.appendChild(elementOPML);

  var head = doc.createElement('head');
  elementOPML.appendChild(head);

  var title = doc.createElement('title');
  title.textContent = 'honeybadger-subscriptions.xml';
  head.appendChild(title);

  // As we do not know private user information, use 
  // app metadata for ownerName
  var manifest = chrome.runtime.getManifest();
  if(manifest.name && manifest.version) {
    var ownerName = doc.createElement('ownerName');
    ownerName.textContent = manifest.name + ' version ' + manifest.version;
    head.appendChild(ownerName);      
  }

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

// Generates an array of feeds as a result of 
// parsing a string representing a serialized OPML document
opml.parseOPMLString = function(str) {
  var parser = new DOMParser();
  var xmlDocument = parser.parseFromString(str, 'application/xml');

  // In Chrome, if an error occurs when parsing xml using DOMParser
  // it does not throw an exception sometimes, and instead yields an 
  // XML document with an embedded error message. So here we inspect
  // the document and throw an exception instead.
  var parserErrorElement = xmlDocument.querySelector('parsererror');
  if(parserErrorElement && parserErrorElement.firstChild && 
     parserErrorElement.firstChild.nextSibling) {
     throw parserErrorElement.firstChild.nextSibling.textContent;
  }
  
  // Could not locate the exception, maybe Chrome changed out it 
  // reports errors. Fall back to 
  if(parserErrorElement) {
     throw 'The file is not a validly formatted OPML file.';
  }

  return opml.getFeedsAsArray(xmlDocument);
};

// Generates an array of feeds by extracting the feeds from 
// an XML document (that should be an instance of an OPML document)
opml.getFeedsAsArray = function(xmlDocument) {

  if(!xmlDocument.documentElement) {
    throw 'Invalid OPML file - missing root element <opml>...';
  }

  if(xmlDocument.documentElement.localName != 'opml') {
    throw 'Invalid OPML file - the root element is not <opml> ... ';
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
    
    // Look at sub outline nodes????
  });

  return feeds;  
};


// Returns true if the type is one of the allowed types or if 
// the type is undefined
opml.isAllowedOutlineType = function(type) {
  if(type) {
    type = type.replace(/\s+/g,'').toLowerCase();
  }

  if(!type) {
    return true;
  }  

  return !!opml.OUTLINE_TYPES_[type];
};


// Import the array of feeds, then call callback
opml.import = function(feeds, callback) {
  // console.log('Starting import of up to %s feeds', feeds.length);
  
  var feedsProcessed = 0, feedsAdded = 0;
  var startTime = new Date().getTime();

  var incrementAndCallbackIfDone = function() {
    feedsProcessed++;
    // console.log('Processed %s of %s', feedsProcessed, feeds.length);
    if(feedsProcessed >= feeds.length) {
      var elapsed = ((new Date().getTime() - startTime) / 1000).toFixed(2);
      console.log('Imported %s of %s feeds in %s seconds', feedsAdded, feeds.length, elapsed);
      if(callback) {
        callback(feedsAdded, feeds.length, elapsed);  
      }
    }
  };

  model.connect(function(db) {
    feeds.forEach(function(feed) {
      //console.log('Attempting to import %s', feed.url);
      feed.url = feed.url ? feed.url.trim() : '';
      if(!feed.url) {
        incrementAndCallbackIfDone();
        return;
      }

      model.isSubscribed(db, feed.url, function(storedFeed) {
        if(storedFeed) {
          // Feed already stored
          //console.log('Not importing %s because it already exists', storedFeed.url);
          incrementAndCallbackIfDone();
        } else {
          console.log('Importing %s', feed.url);
          
          // Prep feed for insert
          
          // Feed title must be defined in order for it to appear
          // in the feed list which is based on a title index
          if(!feed.title) {
            feed.title = '';
          }
          
          model.putFeed(db, feed, function(updatedFeed) {
            console.log('Imported %s', updatedFeed.url);
            chrome.runtime.sendMessage({'type':'subscribe','feed':updatedFeed});
            feedsAdded++;
            incrementAndCallbackIfDone();
          });
        }
      });
    });
  });
};