const nconf = require("nconf");

nconf.env().argv();
const serverType = nconf.get("SERVER_TYPE");
console.log("SERVER_TYPE=" + serverType);
if (!serverType) {
    throw "SERVER_TYPE must be defined and must have a value of 'bot', 'directline', or 'dev'";
}

if (serverType === "bot" || serverType === "dev") {
    const restify = require('restify');
    const Bot = require("./bot");

    const server = restify.createServer();
    server.post('/api/messages', Bot.connector.listen());
    server.listen(nconf.get('port') || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });
}

if (serverType === "directline" || serverType === "dev") {
    const directline = require("./directline_server");
    directline.server.start(3000, "http://localhost:3978/api/messages");
}
