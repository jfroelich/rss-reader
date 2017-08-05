
# TODO

* Consider a generic xml2json converter that I then normalize into more of a
plain feed object. It is an extra intermediate data structure, but it uses a
more generic approach. There may even be a library, and there is nothing wrong
with using a library if I could write it myself.

# TODO: Uniformly handle text node content when parsing

There is a strange issue with cdata nodes or something when parsing atom feeds. I don't quite understand it.

This is a bug I have currently fixed with a hackish thing. I'd prefer to find the root cause of the problem. I think it is CDATA related.

I have fixed separate bugs related to attempting to parse feeds served as text/html instead of application/xml. Part of the above bug was a result of this.

Note this isn't actually a bug. The code works. It is just that I have to do strange processing of the content, and I want to understand why, and I would rather approach content handling uniformly

# Misc parse feed notes (copied from old github issue)

the feed object yielded by this should not care about or be related to the
feed object that will be stored. the storage module will worry about that

make standalone, independent of feed and entry objects, require the
caller to deal with converting into whatever format it wants. this should just
do one thing

similarly, it should just return one object, not a feed and array of entries

the thing returned should be some kind of basic parsed-feed-object

support <media:thumbnail url="imgurl" /> (atom)

do not introduce fallback dates, if date is not set then do not use

do not cascade feed date to entry date

add helper for entry enclosure instead of how it is inlined

setup testing

maybe rename, this does not parse from text, it unmarshals from a doc.
** on the other hand, i no longer get a doc when using the fetch api, maybe
** this should accept text as input?

maybe return [feed,entries] so i can use destructuring
** walking children seems to be slower than querySelector, revert to using it,
but think of a way to maintain strictness
** will get a nominal perf benefit, this is not crucial
