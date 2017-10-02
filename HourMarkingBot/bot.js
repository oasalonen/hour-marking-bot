﻿var builder = require('botbuilder');
var Duration = require('duration-js');
var LUIS = require("LUISSDK");

var luisAppId = process.env.LUIS_APP_ID;
var luisAppKey = process.env.LUIS_APP_KEY;
var luisAppUrl = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAppKey}`;

// Create bot and add dialogs
var connector = new builder.ChatConnector({
    appId: "",
    appPassword: ""
});

var taskGroups = {
    "Same as yesterday": {
        type: "same"
    },
    "I did not work today": {
        type: "away"
    },
    "Something else": {
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

var bot = new builder.UniversalBot(connector);
var luis = new LUIS({
    appId: luisAppId,
    appKey: luisAppKey,
    verbose: false
});

bot.dialog('/', [
    function (session) {
        //session.beginDialog("promptHours"); return;
        session.send("Yesterday you did 8h of estimation for client X");
        builder.Prompts.choice(session, "What did you do today?", taskGroups, { listStyle: builder.ListStyle.button });
    },
    function (session, results) {
        session.beginDialog(taskGroups[results.response.entity].type);
    },
    function (session, results) {
        session.endConversation();
    }
]).endConversationAction("end", "OK, bye!",
    {
        matches: /^bye$|^cancel$|^go away$/i
    });

bot.dialog('new', [
    function (session) {
        session.dialogData.enableLuis = true;
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

//var luis = new builder.LuisRecognizer(luisAppUrl);
//bot.recognizer(luis);

//luis.onEnabled(function (context, callback) {
//    var dialogs = context.dialogStack();
//    var enabled = false;
//    if (dialogs.length > 1 && dialogs[dialogs.length - 2].id.endsWith(":new")) {
//        enabled = true;
//    }
//    callback(null, enabled);
//});

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