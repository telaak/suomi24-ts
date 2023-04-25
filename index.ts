import { SocketHandler } from "./SocketHandler";
import {
  S24EmittedLogin,
  S24EmittedLogout,
  S24EmittedMessage,
  S24EmittedStateChange,
  Suomi24Chat,
} from "./s24";
import HyperExpress from "hyper-express";
import * as dotenv from "dotenv";
import { MessageStore } from "./MessageStore";
import { sqliteRouter } from "./routes/sqlite";
import { s24Router } from "./routes/s24";
import cors from "cors";
import cron from "node-cron";

dotenv.config();

export const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string,
  (process.env.ROOM_IDS as string).split(",").map((s) => Number(s))
);
const Server = new HyperExpress.Server();
const socket = new SocketHandler();

export const messageStore = new MessageStore(process.env.SQLITE_PATH as string);

export type S24WebsocketEvent = {
  event: "message" | "userLogin" | "userLogout" | "userStateChange";
  data:
    | S24EmittedMessage
    | S24EmittedLogin
    | S24EmittedLogout
    | S24EmittedStateChange;
};

const emitS24Event = (event: S24WebsocketEvent) => {
  socket.emitWs(
    JSON.stringify({
      event: event.event,
      data: event.data,
    })
  );
};

s24.init().then(() => {
  cron.schedule("0 */6 * * *", async (now) => {
    try {
      await s24.login();
      console.log(s24.user);
    } catch (error) {
      console.log("failed to relog");
      console.log(error);
    }
  });
});

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

socket.on("message", (json: string) => {
  try {
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

Server.use(cors());
Server.options("/*", (request, response) => {
  return response.send("");
});

Server.use("/ws", socket.router);
Server.use("/messages", sqliteRouter);
Server.use("/s24", s24Router);

Server.listen(4000)
  .then((socket) => console.log("Webserver started on port 4000"))
  .catch((error) => console.log("Failed to start webserver on port 4000"));

process.on("SIGINT", async () => {
  Server.close();
  await s24.logout();
  process.exit();
});

process.on("SIGTERM", async () => {
  Server.close();
  await s24.logout();
  process.exit();
});
