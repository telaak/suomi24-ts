import { SocketHandler } from "./SocketHandler";
import { S24EmittedMessage, Suomi24Chat } from "./s24";
import HyperExpress from "hyper-express";
import * as dotenv from "dotenv";
dotenv.config();

const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string
);
const Server = new HyperExpress.Server();
const socket = new SocketHandler();

s24.init().then(async () => {
  console.log(s24.user);
  s24.on("message", (emittedMessage: S24EmittedMessage) => {
    socket.emitWs(JSON.stringify(emittedMessage));
  });
});

socket.on("message", (json: string) => {
  try {
    const obj = JSON.parse(json);
    s24.sendMessage(obj.message, obj.who || "kaikille", obj.priv || false);
  } catch (error) {
    console.error(error);
  }
});

Server.use("/ws", socket.router);

Server.listen(80)
  .then((socket) => console.log("Webserver started on port 80"))
  .catch((error) => console.log("Failed to start webserver on port 80"));

process.on("SIGINT", async () => {
  Server.close();
  await s24.logOut();
  process.exit();
});
