// See license.md

'use strict';

async function test(url_str) {
  const url = new URL(url_str);
  const ex_ents = false;
  try {
    let fetch_result = await fetch_feed(url, ex_ents, console);
    console.dir(fetch_result);
  } catch(error) {
    console.debug(error);
  }
}
