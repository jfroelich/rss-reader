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
