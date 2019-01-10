
## db.open notes
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

Misc notes from old idb-model.txt:
* when archiving entries, if an invalid entry is encountered, what should be
done? currently this just logs a warning. instead, should it abort the
transaction? reject and return?
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


* move these notes to their respective modules, this is out of date
open_feed_db todos
* write tests
* rather than default to config, maybe I should just export the on_upgrade_needed handler too? The only alternate user other than the normal app usage is the test context, and the test context is privy too using indexeddb_open, it just cannot use the upgrade handler here, for now, because it is module-private.
* what if I grouped the 3 props for active in the schema. So change the feed schema to have a sub-object, active-props, with 3 properties: active, reason, date. Then I could things like feed.active_props.date = new Date(), if(feed.active_props.active)...
* for all the migration  helpers, use cursor rather than getAll for scalability

* Rename feed.dateUpdated and entry.dateUpdated to updatedDate for better consistency.
* Use snake_case instead of camelCase

* Reinvent entry-store as document-store or article store, I think what I want to be doing is re-imagining entry store as a document store. Then look at how a traditional document store works, and mimic that caching behavior. I believe it is generally done with an expiresDate field of some sort, one that is defined when creating the document, or updating it, and is optional. Then archiving becomes simply a matter of finding all entries with an expireDate older than the current date. This type of change correlates with the goal of removing the feed id foreign key from the entry store and linking feeds and entries by feed url instead.

* This is a crazy idea and possible stupid. Denormalize feed storage by storing feed data redundantly per entry. This is merely an idea for consideration. Remove the feed store. Store feed data in the entry store. Repeat feed data per entry. Create indices on feed properties in the entry store to get things like list of unique feeds. Rethink how to do queries like get all feeds, how to archive, etc

* Checking for aborted transactions in indexedDB. According to Mr. Bell, in a comment I just saw on stackoverflow, some errors do not cause a transactional error, but instead cause the transaction to abort. Such as out of disk space. Therefore, for all transactions wrapped in promises, those promises need to reject onabort. Side question then, is what happens when rejecting a an already rejected promise? A settled promise is not affected by additional calls to reject/resolved. There is no harm in doing so outside of possible reader confusion.


* i should have used numbers for dates. allocating tons of date objects is actually
probably pretty bad perf. this alloc happens eagerly, not lazily, at the time of retrieval, so the only way around it is to not even use objects.

* object versions brainstorming idea. each object stores a version property, similar to a serialization key. if the object's schema changes, then i should take care to use a different version property. version can be monotonic (e.g. 1, 2, 3, ...) or more like hash, gotta decide. this will allow me to do more checks regarding object validity. or maybe this is all a horrible idea. just something to think about.

## About the MAGIC constants

// This module provides type help. Objects stored in indexedDB undergo a clone
// operation that strips function objects of type, making it impossible to use
// instanceof to reliably verify an object's type after it has been loaded. As a
// workaround, objects stored in the database are each assigned an extra magic
// property that encodes type information within the object. Then, instead of
// using instanceof, users can test for the presence of this psuedo-hidden
// property and its value to provide a weak type guarantee. This is particularly
// useful when using in combination with assertions to validate against the
// parameters to functions that work with data objects, or to ensure that data
// stored in the database, once read, was properly stored. Basically this is
// hacky type safety.

// Cost-benefit analysis: The cost is the added storage space of having an extra
// property for each object. The benefit is a form of type safety that allows
// for assertion based programming. I made the design decision that the benefit
// outweighs the cost.

// The values here are meaningless. The only significance of these values is
// that each value should be different. These values are extremely unlikely to
// change. Changing any one value will require a tedious database version
// migration script, and an increase in the database version.

// The test against the truthiness of value before the others is the fast check
// against null, because typeof null is 'object'.


# archive-entries

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

# get-feed

* the generic get-feed (by id, by url, key only or not) style of function might
be bad design. the thing is, parameters should indicate variable behavior or
variable data. most of the time the caller is never varying its behavior, only
its data. what i should be doing instead is creating individual wrapper functions
specific to each use case, have the callers call the wrapper functions, and then
have the wrapper functions call some shared internal helper function that implements
all of them. this way the caller expresses their criteria by calling the proper
function instead of trying to reuse one fnuction for all the use cases. it is
almost an anti-pattern i have noticed, because i have to name some params over and
over, and the code becomes less self-expressive in what it does because the function
name is so generic
** more specifically do the following actions:
** create function get_feed_id_by_url (mode url, key only true)
** create function get_feed_by_id (mode id, key only false)
** create function get_feed_by_url (mode url, key only false)
** do NOT create function get_feed_id_by_id, because this is dumb
** revisit the same logic for entries
** consider not even using a shared helper

# get-feeds
* consider using title sort key in database instead of sorting in memory
* for getFeeds consider using a title-sort-key field and an index on this property
instead of sorting in memory, kind of wonky because it requires a database upgrade
and changes to how options page shows feeds

# mark-entry-read
* the on-load checks of object validity are weird. Why not just use basic assert and treat as errors? I don't remember how the code got into this state. I am bit concerned if I change these back to throwing error instead of just logging error and exiting, it will break stuff.
* refactor as set-entry-read-state, accept a boolean state parameter, and handle both cases (where true and where false)? Alternatively, create db-write-entry-property, have this decorate that. Alternatively, have the caller just call db-write-entry-property directly.
* create a write-entry-property module, then use that instead of this. In the interim, can consider refactoring this to basically wrap a call to it, maybe even keep the channel message type the same. Then slowly migrate all callers to call write-entry-property directly. This will potentially reduce the number of operations related to entries, and is more forward thinking in case new operations are added later (e.g. star/unstar-entry).

# About query-entries
Asynchronously query the database for entries corresponding to the criteria and respond with an array of matching entry objects.

### Why does this module exist?
I need an easy way to load various entries into the reader-page view in a higher layer. The get-entries db call is too simple (and should maybe even be deprecated).

In addition, I want to abstract away the complexities of the indexedDB API. I want to encapsulate how the data is actually stored so that it becomes easy (as in short and not requiring much brain power) to write the code that does the query.

### Params
|query| is an optional parameter that constrains which entries are loaded from the database and included in the output.

### Query properties
* feed_id - 0 or undefined for entries belonging to any feed, or the id of a feed. optional, the default is undefined
* direction - 'ASC' or undefined for ascending order, or 'DESC' for descending order. optional, the default is undefined. all results are always sorted by datePublished.
* offset - a positive integer specifying how many objects to skip over in the result set. using an offset greater than the actual number of results is not an error. optional, defaults to 0.
* limit - optional maximum number of objects to return. if limit is undefined or 0 then the result is unlimited. defaults to 0. note that using an offset together with a limit does not reduce the result number necessarily, it just means that a limit starts counting from the offset. For example, if you have 10 potential results, and limit of 5, and offset of 2, this means 5 results returned, not 3.
* read_state - optional, defaults to undefined, undefined for any state, or read or unread only state

### Return value
Returns an array of matching entries. This still returns an array even when no entries are found so the result is always defined.

### Errors
* DOMException when there is an indexedDB-related error like an object store not existing, or calling this on a closed connection
* TypeError when there is an invalid parameter to the function call, such as a missing value that is required, or using the wrong data type

### Misc design notes
* the primary goal is simplification. i want to take away from the complexity of reading objects from storage.
* this tries to be a pure function so it goes out of its way to not modify input parameters, so you can do something like reuse the query object across subsequent calls without worry that it was secretly modified by any one call
* i do not love the giant set of nested ifs in the build_request function body, it feels very inelegant and brute-force, but i have not thought of a better way
* i decided to default sort by datePublished in all cases, instead of being more flexible about which property to sort by, because basically i do not currently have use cases for other sort orders, and not needing to be concerned about those other cases makes the implementation simpler to write and simpler to use
* i tried to use `IDBObjectStore.prototype.getAll` at first, because of its better performance, but gave up, because it cannot handle offset elegantly, which i think is a required feature. it also made it slightly awkward to need to internally redefine limit as offset+limit instead of just limit, to align with the meaning of the count parameter to getAll. the biggest cost comes from deserializing entry objects, some of which have gigantic entry.content property values, so the less objects loaded the better. so i think cursor here is better, despite involving more round trips. i am still kind of wrestling with this approach.
* i decided to use an aggregated query object parameter instead of individual function parameters. this is largely an exercise in that design approach. i am judging whether i like it or not. i am undecided on which is the better approach. note that i still chose to keep session as a separate parameter because in the domain, in the realm of concepts, it is a separate concept. so it is not a general 'params object' exactly, just close to it.
* there is no elegant way to cancel this operation once it has started in the implementation as currently designed
* this function is the main reason there are so many indices on the entries object store. this function is supposed to be fast. however, i still do not love how much duplication there is as a result in the database. these are really gigantic indices with tons of redundancy. this is something i would still like to refine eventually.
* the shared cursor_state object is partly a trick that allows me to still use shared primitives when not using closure scope variable access. i like no function nesting. so i cannot use closure scope that well. but as a result i have to bind in the values of variables from previous invocations to use them with the current one. but that does not work for primitives like numbers, because the number is copied into the current call and incrementing it will not affect future calls. but if instead put the primitive within the context of an object, then an object can be shared because it is not copied it is instead referenced across calls. in the object property context, incrementing the object property value affects the value consistently across all calls. and then there is the incidental benefit of parameter aggregation again, because having more than 3-4 params starts making the function hard to call.

### Todos
* the caller should not need to use entry_utils entry read state constants to specify query property values. Instead this would be a good place to introduce an abstraction away from the raw values. So the caller should do something like just specify string constants like 'read' or 'unread'. Then there is no longer a coupling to entry_utils in the calling context, and there is no need to remember the details of how read state is actually stored in the database. It will also make the function's signature more readable. It will also be more consistent with how I abstracted direction.
* having build_request accept both query and direction is awkward given that direction is a property of query. this is just sloppy. either i translate the whole query up front, or i defer direction translation until within build request. direction should ultimately not be a parameter to build request unless query is no longer a parameter
