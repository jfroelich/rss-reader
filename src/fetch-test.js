// See license.md

'use strict';

async function jrTestFetchFeed(url, timeout) {
  const result = await fetchFeed(url, timeout);
  console.log(result);
}

async function jrTestFetchHTML(url, timeout) {
  const result = await jrFetchHTML(url, timeout);
  console.log(result);
}
