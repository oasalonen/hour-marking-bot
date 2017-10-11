const builder = require('botbuilder');
const Duration = require('duration-js');
const luis = require('./luis').client;
const api = require('./hours/api');
const hours = require('./hours/hours');
const moment = require('moment');

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
        type: "away"
    },
    [TASK_SOMETHING_ELSE]: {
        type: "new"
    }
};

var absenceGroups = {
    "I'm sick": {
        type: "sick"
    },
    "I'm on vacation": {
        type: "vacation"
    },
    "Go away, I'll mark the hours later": {
        type: "dontBother"
    }
}

function formatHourEntries(entries) {
    return entries.map(entry =>
`* Time worked: ${new Duration(entry.hours * Duration.hour).toString()}
* Project: ${entry.project}
* Task: ${entry.task}
* Description: ${entry.description}`)
        .join('\n');
}

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
            message += ` Last time you made the following hour markings:\n${formatHourEntries(readableEntries)}`;
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

bot.dialog('new', [
    function (session) {
        builder.Prompts.text(session, "What should I mark for today?");
    },
    function (session, results) {
        var context = session.toRecognizeContext();
        context.message = results.response;
        luis.predict(results.response, {
            onSuccess: function (response) {
                session.beginDialog("markHours", { intent: response });
            },
            onFailure: function (err) {
                console.error(err);
            }
        })
    }
]).beginDialogAction("showHourMarkingHelp", "hourMarkingHelp", {
    matches: /^help$/i
});

bot.dialog("hourMarkingHelp", [
    function (session) {
        var msg = new builder.Message(session)
        .text(`Describe the kind of hour marking you want to do, such as 'mark 5 hours of coding for ProjectX'. Keep in mind the following:
* An hour marking needs to have the amount of time worked.
* The time is in hours.
* Minimum amount of time per hour marking is 1 hour.
* Mark in half hour increments. For example, you can mark 1.5 hours but not 1.25 hours.
* The project or top level category for which the work was done.
* The task type, which is predefined and project specific.
* A description of what you did, such as 'Bug fixing for release X'

For more information, please go see the [hour marking guidelines in Confluence](http://confluence.futurice.com/)`);
        session.endDialog(msg);
    }
]);

bot.dialog('same', [
    function (session) {
        session.endDialog("OK, I'll mark today the same. Thanks!");
    }
]);

bot.dialog('away', [
    function (session) {
        builder.Prompts.choice(session, "Why are you away today?", absenceGroups, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        var reason = absenceGroups[results.response.entity].type;
        session.dialogData.reason = reason;
        if (reason === "sick") {
            session.beginDialog('away-duration');
        }
        else if (reason === "vacation") {
            session.beginDialog('away-duration');
        }
        else {
            session.beginDialog(reason);
        }
    },
    function (session, results) {
        var date = builder.EntityRecognizer.resolveTime([results.response]);
        session.dialogData.endDate = date;
        session.send("OK, I'll mark you as %s until %s", session.dialogData.reason === "sick" ? "sick" : "on vacation", date.toLocaleDateString());
        session.beginDialog("ooo", [date]);
    },
    function (session, results) {
        if (session.dialogData.reason === "sick") {
            session.send("Remember that after the third day you need a certificate from the doctor. Get well soon!");
        }
        else if (session.dialogData.reason === "vacation") {
            session.send("You still have 15 days of vacation left this year.");
            session.send("Enjoy your vacation!");
        }

        session.endDialog();
    }
]);

bot.dialog('away-duration', [
    function (session) {
        builder.Prompts.time(session, "Until when are you away?");
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('ooo', [
    function (session, args) {
        session.dialogData.endDate = args[0];
        builder.Prompts.confirm(session, "Would you like to set an out-of-office notification?");
    },
    function (session, results) {
        if (results.response === true) {
            builder.Prompts.text(session, "What should your OOO notification say?")
        }
        else {
            session.endDialog();
        }
    },
    function (session, results) {
        session.endDialog('Your OOO notification will reply "%s". It is set until %s.', results.response, new Date(session.dialogData.endDate).toLocaleDateString());
    }
]);

bot.dialog('dontBother', [
    function (session) {
        session.endConversation("Alright. I'll remind you to mark your hours tomorrow");
    }
]);

var FIX_HOURS_ROUND_UP = "Round up";
var FIX_HOURS_RETRY = "Try again";
var FIX_HOURS_CANCEL = "Cancel";

function ceil(value, step) {
    step || (step = 1.0);
    var inv = 1.0 / step;
    return Math.ceil(value * inv) / inv;
}

bot.dialog('promptHours', [
    function (session, hours, next) {
        if (!hours) {
            builder.Prompts.number(session, "How many hours did you do?", { retryPrompt: "Please provide a valid number, such as 7 or 7.5." });
        }
        else {
            next({ response: hours });
        }
    },
    function (session, results, next) {
        var hours = session.dialogData.hours = results.response;
        if (hours < 1.0) {
            session.send("You cannot create an hour marking with less than one hour worked.")
            session.replaceDialog('promptHours');
        }
        else if (hours > 24) {
            session.send("You cannot mark more than 24 hours in a day.");
            session.replaceDialog('promptHours');
        }
        else if (hours % 0.5 != 0) {
            //session.send("You can only mark hours in half hour increments. Round to the next half hour.");
            //session.replaceDialog('promptHours');
            builder.Prompts.choice(
                session,
                "You can only mark hours in half hour increments. Would you like to round up to the next half hour, try again with a different amount, or cancel this marking?",
                [FIX_HOURS_ROUND_UP, FIX_HOURS_RETRY, FIX_HOURS_CANCEL],
                { listStyle: builder.ListStyle.button });
        }
        else {
            session.endDialogWithResult(results);
        }
    },
    function (session, results) {
        switch (results.response.entity) {
            case FIX_HOURS_ROUND_UP:
                var hours = ceil(session.dialogData.hours, 0.5);
                session.endDialogWithResult({ response: hours });
                break;
            case FIX_HOURS_RETRY:
                session.replaceDialog('promptHours');
                break;
            case FIX_HOURS_CANCEL:
                var dialogs = session.dialogStack();
                session.send("Ok, I'm canceling this hour marking.");
                session.cancelDialog('*:markHours');
                break;
        }
    }
]);

bot.dialog('promptProject', [
    function (session, project) {
        if (!project) {
            builder.Prompts.text(session, "Which project did you work for?", { retryPrompt: "Please provide the project name." })
        }
        else {
            session.endDialogWithResult({ response: project });
        }
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('promptDescription', [
    function (session, description) {
        if (!description) {
            builder.Prompts.text(session, "What kind of a description should I write for this hour marking?", { retryPrompt: "You need to provide a description." })
        }
        else {
            session.endDialogWithResult({ response: description });
        }
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

bot.dialog('markHours', [
    function (session, args, next) {
        var intent = args.intent;
        session.dialogData.entry = {};
        console.log(JSON.stringify(intent));

        if (intent) {
            var description = builder.EntityRecognizer.findEntity(intent.entities, "taskDescription");
            var project = builder.EntityRecognizer.findEntity(intent.entities, "project");

            if (project) {
                session.dialogData.entry.project = project.entity;
            }
            if (description) {
                session.dialogData.entry.description = description.entity;
            }
        }

        var duration = parseDuration(intent);
        session.beginDialog('promptHours', duration ? duration.seconds() / 3600 : null);
    },
    function (session, results, next) {
        session.dialogData.entry.durationHours = results.response;
        session.beginDialog('promptProject', session.dialogData.entry.project);
    },
    function (session, results, next) {
        session.dialogData.entry.project = results.response;
        session.beginDialog('promptDescription', session.dialogData.entry.description);
    },
    function (session, results, next) {
        session.dialogData.entry.description = results.response;
        var entry = session.dialogData.entry;
        var msg = new builder.Message(session)
        .text(`I'll create the following hour marking entry for today\n
* Time worked: ${new Duration(entry.durationHours * Duration.hour).toString()}
* Project:  ${entry.project}
* Description: ${entry.description}`)
        .textFormat("markdown")
        session.send(msg).endDialog();
    }
]).triggerAction({
    matches: 'HourEntryIntent',
    onSelectAction: (session, args, next) => {
        session.beginDialog(args.action, args);
    }
}).cancelAction('cancelAction', 'Ok, cancel marking.', {
    matches: /^nevermind$|^cancel$|^cancel.*marking/i
});

var parseDuration = function (intent) {
    if (intent && intent.compositeEntities) {
        var durationHours = intent.compositeEntities.find(val => val.parentType === "durationHours");
        var durationMinutes = intent.compositeEntities.find(val => val.parentType === "durationMinutes");

        var hours, minutes;
        var duration = new Duration();
        if (durationHours && durationHours.children) {
            hours = durationHours.children.find(val => val.type === "builtin.number").value;
            if (hours) {
                duration = new Duration(duration + hours * Duration.hour);
            }
        }
        if (durationMinutes && durationMinutes.children) {
            minutes = durationMinutes.children.find(val => val.type === "builtin.number").value;
            if (minutes) {
                duration = new Duration(duration + minutes * Duration.minute);
            }
        }

        return duration.seconds() > 0 ? duration : null;
    }
    else {
        return null;
    }
}

module.exports = {
    bot: bot,
    connector: connector
}
