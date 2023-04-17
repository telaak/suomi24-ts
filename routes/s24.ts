import HyperExpress, { SendableData } from "hyper-express";
import { s24 } from "..";
import { S24EmittedMessage } from "../s24";
export const s24Router = new HyperExpress.Router();

s24Router.get("/logout", async (req, res) => {
  try {
    await s24.logout();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});

s24Router.get("/login", async (req, res) => {
  try {
    await s24.init();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});

s24Router.get("/channels", async (req, res) => {
  try {
    res.json(s24.chatChannels.map((channel) => channel.roomId));
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});

s24Router.post("/message/:roomId", async (req, res) => {
  try {
    const obj: Partial<S24EmittedMessage> = await req.json();
    await s24.sendMessage(
      Number(req.path_parameters.roomId),
      obj.message || "",
      obj.target || "kaikille",
      obj.private || false
    );
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});

s24Router.post("/message", async (req, res) => {
  try {
    const obj: S24EmittedMessage = await req.json();
    await s24.sendMessage(
      obj.roomId,
      obj.message,
      obj.target || "kaikille",
      obj.private || false
    );
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});
