Write me

### TODOs
* Move these to github issues
* Reconsider the transaction lifetime. Right now it is protected by the
error that occurs due to violation of uniqueness constraint. But it would be
better if both reads and writes occurred on same transaction. Also because I
have mixed feelings about treating already-subscribed as an error. It isn't a
programming error. But the subscribe in some sense failed.
* Currently the redirect url is not validated as to whether it is a
fetchable url according to the app's fetch policy. It is just assumed. I am
not quite sure what to do about it at the moment. Maybe I could create a
second policy that controls what urls are allowed by the app to be stored in
the database? Or maybe I should just call `url_is_allowed` here explicitly?
This is partly a caveat of attempting to abstract it away behind the call to
the fetch helper, which checks the policy internally. The issue is that it
cannot be abstracted away if I need to use it again for non-fetch purposes.
So really it is just the wrong abstraction.
