import dotenv from "dotenv";
dotenv.config();

const { BOT_TOKEN, CLIENT_ID } = process.env;

if (!BOT_TOKEN || !CLIENT_ID) {
  throw new Error(
    "Missing required environment variables (BOT_TOKEN, CLIENT_ID). Please check your .env file."
  );
}

const config = {
  token: BOT_TOKEN,
  clientId: CLIENT_ID,
};

export default config;
