const builder = require('botbuilder');
const Duration = require('duration-js');
const moment = require('moment');

const api = require('../hours/api');
const hours = require('../hours/hours');

const absence = require('./absence');
const hourEntry = require('./hour_entry');

// Create bot and add dialogs
var connector = new builder.ChatConnector({
    appId: "",
    appPassword: ""
});

const TASK_SAME_AS_YESTERDAY = "Same as yesterday";
const TASK_DIDNT_WORK_TODAY = "I did not work today";
const TASK_SOMETHING_ELSE = "Something else";
const taskGroups = {
    [TASK_SAME_AS_YESTERDAY]: {
        type: "same"
    },
    [TASK_DIDNT_WORK_TODAY]: {
        type: absence.DIALOGS.AWAY
    },
    [TASK_SOMETHING_ELSE]: {
        type: hourEntry.DIALOGS.CREATE
    }
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

var bot = new builder.UniversalBot(connector);
bot.dialog('/', [
    function (session) {
        Promise.all([fetchUser(session), fetchHours(session)])
            .then(_ => session.beginDialog('root'))
            .catch(error => {
                session.endConversation(`I'm currently unavailable because I can't reach the hour API (${error})`);
            });
    }
]);

bot.dialog('root', [
    function (session) {
        const hoursData = session.privateConversationData.hours;
        //const hoursData = hours.testPayload;
        let message = `Hi ${session.privateConversationData.user.firstName}!`;
        let menu = {...taskGroups};
        const lastMarkedDay = hours.getLastMarkedDay(hoursData);
        if (lastMarkedDay && lastMarkedDay.data.entries && lastMarkedDay.data.entries.length > 0) {
            const readableEntries = lastMarkedDay.data.entries.map(entry => hours.getReadableEntry(entry, hoursData.reportableProjects));
            message += ` Last time you made the following hour markings:\n${hourEntry.formatAll(readableEntries)}`;
        } else {
            delete menu[TASK_SAME_AS_YESTERDAY];
        }
        session.send(message);
        builder.Prompts.choice(session, "What did you do today?", menu, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.beginDialog(taskGroups[results.response.entity].type);
    },
    function (session, results) {
        session.endConversation();
    }
]).endConversationAction("end", "OK, bye!", {
    matches: /^bye$|^cancel$|^go away$/i
});

bot.dialog('same', [
    function (session) {
        session.endDialog("OK, I'll mark today the same. Thanks!");
    }
]);

bot.dialog('dontBother', [
    function (session) {
        session.endConversation("Alright. I'll remind you to mark your hours tomorrow");
    }
]);

absence.register(bot);
hourEntry.register(bot);

module.exports = {
    bot,
    connector
}
