var net = require('net');

//wrap the socket

/*
 * Chesire connection class.
 * based on https://github.com/trendrr/cheshire-golang/blob/master/cheshire/client.go
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
  this.connectedAt = (new Date()).getTime();

  //holder for open api calls
  this.calls = {};

  //vars for data packet parsing
  this.openBrackets = 0;
  this.buffer = '';
  this.prevChar = '';
  this.isQuoted = false;
  this.maxBufferSize = 65535;

  //the socket for this connection
  this.socket = new net.Socket();

  //initialize the events we will listen for
  this.initEvents();

  //connect the socket
  this.connect();
}

Connection.prototype.connect = function() {
  this.socket.connect(this.port, this.host);
};

Connection.prototype.initEvents = function() {
  //listen for close event
  this.socket.on('close', this.onClose);

  //listen for data events
  this.socket.on('data', this.onData);

  //listen for connect event
  this.socket.on('connect', this.onConnect);

  //listen for error event
  this.socket.on('error', this.onError);

  //listen for timeout event
  this.socket.on('timeout', this.onTimeout);
};

Connection.prototype.send = function(conf) {
  //register the callbacks
  this.requests[conf.request.txnId()] = conf;
  this.socket.write(conf.request.toJSON());
};

Connection.prototype.ping = function() {
  this.socket.write(new Request(this.pingUri, 'GET'));
};

//spin up connection pool sockets
Connection.prototype.close = function() {
  this.socket.destroy();
};

Connection.prototype.onClose = function() {
  console.log('close');
  this.isClosed = true;
};

Connection.prototype.onData = function(data) {
  //iterate over each character
  for (var c in data) {
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
          console.log('failed to parse response: %s', this.buffer);
        }
        if(response.txnId() in this.calls){
          var call = this.calls[response.txnId()];
          if(!response){
            response = call.request.newError(500, 'Invalid response');
          }
          call.callback(response);
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
  //now that we are connected, schedule periodic pings
  setInterval(this.ping, 500);
};

Connection.prototype.onError = function() {
  console.log('error');
  this.isClosed = true;
};

Connection.prototype.onTimeout = function() {
  console.log('timeout');
  this.isClosed = true;
};

Connection.prototype.toString = function() {
  var info = this.socket.address();
  return info.address + ':' + info.port;
};

//Export the Connection object
module.exports = Connection;
