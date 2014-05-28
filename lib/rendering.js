
var rendering = {};

rendering.app = chrome.extension.getBackgroundPage();

rendering.renderEntry = function(entry) {

  var entryTitle = entry.title || 'Untitled';
  var feedTitle = entry.feedTitle || 'Untitled';
  var entryContent = entry.content || 'No content';
  var entryAuthor = entry.author;
  var entryPubDate = '';
  if(entry.pubdate && entry.pubdate > 0) {
    entryPubDate = rendering.app.dates.formatDate(new Date(entry.pubdate));
  }

  var entryLink = rendering.app.strings.escapeHTMLHREF(entry.link);

  var htmlTitleShort = 
    rendering.app.strings.truncate(rendering.app.strings.escapeHTML(entryTitle),180);
  var attrTitle = rendering.app.strings.escapeHTMLAttribute(entryTitle);

  var favIconURL = rendering.app.favIcon.getURL(entry.baseURI);

  var htmlFeedTitleShort = rendering.app.strings.escapeHTML(rendering.app.strings.truncate(feedTitle, 40))

  var entryAuthorShort = (entryAuthor ? ' by ' + 
    rendering.app.strings.escapeHTML(
      rendering.app.strings.truncate(entry.author,40)):'');

  var template = [
    '<a href="',entryLink,'" class="entry-title" target="_blank" title="',attrTitle,'">',
    htmlTitleShort,'</a><span class="entry-content">', entryContent,'</span>',
    '<span class="entrysource">','<span title="', attrTitle,'">',
    '<img src="',favIconURL,'" width="16" height="16" style="max-width:19px;margin-right:3px;">',
    htmlFeedTitleShort,'</span>',entryAuthorShort,' on ',entryPubDate,'</span>'
  ];

  var elem = document.createElement('div');
  elem.setAttribute('entry', entry.id);
  elem.setAttribute('feed', entry.feed);
  elem.setAttribute('class','entry');
  elem.innerHTML = template.join('');
  elem.addEventListener('click', reading.onClick);


  var divEntries = document.getElementById('entries');
  divEntries.appendChild(elem);
};