var restify = require('restify');
var builder = require('botbuilder');
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
    verbose: true
});

bot.dialog('/', [
    function (session) {
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

bot.dialog('promptHours', [
    function (session, durationMilliseconds) {
        if (!durationMilliseconds) {
            builder.Prompts.number(session, "How many hours did you do?", { retryPrompt: "That is not a valid number." });
        }
        else {
            session.endDialogWithResult({ response: durationMilliseconds });
        }
    },
    function (session, results) {
        session.endDialogWithResult({ response: new Duration(results.response * Duration.hour).milliseconds() });
    }
]);

bot.dialog('promptProject', [
    function (session, project) {
        if (!project) {
            builder.Prompts.text(session, "Which project did you work for?", { retryPrompt: true })
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
            builder.Prompts.text(session, "What kind of a description should I write for this hour marking?", { retryPrompt: true })
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
        session.beginDialog('promptHours', duration ? duration.milliseconds() : null);
    },
    function (session, results, next) {
        session.dialogData.entry.durationMilliseconds = results.response;
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
            .text(
`I'll create the following hour marking entry for today\n
* Time worked: ${new Duration(entry.durationMilliseconds).toString()}
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

// Setup Restify Server
var server = restify.createServer();
server.post('/api/messages', connector.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url); 
});