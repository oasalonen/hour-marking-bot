const LUIS = require("LUISSDK");
const nconf = require("nconf");

nconf.env().argv();

const luisAppId = nconf.get("LUIS_APP_ID");
const luisAppKey = nconf.get("LUIS_APP_KEY");

if (!luisAppId || !luisAppKey) {
    throw "LUIS_APP_ID and LUIS_APP_KEY environment variables must be set";
}

const client = new LUIS({
    appId: luisAppId,
    appKey: luisAppKey,
    verbose: false
});

module.exports = {
  client: client
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
