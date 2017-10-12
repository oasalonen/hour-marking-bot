const builder = require('botbuilder');
const Duration = require('duration-js');
const luis = require('../luis');

const DIALOGS = {
    CREATE: 'create_hour_entry'
};

function format(entry) {
    return `* Time worked: ${new Duration(entry.hours * Duration.hour).toString()}
* Project: ${entry.project}
* Task: ${entry.task}
* Description: ${entry.description}`;
}

function formatAll(entries) {
    return entries.map(entry => format(entry)).join('\n');
}

function register(bot) {
    bot.dialog(DIALOGS.CREATE, [
        function (session) {
            builder.Prompts.text(session, 'What should I mark for today?');
        },
        function (session, results) {
            var context = session.toRecognizeContext();
            context.message = results.response;
            luis.client.predict(results.response, {
                onSuccess: function (response) {
                    session.beginDialog('markHours', { intent: response });
                },
                onFailure: function (err) {
                    console.error(err);
                }
            });
        }
    ]).beginDialogAction('showHourMarkingHelp', 'hourMarkingHelp', {
        matches: /^help$/i
    });

    bot.dialog('hourMarkingHelp', [
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

    var FIX_HOURS_ROUND_UP = 'Round up';
    var FIX_HOURS_RETRY = 'Try again';
    var FIX_HOURS_CANCEL = 'Cancel';

    function ceil(value, step) {
        step || (step = 1.0);
        var inv = 1.0 / step;
        return Math.ceil(value * inv) / inv;
    }

    bot.dialog('promptHours', [
        function (session, hours, next) {
            if (!hours) {
                builder.Prompts.number(session, 'How many hours did you do?', { retryPrompt: 'Please provide a valid number, such as 7 or 7.5.' });
            }
            else {
                next({ response: hours });
            }
        },
        function (session, results, next) {
            var hours = session.dialogData.hours = results.response;
            if (hours < 1.0) {
                session.send('You cannot create an hour marking with less than one hour worked.');
                session.replaceDialog('promptHours');
            }
            else if (hours > 24) {
                session.send('You cannot mark more than 24 hours in a day.');
                session.replaceDialog('promptHours');
            }
            else if (hours % 0.5 != 0) {
                //session.send("You can only mark hours in half hour increments. Round to the next half hour.");
                //session.replaceDialog('promptHours');
                builder.Prompts.choice(
                    session,
                    'You can only mark hours in half hour increments. Would you like to round up to the next half hour, try again with a different amount, or cancel this marking?',
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
                session.send('Ok, I\'m canceling this hour marking.');
                session.cancelDialog('*:markHours');
                break;
            }
        }
    ]);

    bot.dialog('promptProject', [
        function (session, project) {
            if (!project) {
                builder.Prompts.text(session, 'Which project did you work for?', { retryPrompt: 'Please provide the project name.' });
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
                builder.Prompts.text(session, 'What kind of a description should I write for this hour marking?', { retryPrompt: 'You need to provide a description.' });
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
                var description = builder.EntityRecognizer.findEntity(intent.entities, 'taskDescription');
                var project = builder.EntityRecognizer.findEntity(intent.entities, 'project');

                if (project) {
                    session.dialogData.entry.project = project.entity;
                }
                if (description) {
                    session.dialogData.entry.description = description.entity;
                }
            }

            var duration = luis.parseDuration(intent);
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
                .textFormat('markdown');
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
}

module.exports = {
    DIALOGS,
    format,
    formatAll,
    register
};
