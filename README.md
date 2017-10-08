# hour-marking-bot
Hour marking chat bot concept built on Microsoft Bot Framework.

## Setup
The app consists of a bot and a directline server. You may run the bot and server together or separately depending on your requirements. For a simple development environment or intranet deployment, the Standalone setup is recommended.

### Standalone
In this case, the bot and directline server both run in the same process. Set the following environment variables
* ```SERVER_TYPE```: Set to ```SERVER_TYPE=standalone```
* ```LUIS_APP_ID```: The ID of a LUIS app that is configured to understand hour marking intents.
* ```LUIS_APP_KEY```: The LUIS app API key.

To start it all, go to the ```HourMarkingBot``` folder and run

```npm start```

### Bot
The bot needs the following environment variables to be defined:
* ```SERVER_TYPE```: When running the bot by itself, set it to ```SERVER_TYPE=bot```
* ```LUIS_APP_ID```: The ID of a LUIS app that is configured to understand hour marking intents.
* ```LUIS_APP_KEY```: The LUIS app API key.

To start the bot, go to the ```HourMarkingBot``` folder and run

```npm start```

### Directline server
If you want to run the bot outside of Azure Bot Service, for example in a company intranet, you need to also run the directline server either in the same process as the bot or as a separate service. The directline server also serves a [WebChat client](https://github.com/Microsoft/BotFramework-WebChat) which provides a web browser interface to the bot. You need to define the following environment variables:
* ```SERVER_TYPE```: When running the directline server in isolation, set it to ```SERVER_TYPE=directline```.
* ```BOT_HOST```: When running the bot in a different server as the directline server, set it to where the bot is running. For example, ```BOT_HOST="https://mybothost.com:3978"```. If the bot and directline server are running in the same process, leave it undefined.
* ```DIRECTLINE_HOST```: This is where the directline server is hosted. For example, ```DIRECTLINE_HOST=https://directlinehost.com:3000```. If the bot and directline server are running in the same process, leave it undefined.

To start the directline server, go to the ```HourMarkingBot``` folder and run

```npm start```

### Using the bot with the Bot Emulator (without the directline server).
You can also use the Microsoft Bot Framework Emulator to interface with the bot. In this case, run just the bot and connect the emulator to it. Point the emulator at ```http://localhost:3978/api/messages```. Download the emulator [from here](https://github.com/Microsoft/BotFramework-Emulator/releases/).

