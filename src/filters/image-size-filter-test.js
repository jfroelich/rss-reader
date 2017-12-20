import canonicalizeURLs from "/src/filters/canonical-url-filter.js";
import setImageSizes from "/src/filters/image-size-filter.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import parseHTML from "/src/utils/html/parse.js";

// TODO: research http://exercism.io/ svg loading issue
// Actually there is now a separate issue. It's not finding any urls. Something is up
// with parsing. Viewing source shows stuff. Actually it might even be in fetching it?
// Yeah, it serves up garbage when I fetch it, completely different. Perhaps because of
// no cookies or some header. So I can't test that particular url until I figure out the
// problem
// ok the size was getting loaded, attribute filter didn't whitelist image sizes

async function test(urlString) {
  const urlObject = new URL(urlString);
  const response = await fetchHTML(urlObject);
  const html = await response.text();
  const document = parseHTML(html);
  canonicalizeURLs(document, new URL(response.responseURL));
  await setImageSizes(document);
}

async function test2() {
  const html = '<html><body><img src="http://exercism.io/icons/brand-logo.svg"></body></html>';
  const document = parseHTML(html);
  await setImageSizes(document);
}

window.test = test;
window.test2 = test2;
