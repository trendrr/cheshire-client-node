var Request = require('./request'),
Response = require('./response'),
Connection = require('./connection'),
async = require('async'),
util = require('util'),
strestId = 0;

//create a new unique strest txn id
function newTxnId(){
  strestId = ++strestId;
  return util.format(strestId);
}

/*
 * Chesire client class.
 * based on https://github.com/trendrr/cheshire-golang/blob/master/cheshire/client.go
 * @param  {Object}  options  A object containing the options for this client
 */
function Client(options) {
  var config = v.extend(
    options,
    {
      host: 'localhost',
      port: '8009',
      poolSize: 4,
      pingUri: '/ping'
    }
  );
  this.isClosed = false;
  this.connections = [];
  this.count = 0;
}

//spin up connection pool sockets
Client.prototype.connect = function(){
  for(var i=0;i<this.options.poolSize;i++){
    this.connections.push(new Connection());
  }
};

//get a connection from the pool
Client.prototype.connection = function(){
  index = this.count++ % this.connections.length;
  return this.connections[index];
};

Client.prototype.close = function(){
  for(var i=0;i<this.connections.length;i++){
    this.connections[i].connection.close();
  }
};

Client.prototype.reconnect = function(){

};


//does the actual call, returning the connection and the internal request
Client.prototype.doApiCall = function(req, callback){

  if(req.txnId()) {
    req.setTxnId(newTxnId());
  }

  r = new Request(req);

  var conn = this.connection();

  // if err != nil {
  //   log.Println("Sending error %s", err)
  //   errorChan <- err
  // } else if !conn.connected {
  //   errorChan <- fmt.Errorf("Not connected")
  // } else {
  //   conn.outgoingChan <- r
  // }

};

//does a batch of api calls and waits for the responses. responses are keyed
Client.prototype.doBatchApiCall = function(reqs, callback){
  var that = this;
  var batch = {};

  var parallelCallback = function(req){
    return function(cb){
      that.doApiCall(req, cb);
    };
  };

  for(var key in reqs){
    batch[key] = parallelCallback(reqs[key]);
  }

  async.parallel(reqs, callback);
};

module.exports = Client;

// var client = new net.Socket();
// client.connect(PORT, HOST, function() {

//     console.log('CONNECTED TO: ' + HOST + ':' + PORT);
//     // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client
//     client.write('{"strest" : {"v" : 2.0, "user-agent" : "node-strest  1.0", "txn" : {"id" : "t13", "accept" : "single"}, "uri" : "/ping", "method" : "GET", "params" : { "param1" : 12 }}}');
// });

// // Add a 'data' event handler for the client socket
// // data is what the server sent to this socket
// client.on('data', function(data) {

//     console.log('DATA: ' + data);
//     // Close the client socket completely
//     client.destroy();

// });

// // Add a 'close' event handler for the client socket
// client.on('close', function() {
//     console.log('Connection closed');
// });
