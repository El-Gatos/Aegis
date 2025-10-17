// src/config.ts

import dotenv from 'dotenv';
dotenv.config();

// Destructure variables from process.env first
const { BOT_TOKEN, CLIENT_ID } = process.env;

// This check now acts as a type guard for BOT_TOKEN and CLIENT_ID
if (!BOT_TOKEN || !CLIENT_ID) {
    throw new Error("Missing required environment variables (BOT_TOKEN, CLIENT_ID). Please check your .env file.");
}

// Now, create the config object. TypeScript knows these are strings.
const config = {
    token: BOT_TOKEN,
    clientId: CLIENT_ID,
};

export default config;