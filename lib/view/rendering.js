var app = chrome.extension.getBackgroundPage();


function renderEntry(entry) {
  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = app.dates.formatDate(new Date(entry.pubdate));
  }

  var entryLink = app.strings.escapeHTMLHREF(entry.link);

  var template = ['<a href="',entryLink,
    '" class="entry-title" target="_blank" title="',
    app.strings.escapeHTMLAttribute(entryTitle),
    '">',app.strings.truncate(app.strings.escapeHTML(entryTitle),100),
    '</a><span class="entry-content">', entryContent,'</span>',
    '<span class="entrysource">',
    '<a class="entrysourcelink" url="',entryLink,'" title="',
    app.strings.escapeHTMLAttribute(entryTitle),'">Bookmark</a> - ',
    '<span title="',
    app.strings.escapeHTMLAttribute(feedTitle),'">',
    '<img src="',app.favIcon.getURL(entry.baseURI),
    '" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    app.strings.escapeHTML(app.strings.truncate(feedTitle, 40)),'</span>',
    (entryAuthor ? ' by ' + app.strings.escapeHTML(app.strings.truncate(entry.author,40)):''),
    ' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  
  var bookmark = elem.querySelector('a[url]');
  bookmark.onclick = addBookmarkClick;

  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);
}


function addBookmarkClick(event) {

  // TODO: remove the click listener?
  
  var url = event.target.getAttribute('url');
  var title = event.target.getAttribute('title');
  if(!url) return;
  if(title) title = title.trim();
  title = title || url;
  
  chrome.bookmarks.create({
      'title': title,
      'url': url
    }, function(){
  });
  return false;
}