import * as server from '/src/restorage/server.js';

// Asynchronously connect to the server. Returns the connection
export function connect() {
  throw new Error('Not yet implemented');
}

// General purpose transaction
export function send(conn, request) {
  return this.conn.serve(request);
}

// Specialized transaction
export function post_resource(conn, resource) {
  throw new Error('Not yet implemented');
}

// Specialized transaction
export function put_resource(conn, resource) {
  throw new Error('Not yet implemented');
}

// Specialized transaction
export function get_resource(conn, resource) {
  throw new Error('Not yet implemented');
}
