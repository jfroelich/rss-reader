'use strict';

async function test() {
  console.debug('Starting FeedFavicon.refresh test');

  const ff = new FeedFavicon();
  ff.verbose = true;
  ff.fs.log = console;
  ff.fs.cache.log = console;

  try {
    let result = await ff.refresh();
  } catch(error) {
    console.warn(error);
  }

  console.debug('Test completed');
}
