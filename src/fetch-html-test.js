
function test(urlString) {

  const requestURL = new URL(urlString);
  const log = console;
  const callback = function(event) {
    console.dir(event);
  }

  fetchHTML(requestURL, log, callback);
}
