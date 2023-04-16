import { JSDOM } from "jsdom";
import { S24EmittedMessage } from "./s24";

const htmlText = `<img src="s.gif">
<font color="007236"><b>&nbsp;<a class="t" href="#" onclick="s('salakuuntelu');return false;" onmouseover="return parent.set_status('Valitse');" onmouseout="return parent.set_status('');">salakuuntelu</a></b></font>:&nbsp;
&nbsp;=&gt;
<font color="007236"><b>&nbsp;<a class="t" href="#" onclick="s('suomuurahainen');return false;" onmouseover="return parent.set_status('Valitse');" onmouseout="return parent.set_status('');">suomuurahainen</a></b></font>
:&nbsp;
<img border="0" src="http://chat.suomi24.fi/img/vip/devil.gif">
best 
<img border="0" src="http://chat.suomi24.fi/img/vip/offended.gif">
test
<br>
`;

const emoticons: { [key: string]: string } = {
  "vip/stupid.gif": ":s",
  "vip/unsure.gif": ":r",
  "vip/sleep.gif": ":u",
  "vip/ninja.gif": "(h)",
  "vip/sick.gif": ":p",
  "vip/hehe.gif": "(he)",
  "vip/sad.gif": ":(",
  "vip/lauth.gif": ":d",
  "vip/smile.gif": ":)",
  "vip/huh.gif": ":f",
  "vip/tombdown.gif": "(n)",
  "vip/offended.gif": ":g",
  "vip/blomst.gif": "@-}-",
  "vip/fika.gif": "(c)",
  "vip/love17.gif": ":X",
  "vip/devil.gif": "(6)",
  "vip/pressed.gif": ":L",
  "vip/shout.gif": "(g)",
  "vip/hello.gif": "(hi)",
  "vip/see.gif": ":s)",
  "vip/note.gif": "(m)",
  "vip/wacko.gif": "(w)",
  "vip/blush.gif": ":B",
  "vip/bulb.gif": "(i)",
  "vip/tombup.gif": "(y)",
  "vip/wink.gif": ";)",
  "vip/cry.gif": ";(",
  "vip/angel.gif": "o:)",
  "vip/broken_heart.gif": "(:v)",
  "vip/good.gif": "(k)",
  "vip/hart.gif": "(s)",
};

const { document } = new JSDOM(htmlText).window;

const treeWalker = document.createTreeWalker(document);

const list: Node[] = [];
let next;
let index = 0;
let object: any = {
  message: "",
};
while ((next = treeWalker.nextNode())) {
  if (next.nodeName === "FONT") {
    const font = next as HTMLFontElement;
    object.private = font.color === "ff0000";
    if (!object.sender) {
      object.sender = font.textContent?.trim();
    } else {
      object.target = font.textContent?.trim();
    }
  } else if (next.nodeName === "IMG") {
    const imageNode = next as HTMLImageElement;
    const src = imageNode.src;
    if (src !== "s.gif") {
      const emoticonUrl = src.replace("http://chat.suomi24.fi/img/", "");
      const emoticon = emoticons[emoticonUrl];
      object.message +=  `${emoticon} `
    }
  } else if (next.nodeName === "#text") {
    const trimmed = next.textContent?.trim();
    if (trimmed !== object.sender && trimmed !== object.target) {
      if (!trimmed?.startsWith(":") && trimmed !== " =>" && trimmed?.length) {
        object.message += `${trimmed} `;
      }
    }
  }
  index++;
}

console.log(object);
