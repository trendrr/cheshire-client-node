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
  if(options === undefined){
    options = {};
  }
  this.config = v.extend(
    {
      host: 'localhost',
      port: '8009',
      poolSize: 4,
      pingUri: '/ping'
    },
    options
  );
  this.isClosed = false;
  this.connections = [];
  this.count = 0;
  this.reconnectTimer = null;
  this.connectedTimer = null;
}

//spin up connection pool sockets
Client.prototype.connect = function(callback){

  //fire connected callback once all pooled connections are connected
  this.connectedTimer = setInterval(
    v.bind(this,
      function(){
        var connected = 0;
        for(var i in this.connections){
          if(this.connections[i].connectedAt !== null){
            connected++;
          }
        }
        if(connected === this.config.poolSize){
          clearTimeout(this.connectedTimer);
          callback(null);
        }
      }
    ),
    100
  );

  //spin up the connections
  for(var i=0;i<this.config.poolSize;i++){
    this.addConnection();
  }

  //pool for connections that need to be reconnected
  this.reconnectTimer = setTimeout(v.bind(this, this.reconnect), 5000);

};

Client.prototype.addConnection = function(){
  var conn = new Connection(
    this.config.host,
    this.config.port,
    this.config.pingUri,
    this
  );
  this.connections.push(conn);
  return conn;
};

//get a connection from the pool
Client.prototype.connection = function(){
  index = this.count++ % this.connections.length;
  return this.connections[index];
};

//close all connections
Client.prototype.close = function(){
  clearTimeout(this.reconnectTimer);
  for(var i=0;i<this.connections.length;i++){
    this.connections[i].close();
  }
};

//reconnect connections
Client.prototype.reconnect = function(){

  var pruned = false;

  //loop over connections
  for(var i in this.connections){

    //grab a connection
    var conn = this.connections[i];

    //check if it needs to be reconnected
    if(conn.triggerReconnect){

      console.log('attempting to reconnect');

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
      pruned = true;

      //add new connection
      this.addConnection();

    }
  }

  //check to see if we pruned any connections
  if(pruned){

    //remove the dead connections from the connections array
    this.connections = v.reject(
      this.connections,
      function(conn){
        return (conn === undefined);
      }
    );
  }

  //schedule another reconnect sweep for 5 seconds from now
  this.reconnectTimer = setTimeout(v.bind(this, this.reconnect), 500);
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
  for(var i=0;i<this.config.poolSize;i++){
    var written = false;
    try{
      //grab a connection from the pool and send the request
      written = this.connection().send(config);
    }catch(error){
      console.log(error.stack);
    }
    if(written)break;
  }

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
