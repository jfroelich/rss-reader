import * as DBService from '/src/service/db-service.js';

export default function unsubscribe(conn, feedId) {
  return DBService.deleteFeed(conn, feedId, 'unsubscribe');
}
