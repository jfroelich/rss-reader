// Parse a feed XML file and generate a feed object
function parseFeedXML(xmlDoc) {

  if(!xmlDoc) {
    return {'error':'Invalid XML'};
  } 

  if(!xmlDoc.documentElement) {
    return {'error':'Invalid XML - no document element'};
  }

  var doc = xmlDoc.documentElement;
  var rootName = doc.nodeName.toLowerCase();
  var isAtom = rootName == 'feed';
  var tmp;
  var gtc = function(element, query) {
    var node = element.querySelector(query);
    if(node) {
      return node.textContent.trim();
    }
  };

  var result = { 'entries': [] };

  tmp = gtc(doc, 'channel > title, feed > title');
  if(tmp) result.title = tmp;

  tmp = gtc(doc, 'channel > description, feed > subtitle');
  if(tmp) result.description = tmp;

  tmp = doc.querySelector('channel > link:not([href]), feed > link[rel=\'alternate\']');

  if(tmp) {
    if(isAtom) {
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

    tmp = gtc(entry, 'title');
    if(tmp) e.title = tmp;

    tmp = entry.querySelector('link[rel=\'alternate\'], link:not([href])');    
    if(!tmp) tmp = entry.querySelector('link[href]');
    if(tmp) {
      tmp = isAtom ? tmp.getAttribute('href') : tmp.textContent;
      if(tmp) e.link = tmp.trim();
    }

    tmp = gtc(entry, isAtom ? 'author > name' : 'author, creator, publisher');
    if(tmp) e.author = tmp;

    tmp = gtc(entry, 'pubDate, issued, published, updated, date');
    if(tmp) e.pubdate = tmp;

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
    
    if(!e.content)
      delete e.content;

    if(e.title || e.content || e.link) {
      result.entries.push(e);
    }
  });

  return result;
}