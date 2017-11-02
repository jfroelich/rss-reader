async function test_sgf(query) {
  const timeoutMs = 10000;
  let result = await googleFeedsAPISearch(query, timeoutMs);
  console.dir(result);
}
