import { Router } from "express";
import { s24 } from "..";
import { S24EmittedMessage } from "../s24";
export const s24Router = Router();

s24Router.get("/init", async (req, res) => {
  try {
    await s24.init();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.get("/logout", async (req, res) => {
  try {
    await s24.logout();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.get("/login", async (req, res) => {
  try {
    await s24.login();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.get("/chat/logout", async (req, res) => {
  try {
    await s24.logoutChat();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.get("/chat/login", async (req, res) => {
  try {
    await s24.loginChat();
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.get("/channels", async (req, res) => {
  try {
    res.json(s24.chatChannels.map((channel) => channel.roomId));
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.post("/message/:roomId", async (req, res) => {
  try {
    const obj: Partial<S24EmittedMessage> = req.body
    await s24.sendMessage(
      Number(req.params.roomId),
      obj.message || "",
      obj.target || "kaikille",
      obj.private || false
    );
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

s24Router.post("/message", async (req, res) => {
  try {
    const obj: S24EmittedMessage = req.body
    await s24.sendMessage(
      obj.roomId,
      obj.message,
      obj.target || "kaikille",
      obj.private || false
    );
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});
