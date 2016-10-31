// See license.md

'use strict';

async function test(url_str) {
  const url = new URL(url_str);
  try {
    let fetch_result = await fetch_feed(url, console);
    console.dir(fetch_result);
  } catch(error) {
    console.debug(error);
  }
}
