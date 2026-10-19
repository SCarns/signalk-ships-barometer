// Ship's Barometer modifications by SCarns, 2026. Derived from oyve/signalk-barometer-trend v2.3.4; see NOTICE and CHANGELOG.md.
'use strict'
const fs = require('fs');
const { History } = require('./lib/history');
const { ForecastComparison } = require('./lib/forecast-comparison');
const meta = require('./meta.json');
const schema = require('./schema.json');
const barometer = require('./barometer');
const { Assessment, PATHS } = require('./assessment');

module.exports = function (app) {
    var plugin = { };
    let persistTimer = null;
    let history = null;
    let comparison = null;
    let comparisonTimer = null;
    let running = false;
    let display = {};
    let assessment = null;
    let assessmentTimer = null;

    plugin.id = 'signalk-ships-barometer';
    plugin.name = "Ship's Barometer";
    plugin.description = 'Offline pressure forecasts and local wind, moisture and water-temperature assessment';

    var unsubscribes = [];
    plugin.start = function (options, restartPlugin) {
        app.debug('Plugin started');
        display = {};
        history = new History(app.getDataDirPath() + '/pressure-history.json', app.selfId, msg => app.error(msg), options.historyPressureSource || '');
        history.load();
        running = true;
        comparison = new ForecastComparison(app, app.getDataDirPath() + '/forecast-comparison.json', options.forecastComparison === true);
        comparison.load();
        if (options.forecastComparison === true) {
            comparison.refresh();
            comparisonTimer = setInterval(() => comparison && comparison.refresh(), 15 * 60000);
        }

        try {
            barometer.setSampleRate(options.rate);
            app.debug('Sample rate set to ' + options.rate + " seconds");
        } catch (error) {
            app.error('Error setting sample rate: ' + error.message);
        }

        try {
            barometer.setAltitudeCorrection(options.altitude);
            app.debug('Altitude offset set to ' + options.altitude + " metre(s)");
        } catch (error) {
            app.error('Error setting altitude correction: ' + error.message);
        }

        barometer.populate(read);

        let localSubscription = {
            context: '*',
            subscribe: barometer.SUBSCRIPTIONS
        };

        app.subscriptionmanager.subscribe(
            localSubscription,
            unsubscribes,
            subscriptionError => {
                app.error('Error:' + subscriptionError);
            },
            delta => sendDelta(barometer.onDeltasUpdate(delta))
        );

        if (options.localAssessment === true) {
            assessment = new Assessment({pressure: options.assessmentPressureSource || '', wind: options.assessmentWindSource || '', temperature: options.assessmentTemperatureSource || '', humidity: options.assessmentHumiditySource || '', dewpoint: options.assessmentDewpointSource || '', water: options.assessmentWaterSource || ''}, Number.isFinite(options.assessmentWaterDepthM) ? options.assessmentWaterDepthM : null);
            assessment.context = "vessels." + app.selfId;
            try {
                assessment.restore(JSON.parse(fs.readFileSync(assessmentFilePath(), 'utf8')));
            } catch (err) {
                if (err.code !== 'ENOENT') app.error('Assessment history could not be loaded: ' + err.message);
            }
            app.subscriptionmanager.subscribe(
                { context: "vessels." + app.selfId, subscribe: [...Object.values(PATHS), 'environment.outside.relativeHumidity'].map(path => ({ path, period: 60000 })) },
                unsubscribes,
                err => app.error('Assessment subscription: ' + err),
                delta => assessment && assessment.ingest(delta)
            );
            assessmentTimer = setInterval(publishAssessment, 60000);
            publishAssessment();
        }

        app.subscriptionmanager.subscribe(
            { context: 'vessels.' + app.selfId, subscribe: [{ path: 'environment.outside.pressure', period: 60000, policy: 'instant', minPeriod: 60000 }] },
            unsubscribes, err => app.error('Pressure history subscription: ' + err),
            delta => history && history.ingest(delta)
        );

        persistTimer = setInterval(function () {
            saveAssessment();
            if (history) history.save();
            if (comparison) comparison.save();
            barometer.persist(write);
        }, 1000 * 60 * 3); //every 3 minutes        
    };

    plugin.stop = function () {
        app.debug('Plugin stopping');
        running = false;
        clearInterval(comparisonTimer);
        comparisonTimer = null;
        if (comparison) comparison.stop();
        comparison = null;
        if (history) history.save();
        history = null;
        display = {};
        clearInterval(persistTimer);
        clearInterval(assessmentTimer);
        saveAssessment();
        assessment = null;
        barometer.persist(write);

        unsubscribes.forEach(f => f());
        unsubscribes = [];
        app.debug('Plugin stopped');
    };

    plugin.schema = schema[0];

    plugin.registerWithRouter = function (router) {
        const viewer = typeof router.access === 'function' ? router.access('readonly') : router;
        viewer.get('/history', (req, res) => {
            const hours = Number(req.query && req.query.hours || 24);
            if (![6, 12, 24, 48].includes(hours)) return res.status(400).json({ error: 'Choose 6, 12, 24 or 48 hours' });
            res.set('Cache-Control', 'no-store');
            const modeValue = path => {
                const leaf = app.getSelfPath && app.getSelfPath(path);
                const value = leaf && leaf.value !== undefined ? leaf.value : leaf;
                return typeof value === 'string' ? value : null;
            };
            res.json({ running, history: history ? history.snapshot(hours) : null, analysis: display, comparison: comparison ? comparison.snapshot(hours) : null,
                display: { environmentMode: modeValue('environment.mode'), navigationState: modeValue('navigation.state') } });
        });
    };

    function sendDelta(deltaValues) {
        if (Array.isArray(deltaValues)) {
            const time = Date.now();
            for (const v of deltaValues) display[v.path] = { value: v.value, time };
        }
        if (deltaValues !== null && deltaValues.length > 0) {
            let signalk_delta = {
                context: "vessels." + app.selfId,
                updates: [
                    {
                        timestamp: new Date().toISOString(),
                        values: deltaValues,
                        meta,
                    }
                ]
            };

            app.handleMessage(plugin.id, signalk_delta);
        }
    }

    function assessmentFilePath() {
        return app.getDataDirPath() + '/local-assessment.json';
    }

    function saveAssessment() {
        if (!assessment) return;
        try {
            const file = assessmentFilePath();
            fs.writeFileSync(file + '.tmp', JSON.stringify(assessment.save()), 'utf8');
            fs.renameSync(file + '.tmp', file);
        } catch (err) {
            app.error('Assessment history could not be saved: ' + err.message);
        }
    }

    function publishAssessment() {
        if (!assessment) return;
        sendDelta([{ path: 'environment.outside.weather.assessment', value: assessment.evaluate() }]);
    }

    function offlineFilePath() {
        return app.getDataDirPath() + "/offline.json";
    }

    function write(json) {
        let content = JSON.stringify(json, null, 2);

        fs.writeFile(offlineFilePath(), content, 'utf8', (err) => {
            if (err) {
                app.debug(err.stack);
                app.error(err);
            } else {
                app.debug("Wrote plugin data to file " + offlineFilePath());
            }
        });
    }

    function read() {
        try {
            const content = fs.readFileSync(offlineFilePath(), 'utf-8');
            return barometer.JSONParser(content);
        } catch (err) {
            if (err.code === 'ENOENT') {
                return [];
            } else {
                app.error("Error reading file: " + err.message);
                app.error(err.stack);
                return [];
            }
        }
    }

    return plugin;
};