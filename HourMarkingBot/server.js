const nconf = require("nconf");

nconf.env().argv();
const serverType = nconf.get("SERVER_TYPE");
console.log("SERVER_TYPE=" + serverType);
if (!serverType) {
    throw "SERVER_TYPE must be defined and must have a value of 'bot', 'directline', or 'standalone'";
}

if (serverType === "bot" || serverType === "standalone") {
    const restify = require('restify');
    const Bot = require("./bot");

    const server = restify.createServer();
    server.post('/api/messages', Bot.connector.listen());
    server.listen(nconf.get('port') || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });
}

if (serverType === "directline" || serverType === "standalone") {
    const directline = require("./directline_server");

    const botHost = nconf.get("BOT_HOST") || "http://localhost:3978";
    const directlineHost = nconf.get("DIRECTLINE_HOST") || "http://localhost:3000";
    directline.server.start(directlineHost, botHost + "/api/messages");
}
