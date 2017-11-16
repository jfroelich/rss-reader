// global configuration module

// NOTE: I am not entirely in love with this approach. What I am trying to do however is separate
// configuration from code, so that I do not have to modify the code to change the configuration.
// One thing to look into is whether I can define such things in manifest.json. Another idea
// would be to load information from localStorage.

// I am defining a config object because Chrome is whining about exporting an array, and I have
// no idea why. I am doing the same thing I do in other modules but this particular one does
// not work.

function Config() {
  this.INACCESSIBLE_CONTENT_DESCRIPTORS;
}

const config = new Config();

// An array of descriptors. Each descriptor represents a test against a url hostname, that if
// matched, indicates the content is not accessible. The reason indicates why.
// TODO: should not have to enumerable subdomains, compare top domains, use the function
// getUpperDomain from url.js (currently not exported). Or use regexs
const INACCESSIBLE_CONTENT_DESCRIPTORS = [
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

config.INACCESSIBLE_CONTENT_DESCRIPTORS = INACCESSIBLE_CONTENT_DESCRIPTORS;
export default config;
