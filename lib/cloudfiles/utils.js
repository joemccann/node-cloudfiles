/*
 * core.js: Core functions for accessing Rackspace CloudFiles
 *
 * (C) 2010 Charlie Robbins
 * MIT LICENSE
 *
 */

require.paths.unshift(require('path').join(__dirname, '..'));

var cloudfiles = require('cloudfiles'),
    sys = require('sys'),
    eyes = require('eyes'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    request = require('request');

var utils = exports;

// Failure HTTP Response codes based
// off Rackspace CloudFiles specification.
var failCodes = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Resize not allowed",
  404: "Item not found",
  409: "Build in progress",
  413: "Over Limit",
  415: "Bad Media Type",
  500: "Fault",
  503: "Service Unavailable"
};

// Export the set of Failure Codes
utils.failCodes = failCodes;

// Success HTTP Response codes based
// off Rackspace CloudFiles specification.
var successCodes = {
  200: "OK",
  202: "Accepted",
  203: "Non-authoritative information",
  204: "No content",
};

// Export the set of Success Codes
utils.successCodes = successCodes;
    
//
// Core method that actually sends requests to Rackspace.
// This method is designed to be flexible w.r.t. arguments 
// and continuation passing given the wide range of different
// requests required to fully implement the CloudFiles API.
// 
// Continuations: 
//   1. 'callback': The callback passed into every node-cloudfiles method
//   2. 'success':  A callback that will only be called on successful requests.
//                  This is used throughout node-cloudfiles to conditionally
//                  do post-request processing such as JSON parsing.
//
// Possible Arguments (1 & 2 are equivalent):
//   1. utils.rackspace('some-fully-qualified-url', callback, success)
//   2. utils.rackspace('GET', 'some-fully-qualified-url', callback, success)
//   3. utils.rackspace('DELETE', 'some-fully-qualified-url', callback, success)
//   4. utils.rackspace({ method: 'POST', uri: 'some-url', body: { some: 'body'} }, callback, success)
//
utils.rackspace = function () {
  var args = Array.prototype.slice.call(arguments),
      success = (typeof(args[args.length - 1]) === 'function') && args.pop(),
      callback = (typeof(args[args.length - 1]) === 'function') && args.pop(),
      uri, method, requestBody;
      
  // Now that we've popped off the two callbacks
  // We can make decisions about other arguments
  if (args.length == 1) {
    
    if(typeof args[0] === 'string') {
      // If we got a string assume that it's the URI 
      method = 'GET';
      uri = args[0];
    }
    else {
      method = args[0]['method'] || 'GET',
      uri = args[0]['uri'];
      requestBody = args[0]['body'];
    }
  }
  else {
    method = args[0];
    uri = args[1];
  }

  var serverOptions = {
    uri: uri,
    method: method,
    headers: {
      'X-AUTH-TOKEN': cloudfiles.config.authToken
    }
  };
  
  if (typeof requestBody !== 'undefined') {
    serverOptions.headers['Content-Type'] = 'application/json';
    serverOptions.body = JSON.stringify(requestBody);
  }

  request(serverOptions, function (err, res, body) {
    if (err) {
      if (callback) {
        callback(err);
      }
      return;
    }
    
    var statusCode = res.statusCode.toString();
    if (Object.keys(failCodes).indexOf(statusCode) !== -1) {
      if (callback) {
        callback(new Error('Rackspace Error (' + statusCode + '): ' + failCodes[statusCode]));
      }
      return;
    }

    success(body, res);
  });
};

var contentTypeOptions = '-i -H "Content-Type: application/json" ';
var authTokenOptions = '-i -H "X-AUTH-TOKEN:{{auth-token}}" ';
var curlOptions = '-X "{{method}}" {{uri}}';

utils.rackspaceCurl = function (method, uri, callback, success) {
  var options = 'curl ', error = '', data = '';
  
  if (method === 'POST') {
    options += contentTypeOptions;
  }
  
  options += authTokenOptions.replace('{{auth-token}}', cloudfiles.config.authToken);
  options += curlOptions.replace('{{method}}', method).replace('{{uri}}', uri);
  
  var child = exec(options, function (error, stdout, stderr) {
    if (error) {
      callback(error);
    }
    
    var statusCode = stdout.match(/HTTP\/1.1\s(\d+)/)[1];
    if (Object.keys(failCodes).indexOf(statusCode.toString()) !== -1) {
      callback(new Error('Rackspace Error (' + statusCode + '): ' + failCodes[statusCode]));
      return;
    }
    
    callback(null, { statusCode: statusCode });
  });
};

//
// Helper method that concats the string params into a url
// to request against the authenticated node-cloudfiles
// storageUrl. 
//
utils.storageUrl = function () {
  var args = args = Array.prototype.slice.call(arguments);
  
  return [cloudservers.config.storageUrl].concat(args).join('/');
};