import * as FetchUtils from "/src/common/fetch-utils.js";
import * as Status from "/src/common/status.js";

async function fetchFeed(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const [status, response] = await FetchUtils.fetchFeed(requestURL, timeoutMs);
  if(status !== Status.OK) {
    console.warn('Fetch error', status);
    return;
  }
  console.dir(response);
  const feedXML = await response.text();
  console.dir(feedXML);
}

window.fetchFeed = fetchFeed;
