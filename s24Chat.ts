import { AxiosInstance } from "axios";
import EventEmitter from "events";
import { ReadStream } from "fs";
import {
  S24User,
  S24EmittedLogin,
  S24EmittedStateChange,
  S24EmittedLogout,
  S24EmittedMessage,
} from "./s24";
import { JSDOM } from "jsdom";

export class Suomi24ChatChannel extends EventEmitter {
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

  /**
   * Gets the query parameters from a string
   * @param queryString
   * @returns
   */

  getSearchParams(queryString: string) {
    const stripped = queryString.slice(queryString.indexOf("?"));
    const params = new URLSearchParams(stripped);
    return params;
  }

  /**
   * Slices the URL out of a script window.location block
   * @param html
   * @returns target location as URL
   */

  sliceUrl(html: string): string {
    let slice = html.slice(html.indexOf("'") + 1, html.lastIndexOf("'"));
    return slice;
  }

  /**
   * Checks every 15 seconds whether there's been anything in the HTML stream
   * Calls reconnect in case nothing detected, otherwise calls itself in a continuous loop
   */

  timeoutChecker() {
    console.log(`heartbeat - ${this.roomId}`);
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = setTimeout(async () => {
      if (this.chatStream) {
        console.log("no heartbeat for 15s");
        this.chatStream.destroy();
        this.reconnect();
      }
    }, 15 * 1000);
  }

  /**
   * Sends an empty message to the chat server to avoid getting kicked for idling
   */

  keepAliveTimer() {
    this.timer = setInterval(() => {
      this.sendMessage("");
    }, 30 * 1000);
  }

  /**
   * Walks through the #TEXT nodes in the HTML document snippet
   * @param document
   * @returns array of text nodes
   */

  getTextNodes(document: Document) {
    const treeWalker = document.createTreeWalker(document, 4);
    const list: Node[] = [];
    let next;
    while ((next = treeWalker.nextNode())) {
      list.push(next);
    }
    return list;
  }

  /**
   * Removes excess tabs and newlines etc from text nodes
   * Also removes the colon separating the sender and the message
   * @param textNodes
   * @returns
   */

  sanitizeText(textNodes: Node[]) {
    const trimmedNodes = textNodes.map((tn) => tn.textContent?.trim());
    let firstNode = trimmedNodes[0];
    if (firstNode?.startsWith(":")) {
      return `${firstNode.slice(2)}${trimmedNodes.slice(1).join(" ")}`;
    }
    return trimmedNodes.slice(1).join(" ");
  }

  /**
   * Parses through script tags, mostly used for events happening in the chat
   * Emits events for users joining, leaving and changing from idle and back
   * TODO: add support for other events
   *
   * Examples:
   *
   * ```
   * <script>parent.user_set_state('salakuuntelu', 1);</script>
   * <script>parent.user_add(new parent.User('', 'salakuuntelu', 1, 'http://www.suomi24.fi/profiili/salakuuntelu', 1, 0, 0));</script>
   * <script>user_remove('salakuuntelu');</script>
   * ```
   * @param htmlText
   */

  handleScript(htmlText: string) {
    const { document } = new JSDOM(htmlText).window;
    const script = document.querySelector("script") as HTMLScriptElement;
    const scriptText = script.textContent as string;
    const stringRegex = /'(.*?)'/g;
    const numberRegex = /([0-9])\)/g;
    const stringMatches = scriptText.match(stringRegex);
    const numberMatches = scriptText.match(numberRegex);

    /**
     * User joined
     */

    if (scriptText.startsWith("parent.user_add")) {
      if (stringMatches) {
        const username = stringMatches[1].replace(/'/g, "");
        this.emit("userLogin", {
          username,
          timestamp: new Date(),
          roomId: this.roomId,
        } as S24EmittedLogin);
      }
      /**
       * User state changed
       * 1 = user idle
       * 0 = user online
       */
    } else if (scriptText.startsWith("parent.user_set_state")) {
      if (stringMatches && numberMatches) {
        const username = stringMatches[0].replace(/'/g, "");
        const state = numberMatches[0].replace(/\)/, "");
        this.emit("userStateChange", {
          username,
          state,
          timestamp: new Date(),
          roomId: this.roomId,
        } as S24EmittedStateChange);
      }
      /**
       * User left
       */
    } else if (scriptText.startsWith("user_remove")) {
      if (stringMatches) {
        const username = stringMatches[0].replace(/'/g, "");
        this.emit("userLogout", {
          username,
          timestamp: new Date(),
          roomId: this.roomId,
        } as S24EmittedLogout);
      }
    }
  }

  /**
   * Parses through the message related nodes, starting with an img tag
   * The username(s) are inside a nodes, and everything else inside text nodes
   * 
   * Example of a message containing multiple emojis and text interlaid:
   * ```
   * <img src="s.gif">
   * <font color="007236"><b>&nbsp;<a class="t" href="#" onclick="s('salakuuntelu');return false;" onmouseover="return parent.set_status('Valitse');" onmouseout="return parent.set_status('');">salakuuntelu</a></b></font>:&nbsp;
   * &nbsp;=&gt;
   * <font color="007236"><b>&nbsp;<a class="t" href="#" onclick="s('suomuurahainen');return false;" onmouseover="return parent.set_status('Valitse');" onmouseout="return parent.set_status('');">suomuurahainen</a></b></font>
   * :&nbsp;
   * <img border="0" src="http://chat.suomi24.fi/img/vip/devil.gif">
   * best 
   * <img border="0" src="http://chat.suomi24.fi/img/vip/offended.gif">
   * test
   * <br>
   * ```
   * @param htmlText
   */

  handleMessage(htmlText: string) {
    const { document } = new JSDOM(htmlText).window;
    const list = this.getTextNodes(document);
    const links = document.querySelectorAll("a");
    const images = document.querySelectorAll("img");
    // console.log(Array.from(images).map(i => i.src))
    /**
     * Normal message only has a sender
     */
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
      /**
       * If 2 a tags, message has a target
       */
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

  /**
   * Opens a connection to the body frame of the chat as a readable stream
   * The connection is kept alive through a 15 second timer {@link timeoutChecker}
   * HTML is first checked as a string to guess what it might be
   * HTML starting with images is most likely a message
   * HTML starting with a script contains some kind of event
   */

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
        if (htmlText.startsWith("<img ")) {
          this.handleMessage(htmlText);
        } else if (htmlText.startsWith("<script>")) {
          this.handleScript(htmlText);
        }
      } catch (error) {
        console.log(error);
      }
    });

    stream.on("end", async () => {
      console.log("stream done");
      clearInterval(this.timer);
    });

    stream.on("close", async () => {
      console.log("stream closed");
      clearInterval(this.timer);
    });
  }

  /**
   * Gets the chat url from parsing the login form on a separate page
   * The form has a hidden input ```form.querySelector('input[name="who"]')```
   * that is needed for joining the actual chat page
   */

  async getChatUrl() {
    const response = await this.client.get(
      `http://chat.suomi24.fi/login.cgi?cid=${this.roomId}`
    );
    const { document } = new JSDOM(response.data).window;
    const form = document.getElementById("loginfrm") as HTMLFormElement;
    const who = form.querySelector('input[name="who"]') as HTMLInputElement;
    this.chatToken = who.value;
  }

  /**
   * Joins the actual chat room and establishes the connection and read stream
   * {@link readData}
   */

  async initChat() {
    await this.getChatUrl()
    const target = encodeURI(
      `http://chat2.suomi24.fi:8080/login?cid=${this.roomId}&nick=${this.user?.nickname}&name=${this.user?.username}&who=${this.chatToken}`
    );
    const response = await this.client.get(target);
    const targetUrl = this.sliceUrl(response.data);
    this.chatUrl = targetUrl.replace("/chat/", "/body/");
    this.tellUrl = targetUrl.replace("/chat/", "/tell");
    this.readData();
  }

  /**
   * Sends a message to the channel, encodes non-ASCII characters to hexadecimal escape sequences
   * @param message 
   * @param who the target, defaults to "kaikille" = everyone in the chat room
   * @param priv whether the message is private, has no effect if there is no target
   */

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

  /**
   * Logs out from the current channel and clears the connection check and keepalive timer
   */

  async logOut() {
    const params = this.getSearchParams(this.chatUrl as string);
    const cs = params.get("cs");
    const target = encodeURI(
      `http://chat.suomi24.fi/login.cgi?cn=${this.user?.username}&cid=${this.roomId}&gid=6&uid=${this.user?.username}&cs=${cs}&message=exit`
    );
    await this.sendMessage(`/poistu ${this.roomId}`);
    // await this.client.get(target);
    if (this.chatStream) {
      this.chatStream.destroy();
    }
    clearInterval(this.timer);
    clearTimeout(this.timeoutTimer);
  }

  /**
   * Attempts to reconnect to the chat channel
   * Maximum of 5 attempts
   * TODO: add some kind of proper error handling
   * @param timeout 
   * @param attempt 
   * @returns 
   */

  async reconnect(timeout = 5000, attempt = 1) {
    if (attempt > 5)
      return console.error(`attempt max reached - ${this.roomId}`);
    try {
      console.log(`attempting to reconnect - ${this.roomId}`);
      await this.initChat();
    } catch (error) {
      console.error(error);
      console.log(`failed to reconnect - ${this.roomId}`);
      this.emit('reconnectFaillure')
      setTimeout(() => {
        this.reconnect(timeout * attempt, attempt + 1);
      }, timeout);
    }
  }
}
