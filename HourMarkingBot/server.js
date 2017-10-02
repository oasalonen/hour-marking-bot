var Bot = require("./bot");
var nconf = require("nconf");
var restify = require('restify');

nconf.env().argv();


var server = restify.createServer();
server.post('/api/messages', Bot.connector.listen());
server.listen(nconf.get('port') || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

if (nconf.get("BOT_SERVER_TYPE") === "local") {
    const directline = require("offline-directline");
    const express = require("express");
    const path = require("path");

    const app = express();
    directline.initializeRoutes(app, "http://localhost:3000", "http://localhost:3978/api/messages");

    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname + "/index.html"));
    });
}
