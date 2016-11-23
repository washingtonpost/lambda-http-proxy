'use strict';
var AWS = require('aws-sdk');
var winston = require('winston');
var _ = require('lodash');

var functions = {};

/**
 * Map the http request into a lambda request.
 * Assumes the following express.js middlewares have been added:
 * - https://github.com/expressjs/cookie-parser
 * - https://www.npmjs.org/package/body-parser
 *   - app.use(bodyParser.json()); // for parsing application/json
 *   - app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
 *
 * @param req
 * @returns {{FunctionName, Payload}}
 */
functions.map_request = function(req) {
    var log_type = !_.isNil(req.header('x-LogType')) ? req.header('x-LogType') : 'None';
    return {
        FunctionName: req.header('x-FunctionName'),
        InvocationType: 'RequestResponse',
        LogType: log_type,
        Payload: JSON.stringify({
            method: req.method,
            headers: req.headers,
            body : req.body,
            cookies : req.cookies,
            url : req.originalUrl,
            path : req.path,
            protocol : req.protocol,
            query : req.query
        }),
        Qualifier: req.header('x-Qualifier')
    };
};

functions.map_response = function(err, data, res) {
    if (err) {
        winston.error(err);
        res.status(500).send(err);
    } else {
        var payload = !_.isNil(data.Payload) ? JSON.parse(data.Payload) : null;
        var statusCode = _.isEqual(data.StatusCode, 200) && !_.isNull(payload) ? payload.statusCode : data.StatusCode;
        res.status(statusCode);
        if (!_.isNil(payload) && !_.isNil(payload.headers) && !_.isEmpty(payload.headers)) {
            res.set(payload.headers);
        }
        if (!_.isNil(payload) && !_.isNil(payload.cookies) && !_.isEmpty(payload.cookies)) {
            _.forEach(payload.cookies, function(cookie) {
               res.cookie(cookie.name, cookie.value, cookie.options);
            });
        }
        if (!_.isNil(payload) && !_.isNil(payload.redirect)) {
            res.redirect(statusCode, payload.redirect);
        } else {
            res.json({
                StatusCode: statusCode,
                FunctionError: data.FunctionError,
                LogResult: data.LogResult,
                Payload: !_.isNil(payload) && !_.isNil(payload.body) ? payload.body : null
            });
        }
    }
};

/**
 * Proxy the express.js req/res to an AWS Lambda call.
 *
 * @param req
 * @param res
 * @param callback
 */
functions.invoke = function (req, res, next) {
    if (_.isNil(req.header('x-FunctionName'))) {
        res.status(400).send("Please provide an AWS Lambda function name in the form of a 'x-FunctionName' header.");
        return next();
    }
    var region = !_.isNil(req.header('x-Region')) ? req.header('x-Region') : 'us-east-1';
    var lambda = new AWS.Lambda({region:region});
    lambda.invoke(functions.map_request(req), function (err, data) {
        functions.map_response(err, data, res);
        return next();
    });
};

module.exports = functions;