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

//close all connections
Client.prototype.close = function(){
  for(var i=0;i<this.connections.length;i++){
    this.connections[i].close();
  }
};

//reconnect connections
Client.prototype.reconnect = function(oldConnection){
  // if(!(oldConnection in this.connections)) {
  //   console.error(
  //     'Old connection is not contained in client for reconnect (%s)',
  //     oldConnection
  //   );
  // }
  // if (oldConnection.connectedAt > ((new Date()).getTime() +  (5 * 1000))) {
  //   //only allow one reconnect attempt per 5 second interval
  //   //returning the old connection, because this was likely a concurrent reconnect
  //   // attempt, and perhaps the previous one was successfull
  //   console.warn('Skipping reconnect too early');
  //   return oldConnection;
  // }
  // console.log('Closing old');
  // oldConnection.close();

  // log.Println("Creating new!")
  // con, err := this.createConn()
  // if err != nil {
  //   log.Println("COUldn't create new %s", err)

  //   return oldconn, err
  // }
  // this.connectLock.Lock()
  // this.conn = con
  // this.connectLock.Unlock()

  // log.Println("DONE RECONNECT %s", con)
  // return con, err
};

//does the actual call, returning the connection and the internal request
Client.prototype.doApiCall = function(req, callback){

  //if the request has no txn id create one
  if(!req.txnId()) {
    req.setTxnId(newTxnId());
  }

  //grab a connection from the pool and send the request
  this.connection().send({
    request: req,
    callback: callback
  });

};

//does a batch of api calls and waits for the responses. responses are keyed
Client.prototype.doBatchApiCall = function(reqs, callback){
  //closure scope pointer to the object
  var that = this;

  //key/val map of calls
  var batch = {};

  //the functions to call in the batch
  var parallelCallback = function(req){
    return function(cb){
      that.doApiCall(req, cb);
    };
  };

  //loop over the reqests and setup for parallel
  for(var key in reqs){
    batch[key] = parallelCallback(reqs[key]);
  }

  //run parallel calls
  async.parallel(batch, callback);
};

//export the Client object for this module
module.exports = Client;
