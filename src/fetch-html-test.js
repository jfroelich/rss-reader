
function test(url_str) {
  const req_url = new URL(url_str);
  const callback = function(event) {
    console.dir(event);
  }
  fetch_html(req_url, console, callback);
}
