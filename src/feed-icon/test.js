'use strict';

async function test() {

  try {
    let result = await refreshFeedIcons();
  } catch(error) {
    console.warn(error);
  }

  console.debug('Test completed');
}
