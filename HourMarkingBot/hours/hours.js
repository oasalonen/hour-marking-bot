const moment = require('moment');

const testPayload = {};

function parseDate(date) {
    return moment(date, 'YYYY-MM-DD');
}

function getLastMarkedDay(hoursResponse) {
    const lastMarkedDay = Object.values(hoursResponse.months)
        .map(month => Object.entries(month.days))
        .reduceRight((a, b) => { return a.concat(b); })
        .map(day => { return {date: parseDate(day[0]), data: day[1]}; })
        .filter(day => day.data.entries && day.data.entries.length > 0)
        .reduce((latest, current) => {
            return latest.date.isBefore(current.date) ? current : latest;
        }, {date: moment(0), data: null});

    return lastMarkedDay.data ? lastMarkedDay : null;
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
    getLastMarkedDay,
    getReadableEntry,
    testPayload
};
