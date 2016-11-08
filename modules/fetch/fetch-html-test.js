// See license.md

'use strict';

async function test(url, timeout = 0) {
  try {
    const {doc, response_url} = await fetch_html(url, timeout, console);
    console.log('Document:', doc);
    console.log('Response URL:', response_url);
  } catch(error) {
    console.log(error);
  }
}
