// See license.md

function test(query) {
  search_google_feeds(query, console, function(event) {
    console.dir(event);
  });
}
