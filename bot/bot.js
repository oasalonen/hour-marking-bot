const builder = require('botbuilder');
const moment = require('moment');

const api = require('../hours/api');

const welcome = require('./welcome');

// Create bot and add dialogs
const connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});

const DIALOGS = {
    DONT_BOTHER: 'dontBother',
};

function fetchUser(session) {
    return session.privateConversationData.user ?
        Promise.resolve() :
        api.fetchUser().then(user => session.privateConversationData.user = user);
}

function fetchHours(session) {
    const endDate = moment(Date.now());
    const startDate = endDate.subtract(7, 'days');
    return session.privateConversationData.hours ?
        Promise.resolve() :
        api.fetchHours(startDate, endDate).then(hours => session.privateConversationData.hours = hours);
}

const bot = new builder.UniversalBot(connector);
bot.dialog('/', [
    function (session) {
        Promise.all([fetchUser(session), fetchHours(session)])
            .then(_ => session.beginDialog(welcome.DIALOGS.WELCOME))
            .catch(error => {
                session.endConversation(`I'm currently unavailable because I can't reach the hour API (${error})`);
            });
    }
]);

bot.dialog(DIALOGS.DONT_BOTHER, [
    function (session) {
        session.endConversation('Alright. I\'ll remind you to mark your hours tomorrow');
    }
]);

welcome.register(bot);

module.exports = {
    bot,
    connector
};
