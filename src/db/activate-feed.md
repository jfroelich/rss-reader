## Todos
* make channel non-optional again? require a stub?
* having separate modules for activate-feed and deactivate-feed might be kind of stupid considering how much code they share. they are almost completely equivalent but for a boolean variable. i could easily design a function like `set-feed-active-state(session, id, active_state)`. This would merge both modules into one, and not greatly complicate the code.
* side note, if i do that, i should probably apply similar treatment to other methods. for example i should change mark-entry-read to set-entry-read-state
* now that i think about it even more, i might have really been onto something with the now deprecated functions update-feed-property and update-entry-property. all these other functions are just specializations of calls to these more generic functions.
* this is particularly important because i plan to add more functionality, like the ability to star or unstar an entry. which is going to lead to a growth of modules.
* i think keeping the number of modules small is important.
* note this also makes me wnt to revisit update-feed and update-entry. i noticed that there are no clients of update-entry currently, so it feels dumb. just how different, for example, is update-entry from update-entry-property? similarly, what about cases where i might want to update multiple properties?
* i think it turns on what are the current clients of update feed. list them here.

- deactivate feed - load feed by id, change property, save
- activate feed (more or less) - load feed by id, change property, save
- poll feeds - after fetching new feed and changing several properties - does not load feed by id first
- poll feeds - after failing to fetch a feed - does not load feed by id first

so what about something like:

update_feed(session, feed, overwrite)

if overwrite is true, the new feed object overwrites whatever existed
if overwrite is false, the old feed is loaded, any key present in new feed is compared to the old feed and used to adjust or remoev a property in the old feed, and then the feed is written back to the database.

this is all ironic because that is basically what i did early, i just had implemented a transition parameter. this way the caller could specify its own transition logic. so... i think my entire mistake was this transition parameter. i should just encode all property knowledge within update feed itself

the other part of the mistake was to apply type assertion to the feed parameter to update_feed. it should not be expected to be a full valid feed object unless the overwrite parameter is true. that was the mistake, applying the assert to both cases (when transition param is present or not). It should only be applied in the case it is not present. this is what threw me off track. i should include a comment about this in the future implementation.

So, I think I have a clear picture of what update_feed should look like.

I should redesign update-feed, deprecate activate-feed, deprecate deactivate-feed, update all current callers of activate-feed to use update-feed, update all current callers of deactivate-feed to use update-feed, and update all current callers of update-feed to pass in overwrite=true.

a few other issues then:
* what about 'reason' information
* what about state validation, e.g. what does it mean to activate an already active feed? should it just be a noop?
