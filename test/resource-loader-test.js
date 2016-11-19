// See license.md

'use strict';

async function testFetchFeed(url, timeout = 0) {
  const result = await ResourceLoader.fetchFeed(url, timeout);
  console.log(result);
}

async function testFetchHTML(url, timeout = 0) {
  const result = await ResourceLoader.fetchHTML(url, timeout);
  console.log(result);
}
