Connects to the model. Instantiates and returns a wrapper class that serves
as a data access layer for reading from and writing to app persistent storage

@param is_channeled {Boolean} optional, if true then this establishes a
connection to the app's broadcast channel that will potentially be used by
methods that modify database state. Generally, use true when reading and
writing, and use false when only reading.
@param name {String} optional, database name
@param version {Number} optional, database version
@param timeout {Number} optional, ms before considering opening attempt a
failure
@throws {DOMException} some kind of database error, failed to connect,
failed to apply upgrades to new version, etc.
@throws {Error} invalid arguments
@throws {Error} failed to create channel
@return {Promise} resolves to a ModelAccess object


Misc old notes from db.txt:
* export opml and import opml are model helper modules
* convert all field names to snake_case
* consider renaming entry.feed to entry.feed_id, or, alternatively, group together
feed id and feed title into a sub object, e.g. entry.feed.id and entry.feed.title



Misc notes from old idb-model.txt:
* when archiving entries, if an invalid entry is encountered, what should be
done? currently this just logs a warning. instead, should it abort the
transaction? reject and return?
* now that create_entry is within this layer and we have an extra layer on top
of it, and we no longer care about channel message type, it might make sense to
reuse create and update code
* add_magic_to_feeds should use cursor over getAll for scalability
* should probably implement a generic update_object function that takes a
store name parameter, and change update_entry and update_feed to both use it,
because the logic between the two is pretty much the same? would need to move
the validation of loaded object check to within transition functions

note from update_feed changes:
TODO: experimeting with idea of partial vs full overwrite. the thing is that
this is violates DRY. Really what I want to do is have two helper functions
that just share a transaction, one that finds a feed and one that updates.
Then there is no need for the is_prior_state_valid function parameter because
the caller would no longer need to inject intermediate logic because the
caller would simply call the two functions separately. But the problem is
that I cannot easily do this using promises, so I could not just have two
awaited calls, because there would be a timeout on the first await of the
find. Note that on the other hand, I could have callbacks, but then I lose
all the benefits of async/await.


old notes:

---------------------------------------------------------------------

Notes from update-feed-properties, brainstorming

* Merge with update-feed. In one case we are loading, modifying a few props,
then saving. in second case we are overwriting completed. So basically this
function should not stand alone, there should be one use-case presented externally
in the API surface, called update-feed, that can do either partial or full update
* Moreover, this should no longer be doing all the special uses cases, like
activate, deactivate. those should be functions in the higher layer, that call
to this function. One issue is how do I effectively tell it to delete props?
* could tell it to delete props by setting property to undefined. so assuming
partial flag is true, then i scan props. for each prop, i update it. if prop key
is present in feed object but prop val is undefined, i delete prop instead of
set to undefined
* i skip over some props, like i skip over hidden magic property, i skip over
id. i skip magic because it should always be retained. i skip id because there
is no point to updating id with same value.
* if doing overwrite, maybe i should validate magic is set
* in both overwrite and partial, assert feed.id is valid id

* for params I would basically have:
** conn
** channel
** feed - the feed object to store, which could either be the full feed object,
or object with keys representing only those keys to modify, where other keys
are retained
** overwrite - boolean, if true then feed is replaced entirely with the input
object as is, if false then load existing props and only update explicit properties

* update feed would no longer do any special property transitions, it just sets
things as is, that means first i need to impl functions in higher layer, like
activate-feed, that set the correct props and then call the right function

A giant problem with this approach is in the case of iterating over several feeds
and updating each one of them, is that I've already done the feed loading. If I
call a non-overwrite update, that would have to load feeds AGAIN. That would be
terrible performance and why this doesn't work. I think it would be better to
just have higher layer functions that do the various updates. things like
activate-feed, mark-entry-read, etc.

I think what I should do, at least, is first re-implement functions like
activate-feed, deactivate-feed, etc. Those functions should rely on dal functions,
so I am not quite sure if they are dal functions themselves or in a higher level.
Then I should also deprecate update-feed-properties and update-entry-properties,
and revisit this issue.
Question: is it incorrect for dals to rely on other dals?
Answer: no, components in the same layer can rely on each other
Question: does activate feed belong in dal layer, or above it?
Answer: no idea. need to list pros and cons
Separate problem. In poll-feed I auto-deactivate. This is redundant with
deactivate feed because that loads feed info from db, but in poll-feed case
the feed is already in memory. I want reuse here but not sure how, maybe something
like above, where it knows whether to load from db or not.
But even that isn't quite perfect, because in poll-feed use case, i am updating
for other reasons too (updating error count).
---------------------------------------------------------------------------
* brainstorming idea, create first-class transactional object, pass around transactions to operations
functions instead of connections and instead of creating transaction within function
have the transaction external. This will allow me to use one transaction for operations
that involve several other operations composed together, like subscribe, instead of
using several transactions for these operations

* in delete_feed, should consider removing feed index, no need for speed here. what else uses it?
* for get_feed, what if instead I use two different request_onsuccess handlers, one for getKey and one for get. This reduces the branching in the handler. Would it be clearer? More or less performant?



open_feed_db todos
* write tests
* rather than default to config, maybe I should just export the on_upgrade_needed handler too? The only alternate user other than the normal app usage is the test context, and the test context is privy too using indexeddb_open, it just cannot use the upgrade handler here, for now, because it is module-private.
* what if I grouped the 3 props for active in the schema. So change the feed schema to have a sub-object, active-props, with 3 properties: active, reason, date. Then I could things like feed.active_props.date = new Date(), if(feed.active_props.active)...
* for all the migration  helpers, use cursor rather than getAll for scalability

update_feed_properties todos

TODO: differentiating between name/value and extra_props is, in hindsight,
dumb. It would make more sense to have a props object containing all of the
properties to modify. Which of those properties is primary reason for the
update is not important here, what is important is decided by the caller and
only in the caller context, but within the abstraction here, inside, we don't
care.

TODO: consider a stronger level of validation of incoming properties,
possibly using some kind of a schema of known properties. Or make this less
of a concern here, and more of a concern of some external validation.

TODO: if the new value of a property being updated is undefined, this should
delete the key, not just set the value to undefined. This reduces space used
in storage. We are not doing anything like trying to maintain v8 shape. This
provides a convenient mechanism for deleting properties. This is different
than those properties not specified, those are left as is.

TODO: an issue with the contents of the messages sent to the channel, such as
when activating a feed, in that if I only send out the property name, the
message handler does not have enough information from reading the message to
discern whether a feed became active or inactive, and can only tell that
active-state changed. I am not sure if it is needed yet, but I think I need
the handler to be able to more easily discern more about state changes.

TODO: merge with db-write-feed. I am going for rest api. I want to simulate
indexedDB's ability to modify a single property. So write feed will take
a parameter like an array of property key-value pairs to update. The array
will be optional. If no array, then the input feed overwrites. If array, then
only the id of the feed is used, and the existing feed is loaded, the new
properties are set, and then the modified existing feed is saved.
OR, instead of this extra array param, I could have a 'merge-flag' parameter.
If not set or false then existing feed overwritten blindly. If true, then
existing feed is loaded, properties from new feed are taken and replaced in
the existing feed, and then the existing feed is saved. So if the caller
wants to update one property, then they just pass in a feed object with id,
the property that should be changed, and it jsut works.

TODO: what if I have a predicate parameter, like `mutator-function`, that
allows the caller to specify the transition of properties that should occur,
instead of localizing the logic for each of the property changes within the
write function itself. This distributes the logic into each of the calling
contexts. Maybe that makes more sense, albeit more complicated? This would
leave the write function to just care about writing, which I kind of like as
it feels like sep-concerns.

* change how get_feeds sorts title. Originally I had a title index in the database, and loaded the feeds in sorted order. That caused a big problem, because indexedDB does not index missing values, so the result excluded untitled feeds. So now I sort in memory after load. However, I'd still like to think about how to do this more quickly. One idea is that I store a sort-key property per feed in the feed store. I guarantee the property always has a value when storing a feed. Each time the feed is updated, and when the feed is created, the property is derived from title, and it also normalizes the title (e.g. toLowerCase). Then I can create an index on that property, and let indexedDB do the sorting implicitly, and quickly, and more efficiently. At the moment, this isn't urgent. A second component of the the decision is that it would support a for_each approach. Right now I am forced to fully buffer all feeds into an array first in order to sort. If a let the db do the work I could use a callback as each feed is loaded.
* Rename feed.dateUpdated and entry.dateUpdated to updatedDate for better consistency. Also consider using underscore instead of camel case
* Reinvent entry-store as document-store, I think what I want to be doing is re-imagining entry store as a document store. Then look at how a traditional document store works, and mimic that caching behavior. I believe it is generally done with an expiresDate field of some sort, one that is defined when creating the document, or updating it, and is optional. Then archiving becomes simply a matter of finding all entries with an expireDate older than the current date. This type of change correlates with the goal of removing the feed id foreign key from the entry store and linking feeds and entries by feed url instead.

* Denormalize feed storage by storing feed data redundantly per entry. This is merely an idea for consideration. Remove the feed store. Store feed data in the entry store. Repeat feed data per entry. Create indices on feed properties in the entry store to get things like list of unique feeds. Rethink how to do queries like get all feeds, how to archive, etc

* Checking for aborted transactions in indexedDB. According to Joshua Bell, in a comment I just saw on stackoverflow, some errors do not cause a transactional error, but instead cause the transaction to abort. Such as out of disk space. Therefore, for all transactions wrapped in promises, those promises need to reject onabort. Side question then, is what happens when rejecting a an already rejected promise? A settled promise is not affected by additional calls to reject/resolved. There is no harm in doing so outside of possible reader confusion.
