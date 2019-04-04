import * as db from '/src/db/db.js';

// NOTE: this is a work in progress, unstable, do NOT use

// TODO: maybe what i want is client and server
// - server has conn property, methods connect and close
// - client has send method, and possibly some specialized methods like
// putResource or something
// - client maybe also has a method like subscribe that opens channel


export function Request() {
  this.url = undefined;
  this.body = undefined;
  this.headers = {};
}

export function Response() {
  this.url = undefined;
  this.body = undefined;
}


// Send a request to storage and get a response.
export async function send(request) {
  const url = request.url;
  const method = request.method;
  const path = url.pathname;

  if (path === '/resource') {
    if (method === 'put') {
      const resource = request.body;

      let conn;
      try {
        conn = await db.open();
        await db.put_resource(conn, resource);
      } catch (error) {
        throw new SendError(error.message);
      } finally {
        if (conn) {
          conn.close();
        }
      }

      const response = new Response();
      response.url = request.url;
      return response;
    } else if (method === 'post') {
    } else if (method === 'patch') {
    } else if (method === 'get') {
    }

  } else if (path === '/resources') {
  } else {
    throw new Error('Invalid path: ' + path);
  }
}

export class SendError extends Error {
  constructor(message = 'Send error') {
    super(message);
  }
}
