var net = require('net'),
v = require('valentine'),
Request = require('./request'),
Response = require('./response'),
util = require('util');


/*
 * Chesire connection class.
 * based on https://github.com/trendrr/cheshire-golang/blob/master/cheshire/client.go
 * @param  {String}  host  A string containing the host address to connect to
 * @param  {String}  port  A string containing the port to connect to
 * @param  {String}  pingUri  A string containing the uri to ping
 */

function Connection(host, port, pingUri, client) {
  //basic connection config
  this.host = host;
  this.port = port;
  this.strestId = 0;
  this.client = client;
  this.pingUri = pingUri;
  this.isClosed = false;
  this.triggerReconnect = false;
  this.connectedAt = null;

  //holder for open api calls
  this.calls = {};

  //vars for data packet parsing
  this.openBrackets = 0;
  this.buffer = '';
  this.prevChar = '';
  this.isQuoted = false;
  this.maxBufferSize = 3145728; //3MB

  //the socket for this connection
  this.socket = new net.Socket();
  this.socket.setEncoding('utf8');

  //initialize the events we will listen for
  this.initEvents();

  //connect the socket
  this.connect();
}

//create a new unique strest txn id
Connection.prototype.newTxnId = function(){
  this.strestId = ++this.strestId;
  return util.format(this.strestId);
};

Connection.prototype.connect = function() {
  this.socket.connect(this.port, this.host);
};

Connection.prototype.initEvents = function() {
  //listen for close event
  this.socket.on('close', v.bind(this, this.onClose));

  //listen for data events
  this.socket.on('data',  v.bind(this, this.onData));

  //listen for connect event
  this.socket.on('connect',  v.bind(this, this.onConnect));

  //listen for error event
  this.socket.on('error',  v.bind(this, this.onError));

  //listen for timeout event
  this.socket.on('timeout',  v.bind(this, this.onTimeout));
};

Connection.prototype.reapTimedOut = function(conf) {
  //loop over all the open calls
  for(var key in this.calls){

    //grab a single time
    var call = this.calls[key];

    //grab current time
    var now = (Date.now()).getTime();

    //check if now is later then timeout
    if(now >= call.timeout){

      //send an error response to the callback
      call.callback(call.request.newError(408, 'Request Timeout'));

      //delete the call
      delete this.calls[key];

    }

  }
};

Connection.prototype.send = function(conf) {
  //add a callback timeout
  var now = (new Date()).getTime();
  conf.timeout = ('timeout' in conf)?conf.timeout:(now + (10 * 1000));

  //if the request has no txn id create one
  if(!conf.request.txnId()) {
    conf.request.setTxnId(this.newTxnId());
  }

  //register the callbacks
  this.calls[conf.request.txnId()] = conf;
  this.socket.write(conf.request.toJSON());
};

Connection.prototype.ping = function() {
  this.client.doApiCall(
    new Request(this.pingUri, 'GET'),
    function(err, response){
      if(err)console.log(err);
      console.log(response);
    }
  );
};

//spin up connection pool sockets
Connection.prototype.close = function() {
  this.socket.destroy();
  this.isClosed = true;
  if(this.triggerReconnect){
    this.client.reconnect();
  }
};

//spin up connection pool sockets
Connection.prototype.reconnect = function() {
  this.client.reconnect();
};

Connection.prototype.onClose = function() {
  console.log('closed');
  for(var key in this.calls){
    var call = this.calls[key];
    call.callback(call.request.newError(500, 'Socket closed'));
  }
  this.calls = {};
};

Connection.prototype.onData = function(data) {
  //iterate over each character
  for (var i in data) {
    var c = data.charAt(i);
    this.buffer += c;
    if (c === '"') {
      if (this.isQuoted && this.prevChar != '\\') {
        this.isQuoted = false;
      } else {
        this.isQuoted = true;
      }
    }
    this.prevChar = c;
    if (this.isQuoted) {
      continue;
    }
    if (c === '{') {
      this.openBrackets++;
    }
    if (c === '}') {
      this.openBrackets--;
      if (this.openBrackets === 0) {
        //at this point we have a complete packet.


        //parse json into response and send to appropriate callback
        var response;
        try{
          response = Response.fromJSON(this.buffer);
        }catch(e){
          console.error('failed to parse response: %s', this.buffer);
          this.close();
          return;
        }

        if(response.txnId() in this.calls){
          this.calls[response.txnId()].callback(null, response);
          if (response.txnStatus() === 'completed') {
            delete this.calls[response.txnId()];
          }
        }else{
          console.warn('Received response, but had no request. Response: \n %s', response.toJSON());
        }
        this.buffer = '';
      }
    }
  }

  //sanity check buffer size. if greater then max threshold, disconnect throw error
  if(this.buffer.length > this.maxBufferSize){
    this.close();
    throw 'Connection buffer exceeds maximum size. Check for valid packets.';
  }

};

Connection.prototype.onConnect = function() {
  console.log('connected');
  this.isClosed = false;
  this.connectedAt = Date.now();

  //now that we are connected, ping once and schedule 30 second pings
  this.ping();
  setInterval(v.bind(this, this.ping), 5000);

  //every ten seconds poll our calls map to timeout stalled calls
  setInterval(v.bind(this, this.reapTimedOut), 10000);
};

Connection.prototype.onError = function() {
  console.log('error');
  this.triggerReconnect = true;
  this.close();
};

Connection.prototype.onTimeout = function() {
  console.log('timeout');
  this.triggerReconnect = true;
  this.close();
};

Connection.prototype.toString = function() {
  var info = this.socket.address();
  return info.address + ':' + info.port;
};

//Export the Connection object
module.exports = Connection;
