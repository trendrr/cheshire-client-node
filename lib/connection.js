var net = require('net'),
v = require('valentine'),
Request = require('./request'),
Response = require('./response'),
util = require('util');


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
  this.strestId = 0;
  this.pingUri = pingUri;
  this.isClosed = false;
  this.triggerReconnect = false;
  this.connectedAt = null;
  this.pingTimer = null;
  this.timoutTimer = null;

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

    //check if current time is later then timeout
    if(Date.now() >= call.timeout){

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
  this.timoutTime = setTimeout(v.bind(this, this.reapTimedOut), 10000);
};

Connection.prototype.send = function(conf) {
  //add a callback timeout
  conf.timeout = ('timeout' in conf)?conf.timeout:(Date.now() + (10 * 1000));

  //if the request has no txn id create one
  if(!conf.request.txnId()) {
    conf.request.setTxnId(this.newTxnId());
  }

  //register the callbacks
  this.calls[conf.request.txnId()] = conf;
  this.socket.write(conf.request.toJSON());
};

//send a ping
Connection.prototype.ping = function() {
  this.send({
    request: new Request(this.pingUri, 'GET'),
    callback: v.bind(this, function(err, response){
      if(err && err === 'timeout'){
        console.log(err);
        this.triggerReconnect = true;
        this.close();
      }else{
        //console.log(response);
      }
    })
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

Connection.prototype.onClose = function() {
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
  //iterate over each character
  for (var i = 0; i < data.length; i += 1) {
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
  this.isClosed = false;
  this.connectedAt = Date.now();

  //now that we are connected, ping once and schedule 30 second pings
  this.ping();
  this.pingTimer = setInterval(v.bind(this, this.ping), 30000);
};

Connection.prototype.onError = function(e) {
  console.error(e);
  console.error(e.stack);
  this.triggerReconnect = true;
  this.close();
};

Connection.prototype.onTimeout = function() {
  console.error('socket timeout');
  this.triggerReconnect = true;
  this.close();
};

Connection.prototype.toString = function() {
  var info = this.socket.address();
  return info.address + ':' + info.port;
};

//Export the Connection object
module.exports = Connection;
