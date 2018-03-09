
Provides basic utility functions for using the fetch API.

The primary benefit of using this library instead of directly interacting with fetch is that it provides the ability to timeout. Somehow the designers of the fetch overlooked this extremely important feature. I've read some of the discussions on how to correct this feature and it is just 'not good'. That is a PC way of putting it. Somehow the designers deemed this feature unimportant. I really do not get it. So, to circumvent this design flaw, this uses a technique of racing a timed promise against the fetch promise and throwing an error in the event that the timed promise wins the race.

In addition to that problem, there is still the problem of aborting/canceling the fetch. There is no way to do this. Yet another waste of resources. I read about some talk of cancelable promises but it looks like that went nowhere.

Notably, several of the functions just provide the response and do not go the full distance of parsing the body into an appropriate format. For example, the fetch_html function does not produce an html document. This is because there is sometimes logic that needs to occur between the time of learning of the response details and parsing the body. Forcing the parsing to occur immediately along with the fetch would be a waste because sometimes the logic that follows the fetch indicates the response should be discarded.

### todos

* Just deprecate fetch_html and such, use a 'accepted mime types' parameter to a generic function
* Instead of throwing assertion error on invalid mime type, return the bad status code
* similarly instead of throwing assertion error on !response.ok, return the bad status code
* once above two are done, then no need for try/catch per call

### `url_is_allowed` notes

fetch policy really does kind of belong in its own file

// TODO: allow various overrides through localStorage setting or some config
// setting?

// Of course things like hosts file can be manipulated to whatever. This is
// just one of the low-hanging fruits. Prevent fetches to local host urls.
// When checking against localhost values, again, ignores things like punycode, IPv6, host manipulation, local dns
// manipulation, etc. This is just a simple and typical case

// When checking for username/pass, Prevent fetches of urls containing credentials. Although fetch implicitly
// throws in this case, I prefer to explicit. Also, this is a public function
// is use by other modules that may not call fetch (e.g. see
// fetchImageElement) where I want the same policy to apply.
