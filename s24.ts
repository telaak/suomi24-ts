import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { JSDOM } from "jsdom";
import { ReadStream } from "fs";
import { EventEmitter } from "events";

function sliceUrl(html: string) {
  let slice = html.slice(html.indexOf("'") + 1, html.lastIndexOf("'"));
  return slice;
}

function getSearchParams(queryString: string) {
  const stripped = queryString.slice(queryString.indexOf("?"));
  const params = new URLSearchParams(stripped);
  return params;
}

export type S24EmittedMessage = {
  sender: string;
  message: string;
  target: string | null;
  private: boolean;
  timestamp: Date | string;
  roomId: number;
};

export type S24User = {
  uid: number;
  username: string;
  birthday: string;
  gender: string;
  nickname: string;
  news_subscription: boolean;
  marketing_permission: boolean;
  phonenumber: string;
  deleted: boolean;
  cleaned_username: string;
  force_password_change: boolean;
  mailverified: boolean;
  valid_mail: boolean;
  settings_skip_timestamp: number;
  phonenumber_verified: boolean;
  is_treffit_user: boolean;
  force_phonenumber_verification: boolean;
  lastlogin: Date;
  created_at: Date;
  lastlogin_old: string;
  has_mailverification_token: boolean;
  access_token: string;
  SOL_auth_token: string;
  remember_me_token: string;
};

class Suomi24ChatChannel extends EventEmitter {
  timer: NodeJS.Timer | undefined;
  roomId: number;
  chatToken: string | undefined;
  chatUrl: string | undefined;
  tellUrl: string | undefined;
  chatStream: ReadStream | undefined;

  private timeoutTimer: NodeJS.Timeout | undefined;
  client: AxiosInstance;
  user: S24User;

  constructor(client: AxiosInstance, user: S24User, roomId: number) {
    super();
    this.user = user;
    this.client = client;
    this.roomId = roomId;
  }

  timeoutChecker() {
    console.log(`${new Date().toISOString()} - heartbeat`);
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(async () => {
      if (this.chatStream) {
        console.log("no heartbeat for 30s");
        await this.logOut();
        await this.initChat();
      }
    }, 30 * 1000);
  }

  keepAliveTimer() {
    this.timer = setInterval(() => {
      this.sendMessage("");
    }, 30 * 1000);
  }

  getTextNodes(document: Document) {
    const treeWalker = document.createTreeWalker(document, 4);
    const list: Node[] = [];
    let next;
    while ((next = treeWalker.nextNode())) {
      list.push(next);
    }
    return list;
  }

  sanitizeText(textNodes: Node[]) {
    const trimmedNodes = textNodes.map((tn) => tn.textContent?.trim());
    let firstNode = trimmedNodes[0];
    if (firstNode?.startsWith(":")) {
      return `${firstNode.slice(2)}${trimmedNodes.slice(1).join(" ")}`;
    }
    return trimmedNodes.slice(1).join(" ");
  }

  async readData() {
    const response = await this.client.get(this.chatUrl as string, {
      responseType: "stream",
    });
    const stream: ReadStream = response.data;
    this.chatStream = stream;
    this.keepAliveTimer();
    stream.on("data", (data: Buffer) => {
      try {
        const htmlText: string = data.toString("utf8");
        this.timeoutChecker();
        console.log(htmlText);
        // if (!htmlText.startsWith("<!") && !htmlText.startsWith("<script")) {
        if (htmlText.startsWith("<img ")) {
          const { document } = new JSDOM(htmlText).window;
          const list = this.getTextNodes(document);
          const links = document.querySelectorAll("a");
          const images = document.querySelectorAll("img");
          // console.log(Array.from(images).map(i => i.src))
          if (links.length === 1) {
            const message = this.sanitizeText(list.slice(2));
            const sender = links[0].textContent?.trim();
            this.emit("message", {
              sender,
              message,
              target: null,
              private: false,
              timestamp: new Date().toISOString(),
              roomId: this.roomId,
            } as S24EmittedMessage);
          } else if (links.length === 2) {
            const message = this.sanitizeText(list.slice(5));
            const senderLink = links[0];
            const sender = senderLink.textContent?.trim();
            const targetLink = links[1];
            const target = targetLink.textContent?.trim();
            this.emit("message", {
              sender,
              message,
              target: target,
              private: senderLink.className === "p",
              timestamp: new Date().toISOString(),
              roomId: this.roomId,
            } as S24EmittedMessage);
          }
        }
      } catch (error) {
        console.log(error);
      }
    });

    stream.on("end", () => {
      console.log("stream done");
      clearInterval(this.timer);
    });

    stream.on("close", () => {
      console.log("stream closed");
      clearInterval(this.timer);
    });
  }

  async getChatUrl() {
    const response = await this.client.get(
      `http://chat.suomi24.fi/login.cgi?cid=${this.roomId}`
    );
    const { document } = new JSDOM(response.data).window;
    const form = document.getElementById("loginfrm") as HTMLFormElement;
    const who = form.querySelector('input[name="who"]') as HTMLInputElement;
    this.chatToken = who.value;
  }

  async initChat() {
    const target = encodeURI(
      `http://chat2.suomi24.fi:8080/login?cid=${this.roomId}&nick=${this.user?.nickname}&name=${this.user?.username}&who=${this.chatToken}`
    );
    const response = await this.client.get(target);
    const targetUrl = sliceUrl(response.data);
    this.chatUrl = targetUrl.replace("/chat/", "/body/");
    this.tellUrl = targetUrl.replace("/chat/", "/tell");
    this.readData();
  }

  async sendMessage(message: string, who = "kaikille", priv = false) {
    const target = `${this.tellUrl}&ac=tell&who=${escape(
      who
    )}&how=0&priv=${priv}&baseTarget=empty&tl=${escape(message)}&tell=${escape(
      message
    )}`;
    try {
      await this.client.get(target);
    } catch (error) {
      console.log(error);
    }
  }

  async logOut() {
    const params = getSearchParams(this.chatUrl as string);
    const cs = params.get("cs");
    const target = encodeURI(
      `http://chat.suomi24.fi/login.cgi?cn=${this.user?.username}&cid=${this.roomId}&gid=6&uid=${this.user?.username}&cs=${cs}&message=exit`
    );
    clearInterval(this.timer);
    clearTimeout(this.timeoutTimer);
    await this.sendMessage(`/poistu ${this.roomId}`);
    await this.client.get(target);
    this.chatStream?.destroy();
  }
}

export class Suomi24Chat extends EventEmitter {
  username: string;
  password: string;

  authenticateUrl = "https://oma.suomi24.fi/authenticate";
  user?: S24User;
  roomIds: number[];
  chatChannels: Suomi24ChatChannel[] = [];

  private jar = new CookieJar();
  private client = wrapper(
    axios.create({ jar: this.jar, withCredentials: true })
  );

  constructor(username: string, password: string, roomIds: number[]) {
    super();
    this.username = username;
    this.password = password;
    this.roomIds = roomIds;
  }

  async sendMessage(
    roomId: number,
    message: string,
    who = "kaikille",
    priv = false
  ) {
    const channel = this.chatChannels.find(
      (channel) => channel.roomId === roomId
    );
    if (channel) {
      await channel.sendMessage(message, who, priv);
    }
  }

  async init() {
    try {
      await this.login();
      this.chatChannels = this.roomIds.map(
        (roomId) =>
          new Suomi24ChatChannel(this.client, this.user as S24User, roomId)
      );
      for (const channel of this.chatChannels) {
        await channel.getChatUrl();
        await channel.initChat();
        channel.on("message", (message) => {
          this.emit("message", message);
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async logout() {
    for (const channel of this.chatChannels) {
      await channel.logOut();
    }
  }

  async login() {
    const request = await this.client.post(this.authenticateUrl, {
      username: this.username,
      password: this.password,
      remember_me: false,
    });
    this.user = request.data;
  }
}
