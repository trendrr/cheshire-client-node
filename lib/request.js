var pkg = require('../package.json');

/*
 * Standard STREST request.
 * See protocol spec https://github.com/trendrr/strest-server/wiki/STREST-Protocol-Spec
 */
function Request(uri, method) {
  //set default strest values
  this.strest = {
    params: {},
    v: pkg.config.strest_version,
    uri: uri,
    method: method,
    'user-agent' : 'cheshire-client-node',
    txn: {
      accept: 'single'
    }
  };
}


/*
* Helper methods
*/

//Creates a new response based on this request and auto fills the txn id
Request.prototype.newResponse = function() {
  var response = new Response();
  response.setTxnId(this.txnId());
  return response;
};

//Creates a new error response based on this request and auto fills the txn id
Request.prototype.newError = function(code, message) {
  var response = this.newResponse();
  response.setStatus(code, message);
  return response;
};

//Get request as json
Request.prototype.toJSON = function(){
  return JSON.stringify({
    strest: this.strest
  });
};


/*
* Data accessor methods
*/

//Get the request method
Request.prototype.method = function(){
  return this.strest.method;
};

//Set the request method
Request.prototype.setMethod = function(method) {
  this.strest.method = method;
};

//Get the url for this request
Request.prototype.uri = function() {
  return this.strest.uri;
};

//Set the uri for the request
Request.prototype.setUri = function(uri) {
  this.strest.uri = uri;
};

//Get the request parameters. Defaults to empty object
Request.prototype.params = function(){
  var params = this.strest.params;
  if(!params){
    this.strest.params = params = {};
  }
  return params;
};

//Set the request parameters
Request.prototype.setParams = function(params) {
  this.strest.params = params;
};

//Get the txn id
Request.prototype.txnId = function() {
  return this.strest.txn.id;
};

//Set the txn id
Request.prototype.setTxnId = function(id) {
  this.strest.txn.id = id;
};

//Get the txn accept val. Defaults to: single
Request.prototype.txnAccept = function() {
  return this.strest.txn.accept?this.strest.txn.accept:'single';
};

//Set to either 'single' or 'multi'
Request.prototype.setTxnAccept = function(accept) {
  this.strest.txn.accept = accept;
};

//This request will accept multiple responses
Request.prototype.setTxnAcceptMulti = function() {
  this.setTxnAccept('multi');
};

//This request will only accept a single response
Request.prototype.setTxnAcceptSingle = function() {
  this.setTxnAccept('single');
};

//Export the Request object
module.exports = Request;
