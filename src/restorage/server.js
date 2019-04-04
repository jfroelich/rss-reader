// Connect to the service. Returns a new Server instance
export default function connect() {
  throw new Error('Not yet implemented');
}

export function Server() {
  this.conn = undefined;
}

Server.prototype.close = function() {
  this.conn.close();
};

// Asynchronously handle a request and return a response
Server.prototype.serve = async function(request) {
  throw new Error('Not yet implemented');
};

export function Request() {
  this.url = undefined;
  this.body = undefined;
}

export function Response() {
  this.url = undefined;
  this.body = undefined;
}

// A general kind of error generated when interacting with the server
export class ServerError extends Error {
  constructor(message = 'Unknown server error') {
    super(message);
  }
}
