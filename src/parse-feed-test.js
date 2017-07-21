// See license.md

'use strict';

async function test(url) {
  console.log('Starting test, fetching', url);
  const text = await testFetchFeedText(url);
  const feedObject = parseFeed(text);
  console.dir(feedObject);
  console.log('Test completed');
}

async function testFetchFeedText(url) {
  const response = await fetch(url, {
    'credentials': 'omit',
    'method': 'get',
    'mode': 'cors',
    'redirect': 'follow'
  });
  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }
  const text = await response.text();
  return text;
}
