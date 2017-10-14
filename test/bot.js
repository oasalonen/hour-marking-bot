const {expect} = require('chai');
const moment = require('moment');

const utils = require('./utils.js');
utils.initEnvironment();

const bot = require('../bot/bot');
const hours = require('../hours/hours');

describe('bot', () => {
    it('should exist', () => expect(bot).to.be.ok);

    describe('#getWelcomeMessageType()', () => {
        describe('with no last marked day', () => {
            it('returns no existing entries given null', () => {
                expect(bot.getWelcomeMessageType(null)).to.equal(bot.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given an empty day', () => {
                expect(bot.getWelcomeMessageType({})).to.equal(bot.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given missing entries', () => {
                expect(bot.getWelcomeMessageType({data: {}})).to.equal(bot.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
            it('returns no existing entries given empty entries', () => {
                expect(bot.getWelcomeMessageType({ data: { entries: [] } })).to.equal(bot.WELCOME_MESSAGE.NO_EXISTING_ENTRIES);
            });
        });

        describe('with a marked day', () => {
            const entry = { _: "" };

            it('returns today marked if given day is today', () => {
                const today = moment().format(hours.DATE_FORMAT);
                expect(bot.getWelcomeMessageType({date: today, data: { entries: [entry] } }))
                    .to.equal(bot.WELCOME_MESSAGE.TODAY_MARKED);
            });

            it('returns existing entries if given day is before today', () => {
                const yesterday = moment()
                    .subtract(1, 'days')
                    .format(hours.DATE_FORMAT);
                expect(bot.getWelcomeMessageType({date: yesterday, data: { entries: [entry] } }))
                    .to.equal(bot.WELCOME_MESSAGE.EXISTING_ENTRIES);
            });
        });
    });
});
