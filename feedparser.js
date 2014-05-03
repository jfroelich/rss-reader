// Parse a feed XML file and generate a feed object

var feedParser = {};

// Parses XML doc and stores values as object properties
feedParser.parseXML = function(xmlDoc) {

  var doc = xmlDoc.documentElement;
  var rootName = doc.nodeName.toLowerCase();
  var isAtom = rootName == 'feed';

  // A dummy temp variable
  var tmp;
  
  var gtc = this.gtc;

  var result = { 'entries': [] };

  tmp = gtc(doc, 'channel > title, feed > title');
  if(tmp) result.title = tmp;

  tmp = gtc(doc, 'channel > description, feed > subtitle');
  if(tmp) result.description = tmp;

  tmp = doc.querySelector('channel > link:not([href]), feed > link[rel=\'alternate\']');
  
  if(tmp) {
    if(isAtom) {
      console.log('Atom feed link %s, %s', tmp, tmp.getAttribute('href'));
      
      tmp = tmp.getAttribute('href');
    } else {
      tmp = tmp.textContent;
    }
  } else {
    if(isAtom) {
       tmp = doc.querySelector('feed > link[rel=\'self\']');
       if(tmp) {
         tmp = tmp.getAttribute('href');
         if(tmp) {
           tmp = tmp.trim(); 
         }
       }
    }
  }
  
  if(tmp) result.link = tmp;

  tmp = gtc(doc, 'channel > pubDate, channel > lastBuildDate, feed > updated, channel > date');
  if(tmp) result.date = tmp;

  var entries = doc.querySelectorAll('channel > item, item, feed > entry');

  each(entries, function(entry) {
    var e = {};

    // Grab the title (only set if not empty)
    tmp = gtc(entry, 'title');
    if(tmp) e.title = tmp;

    // Grab the link
    tmp = entry.querySelector('link[rel=\'alternate\'], link:not([href])');    

    if(!tmp) {
      // Fallback to href value
      // See http://martinfowler.com/feed.atom
      tmp = entry.querySelector('link[href]');
    }

    if(tmp) {
      tmp = isAtom ? tmp.getAttribute('href') : tmp.textContent;
      // TODO: Only set if not empty
      if(tmp) {
        e.link = tmp.trim();
      }
    }

    // Author
    tmp = gtc(entry, isAtom ? 'author > name' : 'author, creator, publisher');
    // Only set if not empty
    if(tmp) e.author = tmp;

    // Publication date
    // Only set if not empty
    tmp = gtc(entry, 'pubDate, issued, published, updated, date');
    if(tmp) e.pubdate = tmp;
    
    // Content
    // querySelectorAll searches a comma separated list of selections in document order,
    // which is different than query order. Since we want to use query order we have to 
    // perform separate queries in order.
    tmp = entry.querySelector('encoded');
    if(!tmp) tmp = entry.querySelector('content');
    if(!tmp) tmp = entry.querySelector('description');
    if(!tmp) tmp = entry.querySelector('summary');

    if(tmp) {
      if(isAtom) {
        var contents = [];
        each(tmp.childNodes, function(nd) {
          if(nd.nodeType == Node.ELEMENT_NODE) {
            contents.push(nd.innerHTML);
          } else if(nd.nodeType == Node.TEXT_NODE ||
            nd.nodeType == Node.CDATA_SECTION_NODE) {
            contents.push(nd.textContent);
          }
        });

        e.content = contents.join('').trim();
        if(e.content.length == 0) {
          e.content = tmp.textContent.trim();
        }
      } else {
        e.content = tmp.textContent.trim();
      }
    }
    
    // Remove the property if content is empty
    if(!e.content)
      delete e.content;

    // Only add entries that have at least one of these present
    if(e.title || e.content || e.link) {
      result.entries.push(e);
    }
  });

  return result;
};

// Helper for getting the textual content of an element
feedParser.gtc = function(element, query) {
  var node = element.querySelector(query);
  if(node) {
    return node.textContent.trim();
  }
};