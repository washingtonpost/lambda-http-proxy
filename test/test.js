var should = require('should');
var assert = require('assert');
var request = require('supertest');
var winston = require('winston');
var _ = require('lodash');
var app = require('./app');

describe('Test', function(){
    it('missing x-FunctionName', function(done){
        request(app)
            .get('/api')
            .set('Accept', 'application/json')
            .expect(400, "Please provide an AWS Lambda function name in the form of a 'x-FunctionName' header.", done);
    });
    it('invalid region', function(done){
        request(app)
            .get('/api')
            .set('Accept', 'application/json')
            .set('x-Region', 'invalid-region')
            .expect(400, done);
    });
    it('invalid function name', function(done){
        request(app)
            .get('/api')
            .set('Accept', 'application/json')
            .set('x-FunctionName', 'not-found')
            .expect(500, done);
    });
    it('Test request mapping', function(done){
        request(app)
            .post('/map-request?param1=yes&param2=no')
            .set('Accept', 'application/json')
            .set('x-FunctionName', 'function-name')
            .set('x-Qualifier', 'qualifier')
            .set('x-LogType', 'Tail')
            .set('Cookie', 'cookie1=12345667')
            .send({
                foo: 'bar'
            })
            .expect(function (res) {
                winston.info(JSON.stringify(res.body, null, 3));
                assert.equal(res.statusCode, 200, 'statusCode should be 200, was:'+res.statusCode);
                assert.equal(res.body.FunctionName, 'function-name');
                assert.equal(res.body.Qualifier, 'qualifier');
                assert.equal(res.body.LogType, 'Tail');
                var body = JSON.parse(res.body.Payload);
                assert.equal(body.body.foo, 'bar');
                assert.equal(body.path, '/map-request');
                assert.equal(body.url, '/map-request?param1=yes&param2=no');
                assert.equal(body.query.param1, 'yes');
                assert.equal(body.cookies.cookie1, '12345667');
            })
            .end(done);
    });
    it('Test response mapping', function(done){
        request(app)
            .post('/map-response')
            .set('Accept', 'application/json')
            .send({
                data: {
                    StatusCode: 200,
                    FunctionError: 'error',
                    LogResult: 'logresult',
                    Payload: JSON.stringify({foo: 'bar'})
                }
            })
            .expect(function (res) {
                winston.info(JSON.stringify(res.body, null, 3));
                assert.equal(res.statusCode, 200, 'statusCode should be 200, was:'+res.statusCode);
                assert.equal(res.body.StatusCode, 200);
                assert.equal(res.body.FunctionError, 'error');
                assert.equal(res.body.LogResult, 'logresult');
                assert.equal(res.body.Payload.foo, 'bar');
            })
            .end(done);
    });
});