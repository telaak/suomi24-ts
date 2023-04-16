import HyperExpress from "hyper-express";
import { EventEmitter } from "events";

export class SocketHandler extends EventEmitter {
  private _router = new HyperExpress.Router();
  private sockets: Set<HyperExpress.Websocket> = new Set();

  get router() {
    return this._router;
  }

  get isAnySocket() {
    return this.sockets.size ? true : false
  }

  emitWs(message: HyperExpress.SendableData) {
    try {
      this.sockets.forEach((socket) => {
        socket.send(message);
      });
    } catch (error) {
      console.error(error);
    }
  }

  constructor() {
    super();
    this._router.ws(
      "/connect",
      {
        idle_timeout: 60,
        max_payload_length: 32 * 1024,
      },
      (ws) => {
        this.sockets.add(ws);
        console.log(ws.ip + " has connected");
        console.log(this.sockets);
        ws.on("close", () => {
          this.sockets.delete(ws);
          console.log(ws.ip + " has now disconnected!");
          console.log(this.sockets);
        });
        ws.on("message", (message) => {
          this.emit("message", message);
        });
      }
    );
  }
}
