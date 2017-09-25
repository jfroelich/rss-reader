async function test_sgf(query) {
  const timeout_ms = 10000;
  let result = await search_google_feeds(query, timeout_ms);
  console.dir(result);
}
