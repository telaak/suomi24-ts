import { SocketHandler } from "./SocketHandler";
import { S24EmittedMessage, Suomi24Chat } from "./s24";
import HyperExpress from "hyper-express";
import * as dotenv from "dotenv";
import { MessageStore } from "./MessageStore";
import { sqliteRouter } from "./routes/sqlite";
import { s24Router } from "./routes/s24";
import cors from "cors";
dotenv.config();

export const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string,
  (process.env.ROOM_IDS as string).split(',').map(s => Number(s))
);
const Server = new HyperExpress.Server();
const socket = new SocketHandler();

export const messageStore = new MessageStore(process.env.SQLITE_PATH as string);

s24.on("message", async (emittedMessage: S24EmittedMessage) => {
  try {
    await messageStore.saveMessage(emittedMessage);
    socket.emitWs(JSON.stringify(emittedMessage));
  } catch (error) {
    console.error(error);
  }
});

socket.on("message", (json: string) => {
  try {
    const obj: S24EmittedMessage = JSON.parse(json);
    s24.sendMessage(obj.roomId, obj.message, obj.target || "kaikille", obj.private || false);
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
  await s24.logout()
  process.exit();
});
