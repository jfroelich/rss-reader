// See license.md

'use strict';

async function test(url, timeout) {
  const result = await fetch_html(url, timeout);
  console.log(result);
}
