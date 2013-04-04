var Request = require('./request'),
Response = require('./response'),
Connection = require('./connection'),
async = require('async'),
v = require('valentine');



/*
 * Chesire client class.
 * based on https://github.com/trendrr/cheshire-golang/blob/master/cheshire/client.go
 * @param  {Object}  options  A object containing the options for this client
 */
function Client(options) {
  this.config = v.extend(
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
  for(var i=0;i<this.config.poolSize;i++){
    this.addConnection();
  }
  setInterval(v.bind(this, this.reconnect), 5000);
};

Client.prototype.addConnection = function(){
  this.connections.push(
    new Connection(
      this.config.host,
      this.config.port,
      this.config.pingUri,
      this
    )
  );
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
Client.prototype.reconnect = function(){
  console.log('in reconnect');

  //loop over connections
  for(var i in this.connections){

    //grab a connection
    var conn = this.connections[i];

    //check if it needs to be reconnected
    if(conn.triggerReconnect){

      //only allow one reconnect attempt per 5 second interval
      //returning the old connection, because this was likely a concurrent reconnect
      // attempt, and perhaps the previous one was successfull
      if(conn.connectedAt >= (Date.now() + (5 * 1000))) {
        console.warn('Skipping reconnect too early');
        return conn;
      }

      //make sure its closed
      if(!conn.isClosed)conn.close();

      //delete this connection
      delete this.connections[i];

      //add new connection
      this.addConnection();

    }
  }

};

//does the actual call, returning the connection and the internal request
Client.prototype.doApiCall = function(req, callback, timeout){

  //define the config for the api call
  var config = {
    request: req,
    callback: callback
  };

  //if a timeout was passed in add it to the conf
  if(timeout !== undefined){
    config.timeout = timeout;
  }

  //grab a connection from the pool and send the request
  this.connection().send(config);

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
