/**
* This file is part of hours-ui, originally developed by Futurice Oy.
*
* hours-ui is licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License. You may
* obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
* WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
* License for the specific language governing permissions and limitations under
* the License.
*/

const {Promise} = require('bluebird');
const fetch = require('node-fetch');
const nconf = require('nconf');

const RESULTS = {
    FETCH_SMILEYS_SUCCESS: 'FETCH_SMILEYS_SUCCESS',
    FETCH_SMILEYS_ERROR: 'FETCH_SMILEYS_ERROR',
    SAVE_SMILEYS_SUCCESS: 'SAVE_SMILEYS_SUCCESS',
    SAVE_SMILEYS_ERROR: 'SAVE_SMILEYS_ERROR',
    SAVE_ENTRIES_SUCCESS: 'SAVE_ENTRIES_SUCCESS',
    SAVE_ENTRIES_ERROR: 'SAVE_ENTRIES_ERROR'
};

const apiHost = nconf.get('HOUR_API_HOST');
const apiUrl = '/api';
const apiVersion = '/v1';
const baseUrl = apiHost + apiUrl + apiVersion;

function apiRequest(method, path, body) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    options.credentials = 'include';
    return fetch(path, options).then(response => response.json());
}

function hoursApiRequest(method, path, body) {
    return apiRequest(method, baseUrl + path, body);
}

function fetchUser() {
    return hoursApiRequest('GET', '/user/');
}

function fetchHours(startDate, endDate) {
    const format = 'YYYY-MM-DD';
    return hoursApiRequest('GET', `/hours/?start-date=${startDate.format(format)}&end-date=${endDate.format(format)}`);
}

let inSaveEntriesQueue = 0;

function waitWhile(conditionFn) {
    function wait(cb) {
        if (conditionFn()) {
            cb();
        } else {
            setTimeout(() => wait(cb), 200);
        }
    }

    return new Promise(resolve => {
        wait(resolve);
    });
}

function saveEntries(date, entries) {
    // Simple queue handling, the order of requests executing is random
    return waitWhile(() => inSaveEntriesQueue === 0)
        .then(() => {
            inSaveEntriesQueue++;

            // Run only one request at a time, because the api returns global updated data,
            // so the last send request is always the last one to return and it holds the
            // most recent data

            // This method handles this error case (lower case = request, upper case = response, letter = day, number = entry request):
            // timeline: a b ==>
            // timeline: a1 a2 b1 b2 ==>
            // timeline: A2 B1 B2 A1  <-- A1 holds the oldest data, which would overwrite B2
            // This method:
            // timeline: A1 A2 B1 B2
            return Promise.mapSeries(
                entries,
                entry => {
                    let request;
                    if (entry.new) {
                        request = hoursApiRequest('POST', '/entry/', {...entry, date});
                    } else if (entry.deleted) {
                        request = hoursApiRequest('DELETE', `/entry/${entry.id}`);
                    } else {
                        request = hoursApiRequest('PUT', `/entry/${entry.id}`, {...entry, date});
                    }

                    return request
                        .catch(error =>
                            Promise.resolve({
                                error,
                                date,
                                entry
                            })
                        );
                });
        })
        .then(results => {
            let action;
            if (results.filter(result => result.error).length > 0) {
                action = {
                    type: RESULTS.SAVE_ENTRIES_ERROR,
                    payload: {
                        date,
                        results
                    }
                };
            } else {
                action = {
                    type: RESULTS.SAVE_ENTRIES_SUCCESS,
                    payload: {
                        date,
                        results
                    }
                };
            }
            return Promise.resolve(action);
        })
        // Errors shouldn't happen because errors are caught in the above mapper.
        .catch(error => {
            return {
                type: RESULTS.SAVE_ENTRIES_ERROR,
                payload: {
                    date,
                    error
                }
            };
        })
        .finally(() => inSaveEntriesQueue--);
}


/**
* Smileys feature
*/

const smileysUrl = 'smileys-api';

function smileysApiRequest(method, path, body) {
    return apiRequest(method, smileysUrl + path, body);
}

function fetchSmileys(startDate, endDate) {
    return smileysApiRequest('GET', `/own?start-date=${startDate}&end-date=${endDate}`)
        .then(json => {
            return {
                type: RESULTS.FETCH_SMILEYS_SUCCESS,
                payload: json
            };
        })
        .catch(err => {
            return {
                type: RESULTS.FETCH_SMILEYS_ERROR,
                payload: err
            };
        });
}

function saveSmileys(date, entries, smiley) {
    return smileysApiRequest('POST', '/own', {entries, date, smiley})
        .then(json => {
            return {
                type: RESULTS.SAVE_SMILEYS_SUCCESS,
                payload: {json, entries, date, smiley}
            };
        })
        .catch(err => {
            return {
                type: RESULTS.SAVE_SMILEYS_ERROR,
                payload: err
            };
        });
}

module.exports = {
    RESULTS,
    fetchUser,
    fetchHours,
    saveEntries,
    smileysApiRequest,
    fetchSmileys,
    saveSmileys
};
