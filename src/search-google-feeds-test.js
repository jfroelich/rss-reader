// See license.md

function test(query) {
  searchGoogleFeeds(query, console, function(event) {
    console.dir(event);
  });
}
