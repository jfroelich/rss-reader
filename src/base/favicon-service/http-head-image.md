# http_head_image
Asynchronously send an HTTP request for an image specifying the *head* method.

## Params
This accepts the same kind of options object as native `fetch`, but it also supports an extra option, `timeout`, indicating the maximum time in milliseconds that the fetch can take before throwing a `TimeoutError`.

The url parameter must be of type `URL`, not a string. Using the URL type ensures the url is syntactically correct because it is not possible to create a URL object containing an invalid url. This also ensures the url is canonical so as to prevent fetching local resources implicitly.

## Return value
Returns a `Response` object.

## Errors
* **AssertionError** for invalid parameters or options, such as not using head method, wrong type of parameter
* **OfflineError** if the call was attempted while navigate.onLine is false
* **TypeError** native errors thrown by native fetch call for reasons such as bad params or some opaque network error
* **TimeoutError** when the native fetch call took too long to complete
* **FetchError** for not-ok status codes (e.g. 500, 404)
* **AcceptError** for unacceptable response mime type (if Content-Type header present in response headers)

## Implementation notes
* This uses explicit fetch options because browsers have a tendency to switch out defaults from under us so it is not wise to use implied defaults when calling fetch. Prefer privacy. Prefer being explicit so that behavior does not vary in a surprising way when the browser upgrades and changes its defaults.
* This copies the input options into a local variable because I want to be careful to not modify the input parameter. As a general programming convention, functions should strive for purity. One of the primary purity concerns is that input variables are not modified unexpectedly. This uses `Object.assign`s builtin behavior of overriding the second argument's properties with the third argument's properties so that express user-supplied options overwrite the default options.
* Shoving timeout into options seems like a nice way of providing a signature that is similar to the native fetch function, so it is easy to remember how to call this function without having to reference this documentation. It is also easily extendable if I plan to provide options in the future. However, this then takes the extra step of ensuring that the timeout option is not forwarded to the native fetch call in case native fetch throws when using non-standard options. I do not really know if it will throw (actually would be easy to check) but I think it is better to be safe than sorry.
* The method is enforced to be HEAD. This function is only supposed to be sending a head request. Double check input options contains the head method because the caller could have tried to override it. I prefer this as an error instead of just setting method here to avoid surprise. Note that I am not sure I love this restriction and am thinking about redesigning the function to be http method agnostic. I really do not love that this
* This checks if online before calling fetch. Assert the precondition that we are online. Ordinarily the native fetch call would later fail with a generic error. This traps that situation most of the time and singles out the particular error path. Also note that we do not call assert because this is not an invariant condition indicative of a programming error, this is an ephemeral error related to a temporarily unavailable resource.

## Todos
* the handling of timeout in options and assertion against its validity should all occur within the timed_fetch helper function, not external to it
* there is nothing particularly idiosyncratic to this request over a request using any method. This could be easily refactored into a more generic http_fetch_image and work for any method. This moves the choice of method to the caller so it is more flexible and more reusable.
* rather than hardcode image types, maybe it should come from the accept header, and the option is just whether to enforce the accept header. but i also want the convenience in calling context of not having to remember all the image mime types. also i need to allow for octet-stream but i am not sure it is specific enough and do not like it.
* not sure about the precondition asserts regarding navigator and fetch. this is inconsistent with how my other code works, and feels overly paranoid and stupid.
* unit tests
* if i move the fetch calls from the control layer back to the library later there is a good chance that much of this functionality becomes redundant. The debate then is whether the favicon.js module as a whole should remain independent from those modules. Right now it is independent but I am unsure if it is worth the duplication. This module is severely identical. There is the related concern that perhaps this module itself should be independent of the favicon module given how reusable it is.
* I need to think more about the design pattern of attaching conditions to fetch. I feel like what i want is a series or chain of function calls where each function is a wrapper that attaches functionality, for example `fetch_with_image_type_check(fetch_with_timeout(native_fetch))`. I am not sure if this is the correct approach and want to think about it more. Maybe I want some hooking mechanism. Maybe each wrapper function should take as a parameter the fetch function that it wraps. Maybe this is a routine design obstacle that many people have already solved very well and I just need to research how others have approached it. I want to get away from a giant fetch function where it just hardcodes a miscellaneous bunch of extra pre and post conditions.
