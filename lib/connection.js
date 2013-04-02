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
  this.host = host;
  this.port = port;
  this.pingUri = pingUri;
  this.socket = new net.Socket();
  this.initEvents();
  this.connect();
  this.callbacks = {};
  this.buffer = '';
}

Connection.prototype.connect = function(){
  this.socket.connect(this.port, this.host);
};

Connection.prototype.initEvents = function(){
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

Connection.prototype.send = function(request){
  //register the callbacks
  this.callbacks[request.txnId()] = {
      'onmessage' : message_callback,
      'ontxncomplete' : txn_complete_callback,
      'onerror' : error_callback
  };
  this.socket.write(request.toJSON());
};

Connection.prototype.ping = function(){
  this.socket.write(new Request(this.pingUri, 'GET'));
};

//spin up connection pool sockets
Connection.prototype.close = function(){
  this.socket.destroy();
};

Connection.prototype.onClose = function(){
  console.log('close');
};

Connection.prototype.onData = function(data){
  console.log('data');

  var respObj;
  try{
    if(this.buffer !== ''){
      data = this.buffer+data;
    }
    respObj = JSON.parse(data);
    this.buffer = '';
  }catch(e){
    this.buffer = data;
  }

  // var response = new Response();

  // response.fromJSON(JSON.parse(data));

  // req, ok := this.requests[response.TxnId()]
  // if !ok {
  //       log.Printf("Uhh, received response, but had no request %s", response)
  //       // for k,_ := range(this.requests) {
  //       //     log.Println(k)
  //       // }
  //       continue //break?
  //     }
  //     req.resultChan <- response
  //     //remove if txn is finished..
  //     if response.TxnStatus() == "completed" {
  //       delete(this.requests, response.TxnId())
  //     }

  //TODO check if data is a ping and if so schedule the next one
};

Connection.prototype.onConnect = function(){
  console.log('connect');

  //now that we are connected, schedule periodic pings
  setTimeout(this.ping, 500);
};

Connection.prototype.onError = function(){
  console.log('error');
};

Connection.prototype.onTimeout = function(){
  console.log('timeout');
};

Connection.prototype.toString = function(){
  var info = this.socket.address();
  return info.address + ':' + info.port;
};

//Export the Connection object
module.exports = Connection;
