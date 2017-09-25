
# About

Checks for new content

# TODO

* create a separate module that does the document prep and call it from
poll entry, instead of having all that code (some of which is partly duped and
not DRY) in poll entry

* it was wrong to move db connect into poll, it should be caller's job, and
also this reduces params and changes params so that more params pertain to
poll and less to db connect. this was db connect wraps up its params as a group

* Document functions with comments
* regarding addEntryToDb, deprecate in favor of put, and after moving
sanitization and default props out, maybe make a helper function
* ensure entries added by putEntryInDb, if not have id, have unread flag and
date created

* regarding shouldExcludeEntryBasedOnURL, the individual tests should probably
involve regular expressions so that I do not need to test against url
variations (like leading www.).
* is isValidEntryURL, think of a better way to implement the hack for a bad feed
that includes extra slashes in its url. maybe it does not belong in this
function
* think of a way to allow easier configuration of filter_tracking_imgs instead
of hardcoding the arrays

# NOTES

Polling may report itself as completed in the console, and then additional
fetch messages may appear. This is because I race timeouts against fetches,
and if a timeout wins I consider the request timed out and continue polling,
but there is no native way to abort/cancel the other request. So the other
request still eventually times out or eventually completes successfully, but it
could be any time after. So it is safe to ignore these messages, and there is no
issue with my concurrency. This is simply a flaw in how the people that designed
the new JS fetch api implemented fetch. They failed to provide the ability to
cancel the fetch promise or at least have a timeout parameter. Furthermore, I
cannot fallback to XMLHttpRequest, due to cookies and other issues.

# todo: URL rewriting improvements

Currently this only modifies Google News urls, but I plan to include more

rewrite_url is the public api, but it should be delegating the one rule it applies right now probably to a separate function or something like that, so that it becomes easily extensible.
Or maybe an array of Rule objects or something.
I have to consider the behavior when multiple rules match the input.
I have to consider whether I want to rewrite as a chain, where I sequentially apply any rules.
Maybe even various url normalizations, like removing hash, is just another kind of rule.

# Bug The entries of a norvig.com are getting re-fetched every poll run

Not sure if this bug still manifests. This may have been drive-by fixed when working on a different bug. Need to test again. Yes, the above issue was due to how redirect checking handled urls with hashes. The below bug is entirely different, but relates to the same feed.

GET http://nbviewer.ipython.org/url/norvig.com/ipython/Probability.ipynb always appears in log during poll. The response url is http://nbviewer.jupyter.org/url/norvig.com/ipython/Probability.ipynb .

Here is a breakdown I think of what is happening:

The url from the entry is not in the database, so this does not exit earlier above when checking that.
The entry is fetched
The response url is a redirect
The redirect url is in the database. In this case it was because there was another entry that was stored. Essentially this entry is redirecting to the url of another entry.
As a result the entry is not stored and processing of the entry completes
What needs to happen somehow is that this entry gets stored or somehow
I know not to keep fetching it. But how do I do that given that the other url already exists. I will get a constraint error. Side note this actually partly explains why was witnessing the rare constraint error that should never happen.

Adding to above. **Something must be cached, no matter what**. That is the only way I can check if something exists before fetching it. So how do I store something given the conflicting url. It almost feels like my entire urls scheme is invalid. Maybe I can't have a uniqueness constraint on the index?

Maybe the best way is to somehow insert the new url somewhere earlier in the list of urls of the other entry.

What if I stored an entry that I initialized as already read, and just used the original url without the redirect url.

The entry wouldn't show up as unread
The entry would not violate the uniqueness constraints so it would not fail the call to addEntry
But statistics like 'entries read' would be wrong.

What I really need it some kind of more organized 'resource' object store that properly handles the case when two resources share the same url, but come from different sources, or thereabouts.

I am trying to solve this situation:

Entry 1 has an original url. Store it.
Entry 2 has an original url that is different than entry 1. However, entry 2 redirects to entry 1s url.

I must somehow store entry 2's original url, because I cannot know its redirect url until after fetching, but I do not want to refetch.

I could shove entry 2's url into entry 1, but this feels wrong, for several reasons. One reason is that it would taint entry 1's url chain. If I were to ever do something like re-trace entry 1, it would have urls that don't fall into the chain (e.g. the chain would change from original-rewritten-redirect original1-rewritten2-original2-redirectof1). Original2 has no business being in that chain.

The second aspect I dislike about that approach is that it requires a secondary database round trip that does something funky like load an entry, insert a url into url chain, then stores it again. I am a bit concerned how that interplays with other pending requests on a shared transaction, or races against requests in other concurrent transactions. And I hate the concept of it.

I think I just need an all around more elaborate url scheme that allows for two orginal urls to both point to the same redirect, where I favor which ever resource is encountered first, but I store both originals somehow.

Essentially I have a many to one situation, where the terminal url is one entity which has 0 or more related source urls. But I think I don't love this because I want denormalization and don't see the answer immediately, and because I don't exactly care which url is terminal.

I want something like each article just has an associated unordered collection of urls. So maybe the issue is my attempt at having a chain of source to end. Maybe the order doesn't really matter. It only matters during processing, like when choosing the right base url to resolve relative links, but after that it is irrelevant? When is it ever relevant after that? The view doesn't care, right?

Ok, what if I just had an entirely separate store of unique urls.

i dont need to store rewritten url, it can be recreated as needed
every entry just has one url
if an entry's url is rewritten, i store both urls in the urls list, but now entry only has the rewritten url.
if an entry's url redirects, i store the redirect url in the urls store, but now entry only has the redirected url.
When fetching a feed, I get the urls of entries in the feed. for each one, i rewrite it. i dont bother with its original (maybe i do, maybe to consider rewrite urls that change at diff times after entry storage). then i check if urls list has rewritten. if found then duplicate. then i fetch. i get response url. if found in urls list then (here is the important part) do not store the entry but do store the original url as having already been seen in the urls list (it will not point to a particular entry). if not found then add redirect url also to urls store, and store entry using redirect url only.

then, what to do about unsubscribe. i suppose what i do is store an array of feed ids per url. this way if there can be dups per feed, or across feeds. if i unsub a feed i want to remove urls from the seen list, but only if feeds reference counter is 1 and would reach 0 upon removing the feed.

i could also store an array of entry ids per url if i wanted to support delete entry removing any associated urls that have an entry ref count of 1. then i probably wouldn't need the feed id ref counter?

i could, possibly, also break apart the url, like extract protocol and store it as a separate field, that way url lookups would ignore scheme (which reminds me of the fact that subscribe should be checking for both http and https)

i think it would be simpler than the equivalent of something like storing a nearly-empty entry in the entries store that just points to another entry that it shares a url with
