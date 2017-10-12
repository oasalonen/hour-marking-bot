const LUIS = require('LUISSDK');
const nconf = require('nconf');
const Duration = require('duration-js');

nconf.env().argv();

const luisAppId = nconf.get('LUIS_APP_ID');
const luisAppKey = nconf.get('LUIS_APP_KEY');

if (!luisAppId || !luisAppKey) {
    throw 'LUIS_APP_ID and LUIS_APP_KEY environment variables must be set';
}

const client = new LUIS({
    appId: luisAppId,
    appKey: luisAppKey,
    verbose: false
});

function parseDuration(markHoursIntent) {
    if (markHoursIntent && markHoursIntent.compositeEntities) {
        var durationHours = markHoursIntent.compositeEntities.find(val => val.parentType === 'durationHours');
        var durationMinutes = markHoursIntent.compositeEntities.find(val => val.parentType === 'durationMinutes');

        var hours, minutes;
        var duration = new Duration();
        if (durationHours && durationHours.children) {
            hours = durationHours.children.find(val => val.type === 'builtin.number').value;
            if (hours) {
                duration = new Duration(duration + hours * Duration.hour);
            }
        }
        if (durationMinutes && durationMinutes.children) {
            minutes = durationMinutes.children.find(val => val.type === 'builtin.number').value;
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
    client,
    parseDuration
};


// Example of how to use a global LUIS intent recognizer instead of the LUIS SDK
//const luisAppUrl = `https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/${luisAppId}?subscription-key=${luisAppKey}`;
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
