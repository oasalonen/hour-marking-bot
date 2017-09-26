var restify = require('restify');
var builder = require('botbuilder');

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
        session.endDialog("I don't yet know how to add new entries");
    }
]);

bot.dialog('same', [
    function (session) {
        session.endDialog("OK, I'll mark today as the same. Thanks!");
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

// Setup Restify Server
var server = restify.createServer();
server.post('/api/messages', connector.listen());
server.listen(process.env.port || 3978, function () {
    console.log('%s listening to %s', server.name, server.url); 
});