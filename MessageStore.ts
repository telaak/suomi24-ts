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


  /**
   * Creates the table and indexes it
   */

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
    const index = `CREATE INDEX IF NOT EXISTS idx_roomID on messages (roomID)`;
    this.database.run(index);
  }

  /**
   * Deletes message based on row id
   * @param rowid 
   * @returns 
   */

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

  /**
   * Gets message based on row id
   * @param rowid 
   * @returns 
   */

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
  
  /**
   * Gets messages from the database based on sender
   * @param username sender's username
   * @param count amount of messages to get, default 10
   * @returns rows of S24 messages
   */

  async getMessagesByUser(
    username: string,
    count = 10,
  ): Promise<SqliteMessageRow[]> {
    return new Promise((resolve, reject) => {
      let sqlString =
        "SELECT * FROM messages WHERE sender=$sender ORDER BY timestamp DESC LIMIT $count";
      const sql = this.database.prepare(sqlString);
      sql.all(
        {
          $sender: username,
          $count: count,
        },
        (err: any, rows: SqliteMessageRow[]) => {
          if (err) return reject(err);
          resolve(rows);
        }
      );
    });
  }

  /**
   * Gets messages based on room id, defaults to recent
   * @param roomId room's id number
   * @param count amount of messages, default 10
   * @returns rows of S24 messages
   */

  async getMessagesFromRoom(
    roomId: string | number,
    count = 10,
  ) {
    return new Promise((resolve, reject) => {
      const timeTaken = "Get messages";
      let sqlString = "SELECT * FROM messages WHERE roomId=$roomId";
      if (count) {
        sqlString += " ORDER BY timestamp DESC LIMIT $count";
      }
      const sql = this.database.prepare(sqlString);
      console.time(timeTaken);
      sql.all(
        {
          $roomId: roomId,
          $count: count,
        },
        (err: any, rows: SqliteMessageRow[]) => {
          if (err) return reject(err);
          resolve(rows);
          console.timeEnd(timeTaken);
        }
      );
    });
  }

  /**
   * Gets all messages
   * @returns rows of S24 messages
   */

  async getMessages(): Promise<SqliteMessageRow[]> {
    return new Promise((resolve, reject) => {
      const timeTaken = "Get messages";
      let sqlString = "SELECT * FROM messages";
      const sql = this.database.prepare(sqlString);
      console.time(timeTaken);
      sql.all({}, (err: any, rows: SqliteMessageRow[]) => {
        if (err) return reject(err);
        resolve(rows);
        console.timeEnd(timeTaken);
      });
    });
  }

  /**
   * Saves a S24 message to the database
   * @param message message to be saved
   * @returns error, if any
   */

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
