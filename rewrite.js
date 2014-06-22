/**
 * Rewriting lib
 *
 * NOTE: somewhat modeled after apache's mod_rewrite
 */

var reader = reader || {};
reader.rewrite = {};

/**
 * Returns a rewritten url, or the original url if no rewriting rules were applicable.
 *
 * NOTE: I tore apart all the old rewriting code because I decided that its too
 * confusing of a feature for users to configure rewriting rules, and that it was
 * better to just hardcode in some known proxies.
 */
reader.rewrite.rewriteURL = function(url) {
  var reGoogleNews = /^https?:\/\/news.google.com\/news\/url\?.*url=(.*)/i;
  var matches = reGoogleNews.exec(url);
  if(matches && matches.length == 2 && matches[1]) {
    var newURL = decodeURIComponent(matches[1]);
    //console.log('rewrote %s as %s', url, newURL);

    // NOTE: we know it is not empty
    return newURL;
  }

  return url;
};