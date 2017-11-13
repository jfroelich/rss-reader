
import {fetchHTML} from "/src/fetch.js";

async function test(url, timeout) {
  const result = await fetchHTML(url, timeout);
  console.log(result);
}
