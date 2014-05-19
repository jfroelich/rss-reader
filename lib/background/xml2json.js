(function(exports) {
'use strict';

// Transform RSS/Atom/RDF XML to normalized JSON
function xml2json(xmlDocument) {
  var doc = xmlDocument.documentElement;
  var rootName = doc.nodeName.toLowerCase();

  if(rootName == 'rss') {
    return rss2json(xmlDocument);
  } else if(rootName == 'feed') {
    return atom2json(xmlDocument);
  } else if(rootName == 'rdf:rdf') {
    return rdf2json(xmlDocument);
  }

  throw {
    'type':'UNKNOWN_DOCUMENT_ELEMENT',
    'document': xmlDocument,
    'message':'Invalid document element: ' + xmlDocument.documentElement.nodeName
  };
}

function rss2json(xmlDocument) {
  var result = { 'entries': [] };
  var doc = xmlDocument.documentElement;
  var entries = doc.querySelectorAll('channel > item');
  setIfNotEmpty(result,'title',findText(doc,['channel > title']));
  setIfNotEmpty(result,'webmaster',findText(doc,['channel > webMaster']));
  setIfNotEmpty(result,'author',findText(doc,['channel > author','channel > owner > name']));
  setIfNotEmpty(result,'description',findText(doc,['channel > description']));
  setIfNotEmpty(result,'link',findText(doc,['channel > link:not([href])']));
  if(!result.link)
    setIfNotEmpty(result,'link', findText(doc,['channel > link'],'href'));
  setIfNotEmpty(result,'date', 
    findText(doc,['channel > pubDate','channel > lastBuildDate','channel > date']));
  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title', findText(entry,['title']));
    setIfNotEmpty(e,'link', findText(entry,['origLink','link']));
    setIfNotEmpty(e,'author', findText(entry,['creator','publisher']));
    setIfNotEmpty(e,'pubdate', findText(entry,['pubDate']));
    setIfNotEmpty(e,'content', findText(entry,['encoded','description','summary']));
    if(isStorable(e)) result.entries.push(e);
  });

  return result;  
}

function atom2json(xmlDocument) {
  var doc = xmlDocument.documentElement;
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('feed > entry');
  setIfNotEmpty(result,'title', findText(doc,['feed > title']));
  setIfNotEmpty(result,'description',findText(doc,['feed > subtitle']));
  setIfNotEmpty(result,'link', findText(doc,
    ['feed > link[rel="alternate"]','feed > link[rel="self"]','feed > link'],'href'));
  setIfNotEmpty(result,'author',findText(doc,['feed > author > name']));
  setIfNotEmpty(result,'date',findText(doc,['feed > updated']));
  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title',findText(entry,['title']));
    setIfNotEmpty(e,'link', findText(entry,[
      'link[rel="alternate"]','link[rel="self"]', 
      'link:not([href])','link[href]'
    ],'href'));
    setIfNotEmpty(e,'author',findText(entry,['author > name']));
    setIfNotEmpty(e,'pubdate',findText(entry,['published','updated']));

    // TODO: clean this up
    var tmp = entry.querySelector('content');
    if(tmp) {
      var contents = [];
      each(tmp.childNodes, function(nd) {
        if(nd.nodeType == Node.ELEMENT_NODE) {
          contents.push(nd.innerHTML);
        } else if(nd.nodeType == Node.TEXT_NODE ||
          nd.nodeType == Node.CDATA_SECTION_NODE) {
          contents.push(nd.textContent);
        }
      });
      setIfNotEmpty(e,'content', contents.join('').trim());
      if(!e.content) setIfNotEmpty(e,'content',tmp.textContent.trim());
    }

    if(isStorable(e)) result.entries.push(e);
  });

  return result;
}

function rdf2json(xmlDocument) {
  var doc = xmlDocument.documentElement;
  var result = { 'entries': [] };
  var entries = doc.querySelectorAll('item');
  setIfNotEmpty(result,'title',findText(doc,['channel > title']));
  setIfNotEmpty(result,'description', findText(doc,['channel > description']));
  setIfNotEmpty(result,'link', findText(doc,['channel > link:not([rel])']));
  if(!result.link)
    setIfNotEmpty(result,'link', findText(doc,['channel > link[rel="self"]','channel > link'],'href'));
  setIfNotEmpty(result,'date', findText(doc,['channel > date']));
  each(entries, function(entry) {
    var e = {};
    setIfNotEmpty(e,'title', findText(entry,['title']));
    setIfNotEmpty(e,'link', findText(entry,['link']));
    setIfNotEmpty(e,'author', findText(entry,['creator']));
    setIfNotEmpty(e,'pubdate', findText(entry,['date']));
    setIfNotEmpty(e,'content', findText(entry,['description']));
    if(isStorable(e)) result.entries.push(e);
  });
  return result;
}

function setIfNotEmpty(obj, key, value) {
  if(value) {
    obj[key] = value;
  }
}

// Searches in selector order, not document order
function findText(element, selectors, attribute) {
  var node, text, result;
  selectors.forEach(function(selector) {
    if(result) return;
    node = element.querySelector(selector);
    if(node) {
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
}

// Returns true if the entry should be included in the result array
function isStorable(entry) {
  return entry.title || entry.content || entry.link;
}

// Returns true if the xml file is convertable
function isXMLFeed(xmlDocument) {
  var name = xmlDocument.documentElement.nodeName.toLowerCase();
  return name == 'rss' || name == 'feed' || name == 'rdf:rdf';
}

exports.xml2json = xml2json;
exports.isXMLFeed = isXMLFeed;

}(this));