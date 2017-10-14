const {expect} = require('chai');
const moment = require('moment');

const utils = require('./utils.js');
utils.initEnvironment();

const welcome = require('../bot/welcome');
const hours = require('../hours/hours');

describe('welcome', () => {
    it('should exist', () => expect(welcome).to.be.ok);

    describe('#getWelcomeMessageType()', () => {
        describe('with no last marked day', () => {
            it('returns no existing entries given null', () => {
                expect(welcome.getWelcomeMessageType(null)).to.equal(welcome.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given an empty day', () => {
                expect(welcome.getWelcomeMessageType({})).to.equal(welcome.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given missing entries', () => {
                expect(welcome.getWelcomeMessageType({data: {}})).to.equal(welcome.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given empty entries', () => {
                expect(welcome.getWelcomeMessageType({ data: { entries: [] } })).to.equal(welcome.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
        });

        describe('with a marked day', () => {
            const entry = { _: "" };

            it('returns today marked if given day is today', () => {
                const today = moment().format(hours.DATE_FORMAT);
                expect(welcome.getWelcomeMessageType({date: today, data: { entries: [entry] } }))
                    .to.equal(welcome.WELCOME_MESSAGE.TODAY_MARKED);
            });

            it('returns existing entries if given day is before today', () => {
                const yesterday = moment()
                    .subtract(1, 'days')
                    .format(hours.DATE_FORMAT);
                expect(welcome.getWelcomeMessageType({date: yesterday, data: { entries: [entry] } }))
                    .to.equal(welcome.WELCOME_MESSAGE.EXISTING_ENTRIES);
            });
        });
    });
});
