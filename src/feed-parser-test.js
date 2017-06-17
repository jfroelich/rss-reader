// See license.md

'use strict';

async function test(url) {
  console.log('Starting test, fetching', url);
  const response = await fetch(url, {
    'credentials': 'omit',
    'method': 'get',
    'mode': 'cors',
    'redirect': 'follow'
  });
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  const text = await response.text();
  const feed = jrFeedParserParseFromString(text);
  console.log(feed);
  console.log('Test completed');
}
