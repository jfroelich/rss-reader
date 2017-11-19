
import fetchHTML from "/src/fetch-html.js";

async function test(url, timeout) {
  const result = await fetchHTML(url, timeout);
  console.log(result);
}
