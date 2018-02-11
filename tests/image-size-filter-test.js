import * as FetchUtils from '/src/fetch-utils.js';
import {html_parse} from '/src/html-utils.js';
import setImageSizes from '/src/content-filter/image-size-filter.js';

// TODO: research http://exercism.io/ svg loading issue
// Actually there is now a separate issue. It's not finding any urls. Something
// is up with parsing. Viewing source shows stuff. Actually it might even be in
// fetching it? Yeah, it serves up garbage when I fetch it, completely
// different. Perhaps because of no cookies or some header. So I can't test that
// particular url until I figure out the problem ok the size was getting loaded,
// attribute filter didn't whitelist image sizes

window.test = async function(urlString) {
  const requestURL = new URL(urlString);
  const response = await FetchUtils.fetch_html(requestURL);
  const html = await response.text();
  const document = html_parse(html);
  const responseURL = new URL(response.url);
  await setImageSizes(document, responseURL);
};

window.test2 = async function() {
  const html =
      '<html><body><img src="http://exercism.io/icons/brand-logo.svg"></body></html>';
  const document = html_parse(html);
  await setImageSizes(document);
};
