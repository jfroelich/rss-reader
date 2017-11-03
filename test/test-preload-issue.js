
async function testPreloadIssue() {
  const options = {};
  options.credentials = 'omit';
  options.method = 'get';
  options.headers = {'Accept': 'text/html'};
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';
  options.referrerPolicy = 'no-referrer';

  const url = 'https://www.yahoo.com';
  const response = await fetch(url, options);
  assert(response.ok);
  const text = await response.text();
  console.log('Text:', {'text': text});
  return 'Test completed, request may be pending';
}

function testOptions() {
  fetch('https://www.yahoo.com', {
    method: 'options', mode: 'cors'
  }).catch(console.warn);
}
