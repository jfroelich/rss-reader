
notes copied from archive-entries
* only load archivable entries to improve perf, currently this loads some non-archivable because it ignores date
* archive_entry and compact_entry both have detailed knowledge of feed property structure. maybe it would be better if I set and get properties via functions defined in the model? This feels like a ton of overhead though.
* Revise criteria for entry archival, eventually reconsider how an entry is determined as archivable. Each entry should specify its own lifetime as a property, at the time of creation of update. This should then just be scanning for entries that whose lifetimes have expired. This pattern is more in line with how traditional cached object lifetimes are calculated. Using this alternate approach allows each entry to manage its own lifetime. For example, I could say that for all entries coming from a certain feed, those entries should have a half-life. Entries should basically have an expires property
that can be set at time of entry creation (note I will have to do a database upgrade
where I migrate all entries missing expires property to get one).
* Consider changing the message type produced by archive-entries, Maybe differentiating between the message type 'entry-updated' and 'entry-archived' is pedantic. Instead, I could use entry-updated, and also add a reason-code property to the message that shows why it is was updated, and one of the reasons is just 'archive'. I am having some difficulty stating the cost benefit analysis. I do not have that many message types. It is easy for any handler to deal with both types and use the same code to handle the message. On the other hand, fewer messages types is always a good thing, until it becomes too few to differentiate. I suppose supporting the smallest number of message types is better? This requires some more thought.
* remember, this sends messages after txn commits!

TODO: I cannot use asserts within the cursor handler function, because an
assertion failure leads to throwing an exception, but this exception is
thrown at a later tick of the event loop, and therefore is not translated
into a promise rejection, and therefore leaves the promise in an unsettled
state, where processing has stopped, but the promise has neither resolved
nor rejected. Therefore this entire process probably needs to be revised.
Instead of reusing iterate_entries I probably need to use a plain
promise, and I probably should be directly interacting with indexedDB,
instead of via the model access layer. I think I need to do it here, or I
need to move archive_entries to the model layer itself. Because this is the
only place where the archiving concern is present, so it would not make
sense to have the functionality in two places.

I do not like how the model access layer is thereby becoming monolothic,
the more functionality I shove into it. Unfortunately I do not see an easy
way around it at the moment. The fact that indexedDB transactions auto
timeout and I cannot interleave microtasks makes it a frustrating api to
work with. It is either that or I give up entirely on using a single
transaction. Technically it is ok to use separate transactions? But it
would involve multiple reads of entries which is just pure waste. And it
feels hacky.

I think the best course of action is to move it into the model layer and
use a raw promise.

Side note, this would allow me to remove the 'archive' flag from
iterateEntries, which is an obvious indicator of the anti-pattern because I
am splitting up one concern into multiple locations.

Maybe it is ok because in some sense archiving is a model concern almost
exclusively. Maybe this really does not belong in a higher layer, isolated
by itself as its own module. Maybe what I do want in a higher layer is the
archive-control, which handles running on a schedule, and that is all along
what I was trying to achieve.
