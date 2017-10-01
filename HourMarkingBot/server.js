var restify = require('restify');
var Logger = require("bunyan");
var Bot = require("./bot");

// Setup Restify Server
//var server = restify.createServer({
//    log: Logger.createLogger({
//        name: "bot",
//        level: "trace"
//    })
//});
var server = restify.createServer();
server.post('/api/messages', Bot.connector.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});