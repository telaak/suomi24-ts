import { SocketHandler } from "./SocketHandler";
import { S24EmittedMessage, Suomi24Chat } from "./s24";
import HyperExpress from "hyper-express";
import * as dotenv from "dotenv";
import { MessageStore } from "./MessageStore";
import { sqliteRouter } from "./routes/sqlite";
import { s24Router } from "./routes/s24";
import cors from "cors";
dotenv.config();

import webPush from "web-push";

webPush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC as string,
  process.env.VAPID_PRIVATE as string
);

const subscription = {
  endpoint:
    "https://fcm.googleapis.com/fcm/send/chfJzkYUCpg:APA91bHpjE5cD_QVla5JWPvryJQOgfXE9L0EGC0VikScgANWGY9-HaDyKezw7jScj0aZzjuVg01U84rS9XwcfUIPVCubXDZVPg5CBqytrISq8ImuTZXUdIgo5r-PqNcCN_-gDt8aQLYA",
  expirationTime: null,
  keys: {
    p256dh:
      "BCR7vHuWZME3OytGplIYN_1jziVR5hzYipQVhaMB1Wd1eYASGm_NAbDP2qCbCb0z1vY9vnWHAA5orv0IOq_QCK8",
    auth: "YB6S335yyWYCS8Yb4kI8JQ",
  },
};

// setTimeout(() => {
//   webPush
//     .sendNotification(
//       subscription,
//       JSON.stringify({
//         title: "Hello Web Push",
//         message: "Your web push notification is here!",
//       })
//     )
//     .then((res) => {
//       console.log(res);
//     })
//     .catch((err) => {
//       console.log(err);
//     });
// }, 5000);

export const s24 = new Suomi24Chat(
  process.env.USERNAME as string,
  process.env.PASSWORD as string,
  Number(process.env.ROOM_ID as string)
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
    const obj = JSON.parse(json);
    s24.sendMessage(obj.message, obj.who || "kaikille", obj.priv || false);
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
  if (s24.chatStream) {
    await s24.logOut();
  }
  process.exit();
});
