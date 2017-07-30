
# TODO

* insert test data, then run archive, make assertions about the
state of the database, then delete the database
* Observed the following log message:
[Violation] 'success' handler took 164ms (on line 80 which is the success
handler for loadUnarchivedReadEntriesFromDb). What this indicates to me is that
I am loading too many objects from the database, and doing too much work. So
care needs to be given regarding how to do this operation.
