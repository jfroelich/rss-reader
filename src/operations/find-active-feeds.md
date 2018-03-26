
### TODOs

* Interact directly with the database instead of using get_feeds. Generally, operations should not depend on other operations. Furthermore, this ideally should not be doing the array filter in memory.
* Revert to using a cursor and doing a callback per feed instead of using getAll. If using a cursor then it is ok to filter in memory, even though it is not desirable.
