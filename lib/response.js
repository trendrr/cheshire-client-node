var pkg = require('../package.json');

// Standard STREST response
// See protocol spec https://github.com/trendrr/strest-server/wiki/STREST-Protocol-Spec
function Response() {
  //Create a new response object and set defaults
  this.strest = {
    v: pkg.config.strest_version,
    txn: {
      id: '',
      status: 'completed'
    }
  };
  this.status = {
    code: 200,
    message: 'OK'
  };
}


/*
* Helper methods
*/

Response.prototype.toJSON = function(){
  return JSON.stringify(this);
};

Response.fromJSON = function(json){
  if(json instanceof String){
    json = JSON.parse(json);
  }
  var inst = new Response();
  inst.status = json.status;
  inst.strest = json.strest;
  return inst;
};


/*
* Data accessor methods
*/

//Get the txn id
Response.prototype.txnId = function() {
  return this.strest.txn;
};

//Set the txn id
Response.prototype.setTxnId = function(id) {
  this.strest.txn.id = id;
};

//Get the txn status
Response.prototype.txnStatus = function() {
  return this.strest.txn.status;
};

//Set the txn status to complete or continue
Response.prototype.setTxnStatus = function(status) {
  this.strest.txn.status = status;
};

//Set the response status
Response.prototype.setStatus = function(code, message) {
  this.setStatusCode(code);
  this.setStatusMessage(message);
};

//Get the response status code
Response.prototype.statusCode = function() {
  return (this.status.code)?this.status.code:200;
};

//Set the response status code
Response.prototype.setStatusCode = function(code) {
  this.status.code = code;
};

//Get the status message
Response.prototype.statusMessage = function() {
  return this.status.message;
};

//Set the status messages
Response.prototype.setStatusMessage = function(message) {
  this.status.message = message;
};

//Export the Response object
module.exports = Response;
