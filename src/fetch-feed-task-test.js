'use strict';

function testFetchFeed(urlString) {
  const task = new FetchFeedTask();
  task.start(new URL(urlString), false, function(event) {
    console.dir(event);
  });
}
