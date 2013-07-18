var net = require('net'),
_ = require('lodash'),
Request = require('./request'),
Response = require('./response'),
util = require('util'),
JsonParse = require('jsonparse'),
strestId = 0;

/*
 * Chesire connection class.
 * @param  {String}  host  A string containing the host address to connect to
 * @param  {String}  port  A string containing the port to connect to
 * @param  {String}  pingUri  A string containing the uri to ping
 */

function Connection(host, port, pingUri) {
  //basic connection config
  this.host = host;
  this.port = port;
  this.pingUri = pingUri;
  this.isClosed = false;
  this.triggerReconnect = false;
  this.connectedAt = null;
  this.pingTimer = null;
  this.timoutTimer = null;

  //holder for open api calls
  this.calls = {};

  //the socket for this connection
  this.socket = new net.Socket();
  this.socket.setEncoding('utf8');
  this.socket.setTimeout(40000);
  this.socket.setKeepAlive(true);

  //the response parser
  this.parser = new JsonParse();

  //initialize the events we will listen for
  this.initEvents();

  //connect the socket
  this.connect();
}

//create a new unique strest txn id
Connection.prototype.newTxnId = function(){
  strestId = ++strestId;
  return util.format(strestId);
};

Connection.prototype.connect = function() {
  this.socket.connect(this.port, this.host);
};

Connection.prototype.initEvents = function() {
  //listen for close event
  this.socket.on('close', _.bind(this.onClose, this));

  //listen for data events
  this.socket.on('data', _.bind(this.onData, this));

  //listen for connect event
  this.socket.on('connect',  _.bind(this.onConnect, this));

  //listen for error event
  this.socket.on('error',  _.bind(this.onError, this));

  //listen for timeout event
  this.socket.on('timeout',  _.bind(this.onTimeout, this));

  this.parser.onValue = _.bind(this.onCompletePacket, this);
};

Connection.prototype.onCompletePacket = function(value) {

  if (this.parser.stack.length === 0) {
    //parse json into response and send to appropriate callback
    var response;
    try{
      response = Response.fromObject(value);
    }catch(e){
      this.triggerReconnect = true;
      this.close();
      console.error('failed to parse response: %s', value);
      console.log(e.stack);
      return;
    }

    if(response.txnId() in this.calls){
      this.calls[response.txnId()].callback(null, response);
      if (response.txnStatus() === 'completed') {
        delete this.calls[response.txnId()];
      }
    }else{
      console.warn(
        'Received response with no request: \n %s', response.toJSON()
      );
    }
  }

};


Connection.prototype.reapTimedOut = function(conf) {

  //loop over all the open calls
  for(var key in this.calls){

    //grab a single time
    var call = this.calls[key];

    //check if current time is later then timeout
    if(Date.now() >= call.timeout){
      console.log('req timeout');

      //send an error response to the callback
      call.callback(
        'timeout',
        call.request.newError(408, 'Request Timeout')
      );

      //delete the call
      delete this.calls[key];

    }
  }

  //schedule next reaping
  this.timoutTime = setTimeout(_.bind(this.reapTimedOut, this), 10000);
};

Connection.prototype.send = function(conf) {
  //add a callback timeout
  conf.timeout = ('timeout' in conf)?conf.timeout:(Date.now() + (10 * 1000));

  //if the request has no txn id create one
  if(!conf.request.txnId()) {
    conf.request.setTxnId(this.newTxnId());
  }

  //test if we can write to the socket
  if(!this.socket.writable){
    console.log('NodeCheshireClient::Connection - attempted to write to closed socket');
    this.triggerReconnect = true;
    this.close();
    return false;
  }

  try{
    //register the callbacks
    this.calls[conf.request.txnId()] = conf;

    //write to the socket
    this.socket.write(conf.request.toJSON());
    return true;
  }catch(error){
    console.log('NodeCheshireClient::Connection - attempted to write to closed socket');
    this.triggerReconnect = true;
    this.close();
    return false;
  }


};

//send a ping
Connection.prototype.ping = function() {
  this.send({
    request: new Request(this.pingUri, 'GET'),
    callback: _.bind(function(err, response){
      if(err && err === 'timeout'){
        this.triggerReconnect = true;
        this.close();
        console.log('Connection - ping timed out closing socket');
        console.log(err.stack);
      }
    }, this)
  });
};

//spin up connection pool sockets
Connection.prototype.close = function() {
  //clean up the timers
  clearInterval(this.pingTimer);
  clearTimeout(this.timoutTime);

  this.socket.destroy();
  this.isClosed = true;
};

Connection.prototype.onClose = function(had_error) {
  if(had_error)console.log('Connection::onClose triggered by error');
  for(var key in this.calls){
    var call = this.calls[key];
    call.callback(
      'socket closed',
      call.request.newError(500, 'Socket closed')
    );
  }
  this.calls = {};
};

Connection.prototype.onData = function(data) {
  this.parser.write(data);
};

Connection.prototype.onConnect = function() {
  //set the is closed flag to false
  this.isClosed = false;

  //set connected at timestamp
  this.connectedAt = Date.now();

  //send first ping
  this.ping();

  //schedule 30 second pings
  this.pingTimer = setInterval(_.bind(this.ping, this), 30000);
};

Connection.prototype.onError = function(error) {
  console.error(error.stack);
  this.triggerReconnect = true;
};

Connection.prototype.onTimeout = function() {
  console.error('socket timeout');
  this.triggerReconnect = true;
};

Connection.prototype.toString = function() {
  var info = this.socket.address();
  return info.address + ':' + info.port;
};

//Export the Connection object
module.exports = Connection;
