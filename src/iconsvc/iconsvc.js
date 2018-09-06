// NOTE: this is a draft of a complete revision of favicon functionality
// GOALS:
// * only one module file in this folder should be considered public, there
// should only be one public facing API that provides a single point of
// interaction
// * it is ok to break up this folder into multiple files where each file
// pertains to some component. what is important is that only one of the files
// in this folder, only one of the modules, is intended for public export
// * completely or mostly standalone, little or no dependencies at all on
// other modules, even if it means I have to write repetitive code. this module
// should be written as if it was a remote service that did not have access to
// shared libraries. I am focusing on library-as-a-microservice that enforces
// a stricter boundary level. Note the subtlety though. While this should not
// depend on shared 'libs', it *can* depend on other microservices, or
// microservice-like libraries. There can be a dependency hierarchy of
// microservices and nothing is wrong with that.
// * testing should be moved in to this folder or file, and not be located in
// the general test folder
// * any command line commands should be moved into this file or folder
// * switch to per-origin cache instead of per page cache
// * switch to underscore_naming convention for database fields
// * focus on simplifying the API. for example, if the lookup call has a ton of
// params, then think about using some kind of lookup object as a parameter
// instead
// * continue to support cacheless lookup
// * impl plan: create the new code, migrate callers over to new code, delete
// the old code
// * impl note: in the transition, drop the helper that has knowledge of
// feed structure, this is not the proper location for it, this has no knowledge
// of feeds, feed objects, etc
// * one issue i do not know what to do about, because of how it is a shared
// concern with functionality that will exist outside of this service. multiple
// things make network requests to external things. certain sites, for example,
// github, reject or alter responses when receiving concurrent http requests.
// this concurrent-requests thing also places an unrestricted load on external
// things, because each requester is naive of other requesters, which is kind of
// anti-net-policy. i am not sure but perhaps the solution is to have a network
// microservice that coordinates the requests, and have this depend on that
// microservice. because it is a shared concern. in this sense it would make
// sense to first implement that shared functionality. however, i think i want
// to work toward that design in smaller steps, and an intermediate step will be
// a somewhat redundant implementation here

import * as icondb from 'icondb.js';

// Async. Opens and returns a connection to the service's internal database.
//
// The conn has a sync close method. The return type is IDBDatabase, but this
// is not guaranteed to stay that type in the future, the only type guarantee
// is the presence of a synchronous close method.
//
// This will create the database if it is does not exist as an implied side
// effect. Similarly this will update the database as an implied side effect
// if the version changed.
//
// Throws errors if the connection takes too long to open, if if a database
// error of some kind occurs
//
// TODO: maybe optionally allow for custom database information to allow for
// testing
// TODO: optional timeout parameter
//
// API Design thoughts: I have wavered back and forth on whether to have the
// conn object be a first class value in the sense that the caller must maintain
// it for its lifetime and pass it around to every other function, or instead
// have it be a member of some object and not pass it around. Right now I am
// back in the camp of having the caller pass it around. I do not think there is
// immense value in abstracting it away. I do not think there is immense value
// in removing this one param from each of the function calls that require a
// conn. I do not exactly love the idea of exporting a single class when the
// module boundary itself serves a sufficient purpose. Separately note that I
// choose to expose the conn so that it can be reused across multiple lookup
// requests.
export function open() {
  // TODO: implement
  return icondb.open();
}

// Removes all entries in the service's database (e.g. clearing the cache)
export function clear(conn) {
  // TODO: implement
  return icondb.clear(conn);
}

// Removes older entries from the service's database to reduce its size
export function compact(conn) {
  // TODO: implement
  return icondb.compact(conn);
}

// A parameters object for use with lookup calls
export function LookupRequest() {
  this.conn;
  this.url;
  this.document;
  this.should_fetch = true;
}

// Look up the favicon for a given request
export function lookup(request) {
  // TODO: implement
}
