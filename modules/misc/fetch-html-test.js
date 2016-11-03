
'use strict';

async function test(url_str) {
  const url = new URL(url_str);
  try {
    let doc = await fetch_html(url, console);
    console.log(doc);
  } catch(error) {
    console.debug(error);
  }
}
