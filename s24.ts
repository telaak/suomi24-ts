import axios from "axios";
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
  who: string | null;
  priv: boolean;
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

export class Suomi24Chat extends EventEmitter {
  username: string;
  password: string;
  chatToken: string | undefined;
  chatUrl: string | undefined;
  tellUrl: string | undefined;
  chatStream: ReadStream | undefined;
  authenticateUrl = "https://oma.suomi24.fi/authenticate";
  user: S24User | undefined;
  timer: NodeJS.Timer | undefined;

  private jar = new CookieJar();
  private client = wrapper(
    axios.create({ jar: this.jar, withCredentials: true })
  );

  constructor(username: string, password: string) {
    super();
    this.username = username;
    this.password = password;
  }

  async init() {
    try {
      await this.login();
      await this.getChatUrl();
      await this.initChat();
    } catch (error) {
      console.log(error);
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

  async getChatUrl() {
    const response = await this.client.get(
      "http://chat.suomi24.fi/login.cgi?cid=953"
    );
    const { document } = new JSDOM(response.data).window;
    const form = document.getElementById("loginfrm") as HTMLFormElement;
    const who = form.querySelector('input[name="who"]') as HTMLInputElement;
    this.chatToken = who.value;
  }

  async initChat() {
    const target = encodeURI(
      `http://chat2.suomi24.fi:8080/login?cid=953&nick=${this.user?.nickname}&name=${this.user?.username}&who=${this.chatToken}`
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
      `http://chat.suomi24.fi/login.cgi?cn=${this.user?.username}&cid=953&gid=6&uid=${this.user?.username}&cs=${cs}&message=exit`
    );
    console.log("logging out");
    clearInterval(this.timer);
    this.chatStream?.destroy();
    await this.client.get(target);
  }

  private timeoutTimer: NodeJS.Timeout | undefined;

  timeoutChecker() {
    console.log(`${new Date().toISOString()} - heartbeat`);
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(() => {
      if (this.chatStream) {
        console.log("no heartbeat for 30s");
        this.chatStream.destroy();
      }
    }, 30 * 1000);
  }

  keepAliveTimer() {
    this.timer = setInterval(() => {
      this.sendMessage("");
    }, 30 * 1000);
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
        if (!htmlText.startsWith("<!")) {
          const { document } = new JSDOM(htmlText).window;
          const links = document.querySelectorAll("a");
          const lineBreak = document.querySelector("br");
          const message = lineBreak?.previousSibling?.textContent
            ?.slice(2)
            .trim();
          if (links.length === 1) {
            const sender = links[0].textContent?.trim();
            this.emit("message", {
              sender,
              message,
              who: null,
              priv: false,
            } as S24EmittedMessage);
          } else if (links.length === 2) {
            const senderLink = links[0];
            const sender = senderLink.textContent?.trim();
            const targetLink = links[1];
            const target = targetLink.textContent?.trim();
            if (senderLink.className === "t") {
              this.emit("message", {
                sender,
                message,
                who: target,
                priv: false,
              } as S24EmittedMessage);
            } else if (senderLink.className === "p") {
              this.emit("message", {
                sender,
                message,
                who: target,
                priv: true,
              } as S24EmittedMessage);
            }
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
}
