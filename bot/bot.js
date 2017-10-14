const builder = require('botbuilder');
const Duration = require('duration-js');
const moment = require('moment');

const api = require('../hours/api');
const hours = require('../hours/hours');

const absence = require('./absence');
const hourEntry = require('./hour_entry');

// Create bot and add dialogs
const connector = new builder.ChatConnector({
    appId: '',
    appPassword: ''
});

const DIALOGS = {
    ROOT: 'root',
    SAME_ENTRIES: 'same',
    MODIFY_ENTRIES: 'modify',
    DONT_BOTHER: 'dontBother',
};

const WELCOME_MESSAGE = {
    NO_EXISTING_ENTRIES: 0,
    EXISTING_ENTRIES: 1,
    TODAY_MARKED: 2
};

const TASK_SAME_AS_YESTERDAY = 'Same as yesterday';
const TASK_DIDNT_WORK_TODAY = 'I did not work today';
const TASK_SOMETHING_ELSE = 'Something else';
const TASK_MODIFY_TODAY = 'Correct today\'s markings';

const WELCOME_MENU = {
    NO_EXISTING_ENTRIES: {
        [TASK_DIDNT_WORK_TODAY]: {
            type: absence.DIALOGS.AWAY
        },
        [TASK_SOMETHING_ELSE]: {
            type: hourEntry.DIALOGS.CREATE
        }
    },
    EXISTING_ENTRIES: {
        [TASK_SAME_AS_YESTERDAY]: {
            type: DIALOGS.SAME_ENTRIES
        },
        [TASK_DIDNT_WORK_TODAY]: {
            type: absence.DIALOGS.AWAY
        },
        [TASK_SOMETHING_ELSE]: {
            type: hourEntry.DIALOGS.CREATE
        }
    },
    TODAY_MARKED: {
        [TASK_MODIFY_TODAY]: {
            type: DIALOGS.MODIFY_ENTRIES
        }
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

function getWelcomeMessageType(lastMarkedDay) {
    if (lastMarkedDay && lastMarkedDay.data && lastMarkedDay.data.entries && lastMarkedDay.data.entries.length > 0) {
        const isTodayMarked = hours.parseDate(lastMarkedDay.date).isSame(moment(), 'day');
        if (isTodayMarked) {
            return WELCOME_MESSAGE.TODAY_MARKED;
        } else {
            return WELCOME_MESSAGE.EXISTING_ENTRIES;
        }
    } else {
        return WELCOME_MESSAGE.NO_EXISTING_ENTRIES;
    }
}

const bot = new builder.UniversalBot(connector);
bot.dialog('/', [
    function (session) {
        Promise.all([fetchUser(session), fetchHours(session)])
            .then(_ => session.beginDialog(DIALOGS.ROOT))
            .catch(error => {
                session.endConversation(`I'm currently unavailable because I can't reach the hour API (${error})`);
            });
    }
]);

bot.dialog(DIALOGS.ROOT, [
    function (session) {
        let message = `Hi ${session.privateConversationData.user.firstName}!`;
        let menuPrompt = 'What did you do today?';
        let menu;

        const hoursData = session.privateConversationData.hours;
        //const hoursData = hours.testPayload;

        const lastMarkedDay = hours.getLastMarkedDay(hoursData);
        switch (getWelcomeMessageType(lastMarkedDay)) {
            case WELCOME_MESSAGE.NO_EXISTING_ENTRIES:
                menu = WELCOME_MENU.NO_EXISTING_ENTRIES;
                break;
            case WELCOME_MESSAGE.TODAY_MARKED:
                menu = WELCOME_MENU.TODAY_MARKED;
                message += ' You\'ve already marked today.'
                menuPrompt = 'What would you like to do?'
                break;
            case WELCOME_MESSAGE.EXISTING_ENTRIES:
                menu = WELCOME_MENU.EXISTING_ENTRIES;
                const readableEntries = lastMarkedDay.data.entries.map(entry => hours.getReadableEntry(entry, hoursData.reportableProjects));
                message += ` Last time you made the following hour markings:\n${hourEntry.formatAll(readableEntries)}`;
                break;
            default:
                throw `Unhandled welcome message type for ${lastMarkedDay}`;
        }

        session.dialogData.welcomeMenu = menu;
        session.send(message);
        builder.Prompts.choice(session, menuPrompt, menu, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.beginDialog(session.dialogData.welcomeMenu[results.response.entity].type);
    },
    function (session, results) {
        session.endConversation();
    }
]).endConversationAction('end', 'OK, bye!', {
    matches: /^bye$|^cancel$|^go away$/i
});

bot.dialog(DIALOGS.SAME_ENTRIES, [
    function (session) {
        session.endDialog('OK, I\'ll mark today the same. Thanks!');
    }
]);

bot.dialog(DIALOGS.MODIFY_ENTRIES, [
    function (session) {
        session.endConversation('Sorry, I don\'t know how to do that yet :\'(');
    }
]);

bot.dialog(DIALOGS.DONT_BOTHER, [
    function (session) {
        session.endConversation('Alright. I\'ll remind you to mark your hours tomorrow');
    }
]);

absence.register(bot);
hourEntry.register(bot);

module.exports = {
    WELCOME_MESSAGE,
    bot,
    connector,
    getWelcomeMessageType
};
