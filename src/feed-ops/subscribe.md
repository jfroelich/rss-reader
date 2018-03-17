
// TODO: reconsider the transaction lifetime. Right now it is protected by the
// error that occurs due to violation of uniqueness constraint. But it would be
// better if both reads and writes occurred on same transaction. Also because I
// have mixed feelings about treating already-subscribed as an error. It isn't a
// programming error. But the subscribe in some sense failed.

// TODO: currently the redirect url is not validated as to whether it is a
// fetchable url according to the app's fetch policy. It is just assumed. I am
// not quite sure what to do about it at the moment. Maybe I could create a
// second policy that controls what urls are allowed by the app to be stored in
// the database? Or maybe I should just call url_is_allowed here explicitly?
// This is partly a caveat of attempting to abstract it away behind the call to
// the fetch helper, which checks the policy internally. The issue is that it
// cannot be abstracted away if I need to use it again for non-fetch purposes.
// So really it is just the wrong abstraction. Move this comment to github

// TODO: rename context properties, deferred for now because it involves
// other modules

// Properties for the context argument:
// feedConn {IDBDatabase} an open conn to feed store
// iconConn {IDBDatabase} an open conn to icon store
// channel {BroadcastChannel} optional, an open channel to which to send feed
// added message
// fetchFeedTimeout {Number} optional, positive integer, how long to wait in ms
// before considering fetch a failure
// notify {Boolean} optional, whether to show a desktop notification
// console {console object} optional, console-like logging destination
