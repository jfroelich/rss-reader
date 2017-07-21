// See license.md

async function test(query) {
  try {
    const timeout = 10000;
    let result = await searchGoogleFeeds(query, timeout);
    console.dir(result);
  } catch(error) {
    console.debug(error);
  }
}
