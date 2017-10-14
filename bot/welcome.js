const builder = require('botbuilder');
const moment = require('moment');

const hours = require('../hours/hours');

const absence = require('./absence');
const hourEntry = require('./hour_entry');

const DIALOGS = {
    WELCOME: 'welcome',
    SAME_ENTRIES: 'same',
    MODIFY_ENTRIES: 'modify',
    DONT_BOTHER: 'dontBother',
};

const WELCOME_MESSAGE = {
    NO_EXISTING_ENTRIES: 0,
    EXISTING_ENTRIES: 1,
    TODAY_MARKED: 2
};

const MENU_ITEM_SAME = 'Same as last time';
const MENU_ITEM_ABSENCE = 'I did not work today';
const MENU_ITEM_ELSE = 'Something else';
const MENU_ITEM_MODIFY = 'Correct today\'s markings';

const WELCOME_MENU = {
    NO_EXISTING_ENTRIES: {
        [MENU_ITEM_ABSENCE]: {
            type: absence.DIALOGS.AWAY
        },
        [MENU_ITEM_ELSE]: {
            type: hourEntry.DIALOGS.CREATE
        }
    },
    EXISTING_ENTRIES: {
        [MENU_ITEM_SAME]: {
            type: DIALOGS.SAME_ENTRIES
        },
        [MENU_ITEM_ABSENCE]: {
            type: absence.DIALOGS.AWAY
        },
        [MENU_ITEM_ELSE]: {
            type: hourEntry.DIALOGS.CREATE
        }
    },
    TODAY_MARKED: {
        [MENU_ITEM_MODIFY]: {
            type: DIALOGS.MODIFY_ENTRIES
        }
    }
};

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

function register(bot) {

    bot.dialog(DIALOGS.WELCOME, [
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

    absence.register(bot);
    hourEntry.register(bot);
}

module.exports = {
    DIALOGS,
    WELCOME_MESSAGE,
    register,
    getWelcomeMessageType
};
