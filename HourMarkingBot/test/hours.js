const {expect} = require('chai');
const moment = require('moment');

const hours = require('../hours/hours');

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

const testBuilder = function() {
    const days = [];

    const self = {
        withEmptyDay: date => {
            days.push(dayBuilder().withDay(date).build());
            return self;
        },
        withMarkedDay: (date, entries) => {
            const builder = dayBuilder().withDay(date);
            entries.forEach(entry => builder.withEntry(entry));
            days.push(builder.build());
            return self;
        },
        build: () => {
            const builder = monthBuilder().withMonth("1");
            days.forEach(day => builder.withDay(day));
            return hoursBuilder().withMonth(builder.build()).build();
        }
    };
    return self;
};

describe("hours", () => {
    it("should exist", () => expect(hours).to.be.ok);

    describe("#getLastMarkedDay()", () => {
        describe("with empty data", () => {
            it("returns null", () => {
                expect(hours.getLastMarkedDay({})).to.be.null;
            });
        });

        describe("with null data", () => {
            it("returns null", () => {
                expect(hours.getLastMarkedDay(null)).to.be.null;
            });
        });

        describe("with empty months", () => {
            it("returns null", () => {
                expect(hours.getLastMarkedDay({ months: {} })).to.be.null;
            });
        });

        describe("with day information", () => {

            const dayBeforeYesterday = moment()
                .subtract(2, 'days')
                .format(hours.DATE_FORMAT);

            const yesterday = moment()
                .subtract(1, 'days')
                .format(hours.DATE_FORMAT);

            const today = moment()
                .format(hours.DATE_FORMAT);

            const tomorrow = moment()
                .add(1, 'days')
                .format(hours.DATE_FORMAT);

            describe("given a single day", () => {
                const entry = {entry: "entry"};

                it("returns a past marked day", () => {
                    const response = testBuilder()
                        .withMarkedDay(yesterday, [entry])
                        .build();

                    expect(hours.getLastMarkedDay(response)).to.deep.equal({
                        date: yesterday,
                        data: {entries: [entry]}
                    });
                });

                it("returns a marked today", () => {
                    const response = testBuilder()
                        .withMarkedDay(today, [entry])
                        .build();

                    expect(hours.getLastMarkedDay(response)).to.deep.equal({
                        date: today,
                        data: {entries: [entry]}
                    });
                });

                it("does not return an empty day", () => {
                    const response = testBuilder()
                        .withEmptyDay(yesterday)
                        .build();

                    expect(hours.getLastMarkedDay(response)).to.be.null;
                });
            });

            describe("with multiple days", () => {
                it("returns the latest day before tomorrow", () => {
                    const entry = {entry: "entry"};

                    const response = testBuilder()
                        .withMarkedDay(yesterday, [entry])
                        .withMarkedDay(dayBeforeYesterday, [entry])
                        .withMarkedDay(tomorrow, [entry])
                        .build();

                    expect(hours.getLastMarkedDay(response)).to.deep.equal({
                        date: yesterday,
                        data: {entries: [entry]}
                    });
                });
            });
        });
    });
});
