import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { EventEmitter } from "events";
import { Suomi24ChatChannel } from "./s24Chat";

export type S24EmittedMessage = {
  sender: string;
  message: string;
  target: string | null;
  private: boolean;
  timestamp: Date | string;
  roomId: number;
};

export type S24EmittedLogout = {
  username: string;
  timestamp: Date | string;
  roomId: number | string;
};

export type S24EmittedLogin = {
  username: string;
  timestamp: Date | string;
  roomId: number | string;
};

export type S24EmittedStateChange = {
  username: string;
  state: number | string;
  timestamp: Date | string;
  roomId: number | string;
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

  /**
   * Finds the appropriate chat channel and sends the message to it
   * @param roomId
   * @param message
   * @param who
   * @param priv
   */

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

  /**
   * Inits by logging in {@link login}
   * Sets up event handlers
   */

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
        channel.on("message", (message: S24EmittedMessage) => {
          this.emit("message", message);
        });
        channel.on("userStateChange", (stateChange: S24EmittedStateChange) => {
          this.emit("userStateChange", stateChange);
        });
        channel.on("userLogin", (userLogin: S24EmittedLogin) => {
          this.emit("userLogin", userLogin);
        });
        channel.on("userLogout", (userLogout: S24EmittedLogout) => {
          this.emit("userLogout", userLogout);
        });
        channel.on("reconnectFailure", () => {
          this.relog();
        });
      }
    } catch (error) {
      console.log(error);
    }
  }

  async logout() {
    await this.client.get("https://oma.suomi24.fi/kirjauduulos");
  }

  /**
   * Logs out from all chat channels
   */

  async logoutChat() {
    for (const channel of this.chatChannels) {
      await channel.logOut();
    }
  }

  async loginChat() {
    for (const channel of this.chatChannels) {
      await channel.initChat();
    }
  }

  /**
   * Logs out from all chat channels and re-inits the chat handler
   * TODO: proper error handling
   */

  async reconnect() {
    try {
      await this.logoutChat();
      await this.logout();
      await this.init();
    } catch (error) {
      console.error(error);
      setTimeout(() => {
        this.reconnect();
      }, 5000);
    }
  }

  /**
   * Logs out and back in again
   */

  async relog() {
    try {
      await this.logout();
      await this.login();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Logs in to the Suomi24 system with the given credentials
   * Also called every 6 hours to re-validate
   */

  async login() {
    const request = await this.client.post(this.authenticateUrl, {
      username: this.username,
      password: this.password,
      remember_me: true,
    });
    this.user = request.data;
  }
}
