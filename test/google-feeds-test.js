// See license.md

async function test(query) {
  try {
    const timeout = 10000;
    let result = await GoogleFeeds.search(query, timeout);
    console.dir(result);
  } catch(error) {
    console.debug(error);
  }
}
