import sqlite3 from "sqlite3";
import { S24EmittedMessage } from "./s24";

export type SqliteMessageRow = S24EmittedMessage & { rowid: number };

export class MessageStore {
  public database;

  constructor(path: string) {
    this.database = new sqlite3.Database(path);
    this.database.serialize();
    this.createTables();
  }

  createTables() {
    const table = `CREATE TABLE IF NOT EXISTS messages
    (
        sender TEXT,
        message TEXT,
        target TEXT NULL,
        private INTEGER,
        timestamp TEXT,
        roomID INTEGER
    )`;
    this.database.run(table);
  }

  async deleteMessage(rowid: string | number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.database.run(
        "DELETE FROM messages WHERE rowid=(?)",
        rowid,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async getMessage(rowid: string | number): Promise<SqliteMessageRow> {
    return new Promise((resolve, reject) => {
      this.database.get(
        "SELECT rowid, * FROM messages where rowid=(?)",
        rowid,
        (err, result: SqliteMessageRow) => {
          if (err || !result) {
            reject();
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  async getMessages(roomId?: number): Promise<SqliteMessageRow[]> {
    return new Promise((resolve, reject) => {
      let sqlString = "SELECT rowid, * FROM messages";
      if (roomId) {
        sqlString += " WHERE roomId=?";
      }
      const sql = this.database.prepare(sqlString);
      sql.all(roomId, (err: any, rows: SqliteMessageRow[]) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  saveMessage(message: S24EmittedMessage): Promise<void> {
    const sql = this.database.prepare(
      "INSERT INTO messages VALUES ($sender, $message, $target, $private, $timestamp, $roomId)"
    );
    return new Promise((resolve, reject) => {
      sql.run(
        {
          $sender: message.sender,
          $message: message.message,
          $target: message.target || null,
          $private: message.private,
          $timestamp: message.timestamp,
          $roomId: message.roomId,
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }
}
