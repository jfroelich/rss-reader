// See license.md

'use strict';

async function test(url, timeout = 0) {
  try {
    let {feed, entries} = await fetch_feed(url, timeout, console);
    console.log('Feed:', feed);
    console.log('Entries:', entries);
  } catch(error) {
    console.debug(error);
  }
}
