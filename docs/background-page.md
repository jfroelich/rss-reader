# background-page

## todos
* there is a problem with the db install listener, it gets loaded too later or maybe the timeout is not being followed, hard to tell, but i think something else is doing a database call earlier maybe that imposes a timeout, but as a result, what happens right now is there is an error on startup about how the database failed to open in time. This is even though the upgrade eventually works (because I do not cancel upgradeneeded txn when time out). While it is in a sense harmless, it is just wrong and should be somehow fixed. I think one step would be to inline it again here, and deprecate the db-control thing.
