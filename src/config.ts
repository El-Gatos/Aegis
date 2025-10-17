import dotenv from 'dotenv';

// This line executes the dotenv library, which searches for a .env file
// in the project's root directory and loads its contents into the process environment.
dotenv.config();

// We create a configuration object to hold our environment variables.
// This keeps our code clean and organized.
const config = {
    // process.env.BOT_TOKEN retrieves the value associated with BOT_TOKEN from the .env file.
    token: process.env.BOT_TOKEN,
    // process.env.CLIENT_ID retrieves the value for CLIENT_ID.
    clientId: process.env.CLIENT_ID,
};

// This is a critical safety check. If the bot tries to start without a token
// or client ID, it will immediately stop with a helpful error message instead
// of crashing mysteriously later.
if (!config.token || !config.clientId) {
    throw new Error("Missing required environment variables (BOT_TOKEN, CLIENT_ID). Please check your .env file.");
}

// We export the config object so other files in our project, like index.ts, can import and use it.
export default config;

