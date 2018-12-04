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
      path : '/'+_.trim(req.path, '/'),
      protocol : req.protocol,
      query : req.query
    }),
    Qualifier: req.header('x-Qualifier')
  };
};

functions.map_response_default = function(err, data, res) {
  if (err) {
    winston.error(err);
    res.status(500).send(err);
  } else {
    var payload = !_.isNil(data.Payload) ? JSON.parse(data.Payload) : null;
    var statusCode = _.isEqual(data.StatusCode, 200) && !_.isNull(payload) && !_.isNull(payload.statusCode) ? payload.statusCode : data.StatusCode;
    if (!_.isNil(data.FunctionError)) {
      statusCode = 500;
    }
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
      if (!_.isNil(payload) && !_.isNil(payload.body)) {
        var payload_out = payload.body;
      } else if (!_.isNil(payload)) {
        var payload_out = payload;
      } else {
        var payload_out = null;
      }
      var log_result = data.LogResult;
      if (!_.isNil(log_result)) {
        try {
          var b = new Buffer(log_result, 'base64')
          log_result = b.toString();
        } catch (err) {
          winston.error(err);
        }
      }
      res.json({
        StatusCode: statusCode,
        FunctionError: data.FunctionError,
        LogResult: log_result,
        Payload: payload_out
      });
    }
  }
};

functions.map_response_simple = function(err, data, res) {
  if (err) {
    winston.error(err);
    res.status(500).send(err);
  } else {
    var payload = !_.isNil(data.Payload) ? JSON.parse(data.Payload) : null;
    var statusCode = _.isEqual(data.StatusCode, 200) && !_.isNull(payload) && !_.isNull(payload.statusCode) ? payload.statusCode : data.StatusCode;
    if (!_.isNil(data.FunctionError)) {
      statusCode = 500;
    }
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
      if (!_.isNil(payload) && !_.isNil(payload.body)) {
        var payload_out = payload.body;
      } else if (!_.isNil(payload)) {
        var payload_out = payload;
      } else {
        var payload_out = null;
      }

      res.json(payload_out);
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
functions.invoke = function(options) {
  options = options || {};

  return function invoke(req, res, next) {
    if (_.isNil(req.header('x-FunctionName'))) {
      res.status(400).send("Please provide an AWS Lambda function name in the form of a 'x-FunctionName' header.");
      return next();
    }

    var viewtype = _.isNil(req.header('x-ViewType')) ? 'default' : req.header('x-ViewType')

    options.region = !_.isNil(req.header('x-Region')) ? req.header('x-Region') : 'us-east-1';
    var lambda = new AWS.Lambda(options);
    lambda.invoke(functions.map_request(req), function (err, data) {
      switch(viewtype) {
        case 'simple':
          functions.map_response_simple(err, data, res);
          break;
        case 'default':
        default:
          functions.map_response_default(err, data, res);
      }

      return next();
    });
  }
};

module.exports = functions;
