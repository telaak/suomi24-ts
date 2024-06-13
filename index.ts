import {
  S24EmittedLogin,
  S24EmittedLogout,
  S24EmittedMessage,
  S24EmittedStateChange,
  Suomi24Chat,
} from "./s24";
import { MessageStore } from "./MessageStore";
import { sqliteRouter } from "./routes/sqlite";
import { s24Router } from "./routes/s24";
import cron from "node-cron";
import express from "express";
import expressWs from "express-ws";
import cors from "cors";

import "dotenv/config";

const app = express();
app.use(express.json());
app.use(cors());
const expressWebsocket = expressWs(app);

app.use("/messages", sqliteRouter);
app.use("/s24", s24Router);

expressWebsocket.app.ws("/ws/connect", function (ws, req) {
  /**
   * Forward messages from websocket to Suomi24
   */
  ws.on("message", (data) => {
    try {
      const json = data.toString("utf-8");
      const obj: S24EmittedMessage = JSON.parse(json);
      s24.sendMessage(
        obj.roomId,
        obj.message,
        obj.target || "kaikille",
        obj.private || false
      );
    } catch (error) {
      console.error(error);
    }
  });
  ws.on("open", (data: any) =>
    console.log(`New websocket connection: ${data}`)
  );
});

export const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string,
  (process.env.ROOM_IDS as string).split(",").map((s) => Number(s))
);

export const messageStore = new MessageStore(process.env.SQLITE_PATH as string);

export type S24WebsocketEvent = {
  event: "message" | "userLogin" | "userLogout" | "userStateChange";
  data:
    | S24EmittedMessage
    | S24EmittedLogin
    | S24EmittedLogout
    | S24EmittedStateChange;
};

/**
 * Emits events from the S24 handler to websocket connections
 * @param event
 */

const emitS24Event = (event: S24WebsocketEvent) => {
  expressWebsocket.getWss().clients.forEach((c) =>
    c.send(
      JSON.stringify({
        event: event.event,
        data: event.data,
      })
    )
  );
};

/**
 * Initializes the connection by logging in and scheduling a re-login every 6 hours
 */

s24.init().then(() => {
  cron.schedule("0 */6 * * *", async (now) => {
    try {
      await s24.relog();
      console.log(s24.user);
    } catch (error) {
      console.log("failed to relog");
      console.log(error);
    }
  });
});

/**
 * Forward message events to websocket
 */

s24.on("message", async (emittedMessage: S24EmittedMessage) => {
  try {
    await messageStore.saveMessage(emittedMessage);
    console.log(`${emittedMessage.sender}: ${emittedMessage.message}`);
    emitS24Event({
      event: "message",
      data: emittedMessage,
    });
  } catch (error) {
    console.error(error);
  }
});

/**
 * Forward state changes to websocket
 */

s24.on("userStateChange", async (emittedStateChange: S24EmittedStateChange) => {
  console.log(
    `${emittedStateChange.username} changed state to ${emittedStateChange.state}`
  );
  try {
    emitS24Event({
      event: "userStateChange",
      data: emittedStateChange,
    });
  } catch (error) {
    console.error(error);
  }
});

/**
 * Forward logouts to websocket
 */

s24.on("userLogout", async (emittedLogout: S24EmittedLogout) => {
  try {
    console.log(`${emittedLogout.username} logged out`);
    emitS24Event({
      event: "userLogout",
      data: emittedLogout,
    });
  } catch (error) {
    console.error(error);
  }
});

/**
 * Forward logins to websocket
 */

s24.on("userLogin", async (emittedLogin: S24EmittedLogin) => {
  try {
    console.log(`${emittedLogin.username} logged in`);
    emitS24Event({
      event: "userLogin",
      data: emittedLogin,
    });
  } catch (error) {
    console.error(error);
  }
});

/**
 * Handle SIGINT and SIGTERM to gracefully log out from channels
 */

process.on("SIGINT", async () => {
  await s24.logoutChat();
  process.exit();
});

process.on("SIGTERM", async () => {
  await s24.logoutChat();
  process.exit();
});

app.listen(4000);
