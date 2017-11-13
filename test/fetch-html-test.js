
async function test(url, timeout) {
  const result = await fetchHTML(url, timeout);
  console.log(result);
}
