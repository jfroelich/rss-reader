'use strict';

async function test() {
  console.debug('Starting test');
  try {
    let result = await refresh_feed_icons(console);
  } catch(error) {
    console.debug(error);
  }

  console.debug('Test completed');
}
