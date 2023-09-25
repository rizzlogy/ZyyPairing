const pino = require("pino");
const path = require("path");
const colors = require("@colors/colors/safe");
const CFonts = require("cfonts");
const fs = require("fs-extra");
const chalk = require("chalk");
const readline = require("readline");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  PHONENUMBER_MCC,
} = require("@whiskeysockets/baileys");

global.sessionName = "auth-info";
const pairingCode = process.argv.includes("--use-pairing-code");

if (!pairingCode) {
  console.log(chalk.redBright("Use --use-pairing-code"));
  process.exit(1);
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

CFonts.say("Zyy Pairing", {
  font: "tiny",
  align: "center",
  colors: ["system"],
});
CFonts.say(
  "Simple To Connect Whatsapp Bot Use Pairing Code\nWith Baileys Library\n\nGithub : https://github.com/rizzlogy/zyypairing",
  {
    colors: ["system"],
    font: "console",
    align: "center",
  },
);

async function main() {
  const sessionExists = await fs.pathExists(path.join(__dirname, sessionName));
  if (sessionExists) {
    console.log(chalk.greenBright("Clearing up session"));
    await fs.emptyDir(path.join(__dirname, sessionName));
    await delay(800);
    ZyyPairing();
  } else {
    console.log(chalk.greenBright("Starting Code Pairing"));
    ZyyPairing();
  }
}

async function ZyyPairing() {
  const { state, saveCreds } = await useMultiFileAuthState("./" + sessionName);
  try {
    const socket = makeWASocket({
      printQRInTerminal: !pairingCode,
      logger: pino({
        level: "silent",
      }),
      browser: ["Chrome (Linux)", "", ""], // dont change this.
      auth: state,
    });
    if (pairingCode && !socket.authState.creds.registered) {
      let phoneNumber;
      phoneNumber = await question(
        chalk.bgBlack(chalk.greenBright(`Please type your WhatsApp number : `)),
      );
      phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

      // Ask again when entering the wrong number
      if (
        !Object.keys(PHONENUMBER_MCC).some((v) => phoneNumber.startsWith(v))
      ) {
        console.log(
          chalk.bgBlack(
            chalk.redBright("Start with your country's WhatsApp code!"),
          ),
        );
        phoneNumber = await question(
          chalk.bgBlack(
            chalk.greenBright(`Please type your WhatsApp number : `),
          ),
        );
        phoneNumber = phoneNumber.replace(/[^0-9]/g, "");
        rl.close();
      }

      setTimeout(async () => {
        let code = await socket.requestPairingCode(phoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(
          chalk.black(chalk.bgGreen(`Your Pairing Code : `)),
          chalk.black(chalk.white(code)),
        );
      }, 3000);
    }
    socket.ev.on(
      "connection.update",
      async ({ connection, lastDisconnect }) => {
        if (connection === "open") {
          let file = await socket.sendMessage(socket.user.id, {
            document: fs.readFileSync("./" + sessionName + "/creds.json"),
            mimetype: "json",
            fileName: "creds.json",
          });

          await socket.sendMessage(
            socket.user.id,
            { text: "Upload this session to ur bot multi auth state" },
            { quoted: file },
          );

          console.log(chalk.greenBright("DONE!"));
          await fs.emptyDir("./" + sessionName);
          process.exit(1);
        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          ZyyPairing();
          await fs.emptyDir("./" + sessionName);
        }
      },
    );
    socket.ev.on("creds.update", saveCreds);
  } catch (error) {
    console.error(error);
    await fs.emptyDir("./" + sessionName);
    process.exit(1);
  }
}

main().catch((error) => console.error(error));
