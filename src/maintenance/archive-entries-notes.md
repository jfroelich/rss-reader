
# TODO: write tests

Insert test data, then run archive, make assertions about the
state of the database, then delete the database

# TODO: improve performance

I observed the following log message:
[Violation] 'success' handler took 164ms (on line 80 which is the success
handler for loadUnarchivedReadEntriesFromDb). What this indicates to me is that
I am loading too many objects from the database, and doing too much work. So
care needs to be given regarding how to do this operation.

Loading archivable entries from the database may be optimizable using the
right type of query, such as an index over entry state, read state, and date
created. Then again, maybe there is no need to optimize this particular type
of query if the tradeoff is a massive persistent index. The index is always
present but this operation runs in the background and rarely. Maybe it would
be better to just allow this operation to be slower. Therefore, the better
approach would just make this operation batchable. Therefore, I should look
more into setting a limit on the number of entries fetched per run, and remove
the guarantee that all archivable entries get processed per run, and shorten
the alarm period. Therefore the better thing to research is just how to set
a native limit. I think in indexedDB 2.0 if I recall there is a limit parameter
to getAll or something similar.

# TODO: research database change observers

* Rather than broadcast messages I could achieve greater decoupling if I just
used some type of database change observer.
