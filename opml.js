// OPML utilities
var opml = {};

opml.createXMLDocument = function(feeds, titleValue) {
  
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
    if(!feed.title || !feed.url) return;
    var outline = doc.createElement('outline');
    outline.setAttribute('type', 'rss');
    var title = util.stripControls(feed.title);      
    outline.setAttribute('text', title);
    outline.setAttribute('title', title);
    outline.setAttribute('xmlUrl', feed.url);
    if(feed.description)
      outline.setAttribute('description', util.stripControls(util.stripTags(feed.description||'','')));
    if(feed.link) outline.setAttribute('htmlUrl', feed.link);
    body.appendChild(outline);
  });
  return doc;
};

opml.parseString = function(str, fileDescriptor) {
  try {
    var doc = util.parseXML(str);
  } catch(e) {
    throw {type:'parseopml',file:fileDescriptor,message: e};
  }

  return opml.parseXML(doc, fileDescriptor);
};

opml.parseXML = function(doc, fileDescriptor) {
  if(!doc.documentElement || doc.documentElement.localName != 'opml')
    throw {type:'parseopml',file:fileDescriptor,message: 'Invalid document element'};
  return util.filter($$('outline',doc), function(node) {
    return /rss|rdf|feed/i.test(node.getAttribute('type'));    
  }).map(function(node) {
    return {
      title: node.getAttribute('title') || node.getAttribute('text'),
      description: util.stripTags(util.stripControls(node.getAttribute('description'))),
      url: util.stripControls(node.getAttribute('xmlUrl')),
      link: util.stripControls(node.getAttribute('htmlUrl'))
    };
  });
};