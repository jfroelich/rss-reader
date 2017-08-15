
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

# Improve entity handling

I am occassionally seeing an error like the following in the console:

Error: This page contains the following errors:error on line 803 at column 54:
Entity 'mdash' not defined
at parse_xml (parse-feed.js:19)
at parse_feed (parse-feed.js:10)
at parse_fetched_feed (parse-fetched-feed.js:9)
at poll_feed (poll.js:219)

It may be because I am allowing for the html mime type for xml, then trying to
parse the html as xml, and this is the cause of the error. If that is the case
I suppose I could try a few alternatives. I could parse feeds as html. I could
disallow the html mime type. I could switch between parsing as html or xml
depending on the server's response type.

Or, I could preprocess the text and try to fix entities. For example, see https://stackoverflow.com/questions/5972143 . The second answer provides that
"HTML entity names are not valid in XML without defining them with <!ENTITY name ...> as you pointed out. But numeric entities will do the trick." This means I could run
through all the named entities and convert them into numeric entities.
