const nconf = require('nconf');

nconf.env().argv();
nconf.required(['HOUR_API_HOST', 'SERVER_TYPE', 'LUIS_APP_ID', 'LUIS_APP_KEY']);

const serverType = nconf.get('SERVER_TYPE');
console.log('SERVER_TYPE=' + serverType);

const SERVER_TYPE = {
    BOT: 'bot',
    DIRECTLINE: 'directline',
    STANDALONE: 'standalone'
};

if (serverType === SERVER_TYPE.BOT || serverType === SERVER_TYPE.STANDALONE) {
    const restify = require('restify');
    const Bot = require('./bot/bot');

    const server = restify.createServer();
    server.post('/api/messages', Bot.connector.listen());
    server.listen(nconf.get('port') || 3978, function () {
        console.log('%s listening to %s', server.name, server.url);
    });
}

if (serverType === SERVER_TYPE.DIRECTLINE || serverType === SERVER_TYPE.STANDALONE) {
    const directline = require('./directline_server');

    const botHost = nconf.get('BOT_HOST') || 'http://localhost:3978';
    const directlineHost = nconf.get('DIRECTLINE_HOST') || 'http://localhost:3000';
    directline.server.start(directlineHost, botHost + '/api/messages');
}
