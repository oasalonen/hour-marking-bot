const moment = require('moment');

const testPayload = {};

const DATE_FORMAT = 'YYYY-MM-DD';

function parseDate(date) {
    return moment(date, DATE_FORMAT);
}

function getLastMarkedDay(hoursResponse) {
    const tomorrow = moment()
        .add(1, 'days')
        .startOf('date');

    const lastMarkedDay = Object.values((hoursResponse && hoursResponse.months) || {})
        .map(month => Object.entries(month.days))
        .reduceRight((a, b) => { return a.concat(b); }, [])
        .map(day => { return {date: parseDate(day[0]), data: day[1]}; })
        .filter(day => day.data.entries && day.data.entries.length > 0)
        .filter(day => day.date.isBefore(tomorrow))
        .reduce((latest, current) => {
            return latest.date.isBefore(current.date) ? current : latest;
        }, {date: moment(0), data: null});

    return lastMarkedDay.data ?
        {
            date: lastMarkedDay.date.format(DATE_FORMAT),
            data: lastMarkedDay.data
        } :
        null;
}

function getReadableEntry(entry, reportableProjects) {
    const project = reportableProjects.find(project => project.id === entry.projectId);
    const task = project.tasks.find(task => task.id === entry.taskId);
    return {
        ...entry,
        project: project.name,
        task: task.name
    };
}

module.exports = {
    DATE_FORMAT,
    parseDate,
    getLastMarkedDay,
    getReadableEntry,
    testPayload
};
