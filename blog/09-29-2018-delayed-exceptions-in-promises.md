This is a placeholder blog entry. I want to convert this private comment I recorded in a source file as a blog entry article at some point. This is an example of a lesson learned about a rather non-obvious characteristic of promises.

// NOTE: so I sort of learned an important lesson about the leaky abstraction
// that is promises. My original understanding was that when an exception is
// thrown inside of a promise, it is translated into a rejection. That
// understanding is incorrect. There is more nuance. In particular, only
// immediately-thrown exceptions are translated automatically into rejections.
// If an error is thrown in a later event loop iteration (e.g. next tick)
// while within the executor of the promise, such as after setTimeout
// resolves, or after an indexedDB request event occurs, then the error is NOT
// transformed into a rejection. It remains an uncaught exception that leaves
// the promise in an unsettled state (the promise never rejects). Therefore,
// all promises that do work that occurs after the current event loop epoch
// has elapsed must use try/catch in non-immediate contexts or somehow avoid
// throwing errors entirely. All code that occurs in a later tick from within
// a promise is untrustworthy.
