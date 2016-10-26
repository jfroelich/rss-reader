// See license.md

'use strict';

async function test(url_str) {
  const url = new URL(url_str);
  try {
    let result = await fetch_xml(url, console);
    console.dir(result);
  } catch(error) {
    console.debug(error);
  }
}
