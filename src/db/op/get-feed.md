
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
