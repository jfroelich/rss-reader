import fetchHTML from "/src/fetch/fetch-html.js";

async function test(urlString, timeout) {
  const urlObject = new URL(urlString);
  const result = await fetchHTML(urlObject, timeout);
  console.log(result);
}

window.test = test;
