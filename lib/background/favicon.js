
var favIcon = {};

favIcon.DEFAULT_URL = '/img/rss_icon_trans.gif';

// Returns a URL to the favicon for the given URL
favIcon.getURL = function(url) {

  // Since I cannot seem get chrome://favicons/ working
  // (because they only appear if the page is open in 
  // another tab), we are using this simple google service
  // which works for now.

  return url ? 
    'http://www.google.com/s2/favicons?domain_url=' +
    encodeURIComponent(url) : this.DEFAULT_URL;
};