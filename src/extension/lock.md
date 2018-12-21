An extension lock is a lock that is global to an extension. It helps solve the problem that ordinary variables are visible only within the page they are loaded. Actions that affect multiple pages sometimes need to coordinate calls to an action from multiple pages. Locks are only intended to be used once. This is a very hacky solution but it seems to work. This works because localStorage is shared state available to each page of the extension.

## TODO
* Deprecate. one this is too simple and only used in one place. two, this is not really RAII. to properly impl, it should just be a function call similar to debounce that rejects all concurrent calls made while a call is outstanding (while the first call is running). three, this was a fun experiment but in hindsight looks stupid.
* all local storage access should pass through config or something, not direct access. config should be the only module that deals with local storage io. that way, if there is ever a key conflict or any confusion like that, it gets mediated by a single mediator module