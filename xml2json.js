
// TODO: isStorable logic does not belong here
// TODO: this needs a better name. Something like FeedParser
var xml2json = {};


// Returns json representation of xml document
xml2json.transform = function(xml) {
  
  
  // TODO: why am i using nodeName and not localName here?
  var rootName = xml.documentElement.nodeName.toLowerCase();

  if(rootName == 'rss') {
    return this.rss2json(xml.documentElement);
  } else if(rootName == 'feed') {
    return this.atom2json(xml.documentElement);
  } else if(rootName == 'rdf:rdf') {
    return this.rdf2json(xml.documentElement);
  }

  throw {
    type:'UNKNOWN_DOCUMENT_ELEMENT',
    document: xml,
    message:'Invalid document element: ' + 
      xml.documentElement.nodeName
  };
};

xml2json.rss2json = function(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('channel > item');
  var sine = this.setIfNotEmpty_;
  var ft = this.findText_;
  var isStorable = this.isStorable_;

  sine(result,'title',ft(doc,['channel > title']));
  sine(result,'webmaster',ft(doc,['channel > webMaster']));
  sine(result,'author',ft(doc,['channel > author','channel > owner > name']));
  sine(result,'description',ft(doc,['channel > description']));
  sine(result,'link',ft(doc,['channel > link:not([href])']));
  
  if(!result.link) {
    sine(result,'link', ft(doc,['channel > link'],'href'));
  }
  
  sine(result,'date', ft(doc,
    ['channel > pubDate','channel > lastBuildDate','channel > date']));

  util.each(entries, function(entry) {
    var e = {};
    sine(e,'title', ft(entry,['title']));
    sine(e,'link', ft(entry,['origLink','link']));
    sine(e,'author', ft(entry,['creator','publisher']));
    sine(e,'pubdate', ft(entry,['pubDate']));
    sine(e,'content', ft(entry,['encoded','description','summary']));
    if(isStorable(e)) result.entries.push(e);
  });

  return result;  
};

xml2json.atom2json = function(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('feed > entry');
  var sine = this.setIfNotEmpty_;
  var ft = this.findText_;
  var isStorable = this.isStorable_;
  
  sine(result,'title', ft(doc,['feed > title']));
  sine(result,'description',ft(doc,['feed > subtitle']));
  sine(result,'link', ft(doc,
    ['feed > link[rel="alternate"]','feed > link[rel="self"]','feed > link'],'href'));
  sine(result,'author',ft(doc,['feed > author > name']));
  sine(result,'date',ft(doc,['feed > updated']));

  util.each(entries, function(entry) {
    var e = {};
    sine(e,'title',ft(entry,['title']));
    sine(e,'link', ft(entry,[
      'link[rel="alternate"]','link[rel="self"]', 
      'link:not([href])','link[href]'
    ],'href'));
    sine(e,'author',ft(entry,['author > name']));
    sine(e,'pubdate',ft(entry,['published','updated']));

    // TODO: clean this up
    var tmp = entry.querySelector('content');
    if(tmp) {
      var contents = [];
      util.each(tmp.childNodes, function(nd) {
        if(nd.nodeType == Node.ELEMENT_NODE) {
          contents.push(nd.innerHTML);
        } else if(nd.nodeType == Node.TEXT_NODE ||
          nd.nodeType == Node.CDATA_SECTION_NODE) {
          contents.push(nd.textContent);
        }
      });
      
      sine(e,'content', contents.join('').trim());
      
      if(!e.content) {
        sine(e,'content',tmp.textContent.trim());
      }
    }

    if(isStorable(e)) result.entries.push(e);
  });

  return result;
};

xml2json.rdf2json = function(doc) {
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('item');
  var sine = this.setIfNotEmpty_;
  var ft = this.findText_;
  var isStorable = this.isStorable_;
  
  sine(result,'title',ft(doc,['channel > title']));
  sine(result,'description', ft(doc,['channel > description']));
  sine(result,'link', ft(doc,['channel > link:not([rel])']));

  if(!result.link) {
    sine(result,'link', ft(doc,['channel > link[rel="self"]','channel > link'],'href'));
  }
    
  sine(result,'date', ft(doc,['channel > date']));

  util.each(entries, function(entry) {
    var e = {};
    sine(e,'title', ft(entry,['title']));
    sine(e,'link', ft(entry,['link']));
    sine(e,'author', ft(entry,['creator']));
    sine(e,'pubdate', ft(entry,['date']));
    sine(e,'content', ft(entry,['description']));
    if(isStorable(e)) result.entries.push(e);
  });
  return result;
};

xml2json.setIfNotEmpty_ = function(obj, key, value) {
  if(value) {
    obj[key] = value;
  }
};

// Searches in selector order, not document order
xml2json.findText_ = function(element, selectors, attribute) {
  
  var node, text, result;
  
  selectors.forEach(function(selector) {
    if(result) return;
    node = element.querySelector(selector);
    if(node) {
      
      // If attribute is specified, we get the value of the attribute
      // instead of the node's textContent
      
      text = attribute ? node.getAttribute(attribute) : node.textContent;
      if(text) {
        text = text.trim();
        if(text.length) {
          result = text;
        }
      }
    }
  });
  
  return result;
};

// Returns true if the entry should be included in the result array
xml2json.isStorable_ = function(entry) {
  return entry.title || entry.content || entry.link;
};

// Returns true if the xml file is convertable. Otherwise 
// returns undefined.
xml2json.isXMLFeed = function(xml) {
  console.dir(xml);
  if(xml && xml.documentElement) {
    var name = xml.documentElement.nodeName.toLowerCase();
    return name == 'rss' || name == 'feed' || name == 'rdf:rdf';
  }
};