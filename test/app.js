var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var lambda_http_proxy = require('../index');
var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.all('/api', lambda_http_proxy.invoke);
app.all('/map-request', function(req, res, next) {
    res.status(200);
    res.json(lambda_http_proxy.map_request(req));
});
app.all('/map-response', function(req, res, next) {
    lambda_http_proxy.map_response(req.body.err, req.body.data, res);
});

app.set('port', 3000);
module.exports = app;