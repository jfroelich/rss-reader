// Favicon lib
(function(exports) {
'use strict';

var DEFAULT_FAVICON = 'img/rss_icon_trans.gif';

/**
 * Returns a URL to the favicon for the given URL
 */
exports.getFavIconURL = function(url) {
  return url ? 'http://www.google.com/s2/favicons?domain_url=' +
      encodeURIComponent(url) : DEFAULT_FAVICON;
};

}(this));