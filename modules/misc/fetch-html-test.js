
'use strict';

async function test(url) {
  const urlo = new URL(url);
  let result = await fetch_html(urlo, console);
  console.log(result);
}
