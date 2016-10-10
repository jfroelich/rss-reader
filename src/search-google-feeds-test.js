// See license.md

function search(query) {
  const verbose = true;
  const callback = function(event) {
    console.dir(event);
  };

  searchGoogleFeeds(query, verbose, callback);
}
