import { SocketHandler } from "./SocketHandler";
import { Suomi24Chat } from "./s24";
import HyperExpress from "hyper-express";
import * as dotenv from "dotenv";
dotenv.config();

const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string
);
const Server = new HyperExpress.Server();
const socket = new SocketHandler();

s24.login().then(async () => {
  console.log(s24.user);
  await s24.getChatUrl();
  await s24.initChat();
  console.log(s24.chatUrl);
  s24.on(
    "message",
    ({ username, message }: { username: string; message: string }) => {
      socket.emitWs(JSON.stringify({ username, message }));
    }
  );
});

socket.on("message", (message: string) => {
  s24.sendMessage(message);
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
