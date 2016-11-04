// See license.md

async function test(query) {
  try {
    let result = await search_google_feeds(query, console);
    console.dir(result);
  } catch(error) {
    console.debug(error);
  }
}
