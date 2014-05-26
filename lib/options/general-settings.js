
var generalSettings = {};

generalSettings.cleanupFileInput = function(input) {
  input.removeEventListener('change', generalSettings.onFileInputChanged);
  document.body.removeChild(input);
};

generalSettings.onFileInputChanged = function(event) {
  
  var elementInput = event.target;
  var fileList = elementInput.files;

  if(!fileList || !fileList.length) {
    // Presumably the user canceled
    generalSettings.cleanupFileInput();
    return;
  }

  // We only deal with the first file.. 
  // We are not (yet?) supporting multi-file upload
  var file = fileList[0];
  if(fileList.length > 1) {
    console.log('WARNING: Importing multiple OPML files is not supported.',
      ' Only one of the files is being imported.');
  }

  console.log('Importing OPML file "%s"', file.name);
  
  var reader = new FileReader();
  reader.onload = function(event) {
    var app = chrome.extension.getBackgroundPage();
    try {
      var feeds = app.opml.parseOPMLString(event.target.result);
    } catch(e) {
      // TODO: show an error message
      console.log(e);
      return;
    }

    // Now merge the feeds into the feed store
    // Then notify that the operation completed
    app.opml.import(feeds, function(feedsImported, totalFeeds, elapsed) {
      console.log('Imported %s of %s feeds in %s seconds', feedsImported, totalFeeds, elapsed);
    });
  };

  reader.readAsText(file);
  // Clean up after ourselves
  elementInput.removeEventListener('change', generalSettings.onFileInputChanged);
  document.body.removeChild(elementInput);
};

generalSettings.onFeedsImportedMessage = function(feedsImported, totalFeedsAttempted, elapsed) {

  console.log('Import complete! Imported %s of %s feeds in %s seconds.', feedsImported, totalFeedsAttempted, elapsed);

  // TODO: notify the user
  // Use a notification if enabled
};



generalSettings.onImportOPMLClick = function(event) {
  
  var inputFileUpload = document.createElement('input');
  inputFileUpload.setAttribute('type', 'file');
  inputFileUpload.style.display='none';
  inputFileUpload.onchange = generalSettings.onFileInputChanged;
  document.body.appendChild(inputFileUpload);
  inputFileUpload.click();  

};


generalSettings.onExportOPMLClick = function(event) {
  var app = chrome.extension.getBackgroundPage();
  var feeds = [];
  var onSelectFeedsComplete = function() {
    var xmlDocument = app.opml.createXMLDocument(feeds);
    var xmlString = new XMLSerializer().serializeToString(xmlDocument);
    var blob = new Blob([xmlString], {type:'application/xml'});
    var anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.setAttribute('download', 'subscriptions.xml');
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    URL.revokeObjectURL(blob);
    document.body.removeChild(anchor);
  };

  var onSelectFeed = function(feed) {
    feeds.push({
      title: feed.title,
      description: feed.description,
      link: feed.link,
      url: feed.url
    });  
  };

  app.model.connect(function(db) {
    app.model.forEachFeed(db, onSelectFeed, onSelectFeedsComplete);
  });
};



generalSettings.onEnableContentFiltersChange = function(event) {
  var navContentFilters = document.getElementById('mi-content-filters');
  if(event.target.checked) {
    localStorage.ENABLE_CONTENT_FILTERS = '1';
    navContentFilters.style.display = 'block';
  } else {
    delete localStorage.ENABLE_CONTENT_FILTERS;
    navContentFilters.style.display = 'none';
  }
};

generalSettings.onEnableURLRewritingChange = function(event) {
  var navURLRewriting = document.getElementById('mi-rewriting');
  if(event.target.checked) {
    localStorage.URL_REWRITING_ENABLED = '1';
    navURLRewriting.style.display = 'block';
  } else {
    delete localStorage.URL_REWRITING_ENABLED;
    navURLRewriting.style.display = 'none';
  }
};

generalSettings.init = function(event) {
  document.removeEventListener('DOMContentLoaded', generalSettings.init);
  
  var enableContentFilters = document.getElementById('enable-content-filters');
  enableContentFilters.checked = localStorage.ENABLE_CONTENT_FILTERS ? true : false;
  enableContentFilters.onchange = generalSettings.onEnableContentFiltersChange;

  var enableURLRewriting = document.getElementById('rewriting-enable');
  enableURLRewriting.checked = localStorage.URL_REWRITING_ENABLED ? true : false;
  enableURLRewriting.onchange = generalSettings.onEnableURLRewritingChange;

  var buttonExportOPML = document.getElementById('button-export-opml');
  buttonExportOPML.onclick = generalSettings.onExportOPMLClick;
  
  var buttonImportOPML = document.getElementById('button-import-opml');
  buttonImportOPML.onclick = generalSettings.onImportOPMLClick;
};


document.addEventListener('DOMContentLoaded', generalSettings.init);