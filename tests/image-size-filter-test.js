import setImageSizes from "/src/feed-poll/filters/image-size-filter.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";

// TODO: research http://exercism.io/ svg loading issue
// Actually there is now a separate issue. It's not finding any urls. Something is up
// with parsing. Viewing source shows stuff. Actually it might even be in fetching it?
// Yeah, it serves up garbage when I fetch it, completely different. Perhaps because of
// no cookies or some header. So I can't test that particular url until I figure out the
// problem
// ok the size was getting loaded, attribute filter didn't whitelist image sizes

async function test(urlString) {
  let status, response, document;

  const requestURL = new URL(urlString);
  [status, response] = await FetchUtils.fetchHTML(requestURL);
  if(status !== Status.OK) {
    console.warn('Fetch error', status);
    return;
  }

  const html = await response.text();
  [status, document] = parseHTML(html);
  if(status !== Status.OK) {
    console.warn('Parse error', status);
    return;
  }

  const responseURL = new URL(response.url);
  await setImageSizes(document, responseURL);
}

async function test2() {
  const html = '<html><body><img src="http://exercism.io/icons/brand-logo.svg"></body></html>';
  const [status, document] = parseHTML(html);
  await setImageSizes(document);
}

window.test = test;
window.test2 = test2;
