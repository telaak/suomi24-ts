import { Router } from "express";
import { messageStore } from "..";
export const sqliteRouter = Router();

sqliteRouter.get("/", async (req, res) => {
  try {
    const messages = await messageStore.getMessages();
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

sqliteRouter.get("/:roomId", async (req, res) => {
  try {
    const roomId = Number(req.params.roomId)
    const body = req.body
    const messages = await messageStore.getMessagesFromRoom(roomId, body.count);
    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

sqliteRouter.get('/sender/:username', async (req, res) => {
  try {
    const body = req.body
    const messages = await messageStore.getMessagesByUser(req.params.username, body.count)
    res.json(messages);
  } catch (error) {
    if (error) {
      console.error(error);
      res.status(500).send(error);
    } else {
      res.status(404).send();
    }
  }
})

sqliteRouter.get("/:id", async (req, res) => {
  try {
    const message = await messageStore.getMessage(req.params.id);
    console.log(message);
    res.json(message);
  } catch (error) {
    if (error) {
      console.error(error);
      res.status(500).send(error);
    } else {
      res.status(404).send();
    }
  }
});

sqliteRouter.delete("/:id", async (req, res) => {
  try {
    const message = await messageStore.getMessage(req.params.id);
    await messageStore.deleteMessage(message.rowid);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});
