async function test_sgf(query) {
  const timeout_ms = 10000;
  let result = await google_feeds_api_search(query, timeout_ms);
  console.dir(result);
}
