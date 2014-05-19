

function discoverSubscribeClick(event) {
  var button = event.target;
  var url = button.value;
  if(!url) {
    console.log('no url in discover subscribe click');
    return;
  }

  // Ignore future clicks while subscription in progress
  var subMonitor = document.getElementById('options_subscription_monitor');
  if(subMonitor && subMonitor.style.display == 'block') {
    console.log('subscription in progress, ignoring subscription button click');
    return;
  }

  startSubscription(url);
}

function onDiscoverFormSubmit(event) {

  // Prevent the form submission that would normally occur
  event.preventDefault();

  var queryElement = document.getElementById('discover-query');
  var query = queryElement.value ? queryElement.value.trim() : '';
  if(!query) {

    // Return false to prevent form submit
    return false;
  }

  // Suppress re-clicks
  if(document.getElementById('discover-in-progress').style.display == 'block') {
    console.log('Cancelling, search already in progress');

    // Return false to prevent form submit
    return false;
  }

  // Show that we are in progress
  document.getElementById('discover-in-progress').style.display='block';

  console.log('Query: %s', query);

  // Perform the query
  app.discoverFeeds(query,onDiscoverFeedsComplete, onDiscoverFeedsError, 5000);
  
  // Return false to prevent form submit
  return false;
}


function onDiscoverFeedsComplete(query, results) {
  console.log('Searching for %s yielded %s results', query, results.length);

  var resultsList = document.getElementById('discover-results-list');
  var noResultsMessage = document.getElementById('discover-no-results');

  document.getElementById('discover-in-progress').style.display='none';

  if(results.length < 1) {
    resultsList.style.display = 'none';
    noResultsMessage.style.display = 'block';
    return;
  }

  if(resultsList.style.display == 'block') {
    resultsList.innerHTML = '';
  } else {
    noResultsMessage.style.display='none';
    resultsList.style.display = 'block';      
  }

  var listItem = document.createElement('li');
  listItem.textContent = 'Found ' + results.length + ' results.';
  resultsList.appendChild(listItem);

  // Now display the results
  app.each(results, function(result){

    var snippet = result.contentSnippet.replace('<br>','');

    var favIconURL = app.getFavIconURL(result.url);

    listItem = document.createElement('li');
    listItem.innerHTML = [
      '<button value="',result.url,'" title="',app.escapeHTMLAttribute(result.url),
      '">Subscribe</button>','<img src="',favIconURL,'" title="',
      app.escapeHTMLAttribute(result.link),'">',
      '<a href="',result.link,'" title="',app.escapeHTMLAttribute(result.link),
      '" target="_blank">',result.title,'</a> ',app.truncate(snippet,400)

    ].join('');

    var button = listItem.querySelector('button');
    button.addEventListener('click',discoverSubscribeClick);

    resultsList.appendChild(listItem);
  });

}

function onDiscoverFeedsError(errorMessage) {
  // Stop showing progress
  document.getElementById('discover-in-progress').style.display='none';
  
  console.log('Search error: %s', errorMessage);
  
  // Report a visual error
  showErrorMessage('An error occurred. Details: ' + errorMessage);
}

function initDiscoverFeedsSection(event) {
  document.removeEventListener('DOMContentLoaded', initDiscoverFeedsSection);
    
  // Initialize the Discover feeds section
  document.getElementById('discover-feeds').addEventListener('submit', onDiscoverFormSubmit);    
}

document.addEventListener('DOMContentLoaded', initDiscoverFeedsSection);