import HyperExpress, { SendableData } from "hyper-express";
import { s24 } from "..";
export const s24Router = new HyperExpress.Router();

s24Router.get("/logout", async (req, res) => {
  try {
    await s24.logOut();
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

s24Router.post("/message", async (req, res) => {
  try {
    const obj = await req.json();
    await s24.sendMessage(
      obj.message,
      obj.who || "kaikille",
      obj.priv || false
    );
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send(error as SendableData);
  }
});
