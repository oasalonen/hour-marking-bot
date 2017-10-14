
const nconf = require('nconf');

const hoursBuilder = function() {
    let _months = {};

    const self = {
        withMonth: month => {
            _months = {..._months, ...month};
            return self;
        },
        build: () => {
            return {months: _months};
        }
    };
    return self;
};

const monthBuilder = function() {
    let _month;
    let _days = {};

    const self = {
        withMonth: month => {
            _month = month;
            return self;
        },
        withDay: day => {
            _days = {..._days, ...day};
            return self;
        },
        build: () => {
            return {[_month]: { days: _days }};
        }
    };
    return self;
};

const dayBuilder = function() {
    let _day;
    let _entries = [];

    const self = {
        withDay: day => {
            _day = day;
            return self;
        },
        withEntry: entry => {
            _entries = [..._entries, entry];
            return self;
        },
        build: () => {
            return {[_day]:  { entries: _entries }};
        }
    }
    return self;
};

function initEnvironment() {
    nconf.use('memory');
    nconf.set('LUIS_APP_ID', '_');
    nconf.set('LUIS_APP_KEY', '_');
}

module.exports = {
    hoursBuilder,
    monthBuilder,
    dayBuilder,
    initEnvironment
};
