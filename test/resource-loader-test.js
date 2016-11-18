// See license.md

'use strict';

async function testFetchFeed(url, timeout = 0) {
  const loader = new ResourceLoader();
  loader.log = console;

  try {
    let result = await loader.fetchFeed(url, timeout);
    console.log(result);
  } catch(error) {
    console.warn(error);
  }
}

async function testFetchHTML(url, timeout = 0) {
  const loader = new ResourceLoader();
  loader.log = console;

  try {
    let result = await loader.fetchHTML(url, timeout);
    console.log(result);
  } catch(error) {
    console.warn(error);
  }
}
