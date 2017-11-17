// global configuration module

// NOTE: I am not entirely in love with this approach. What I am trying to do however is separate
// configuration from code, so that I do not have to modify the code to change the configuration.
// One thing to look into is whether I can define such things in manifest.json. Another idea
// would be to load information from localStorage.

// An array of descriptors. Each descriptor represents a test against a url hostname, that if
// matched, indicates the content is not accessible. The reason indicates why.
// TODO: should not have to enumerable subdomains, compare top domains, use the function
// getUpperDomain from url.js (currently not exported). Or use regexs
export const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {hostname: 'www.forbes.com', reason: 'interstitial'},
  {hostname: 'www.forbes.com', reason: 'interstitial'},
  {hostname: 'productforums.google.com', reason: 'script-generated'},
  {hostname: 'groups.google.com', reason: 'script-generated'},
  {hostname: 'www.nytimes.com', reason: 'paywall'},
  {hostname: 'nytimes.com', reason: 'paywall'},
  {hostname: 'myaccount.nytimes.com', reason: 'paywall'},
  {hostname: 'open.blogs.nytimes.com', reason: 'paywall'},
  {hostname: 'www.heraldsun.com.au', reason: 'requires-cookies'},
  {hostname: 'ripe73.ripe.net', reason: 'requires-cookies'}
];
