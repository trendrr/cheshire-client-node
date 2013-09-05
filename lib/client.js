var Request = require('./request'),
Response = require('./response'),
Connection = require('./connection'),
async = require('async'),
GenericPool = require('generic-pool'),
_ = require('lodash');


/*
 * Chesire client class.
 * based on https://github.com/trendrr/cheshire-golang/blob/master/cheshire/client.go
 * @param  {Object}  options  A object containing the options for this client
 */
function Client(options) {
  if(options === undefined){
    options = {};
  }
  this.config = _.extend(
    {
      host: 'localhost',
      port: '8009',
      poolSize: 10,
      poolSizeMin: 2,
      pingUri: '/ping'
    },
    options
  );
  this.pool = null;
}

//spin up connection pool sockets
Client.prototype.connect = function(callback){
  this.initConnectionPool();
};

//initialize connection pool
Client.prototype.initConnectionPool = function(){
  var that = this;
  this.pool = GenericPool.Pool({
    name     : 'cheshire',
    create   : function(callback) {
        var c = new Connection(
          that.config.host,
          that.config.port,
          that.config.pingUri,
          that
        );
        callback(null, c);
    },
    validate : function(connection) {
      return (connection.triggerReconnect === false);
    },
    destroy  : function(connection) { connection.close(); },
    max      : that.config.poolSize,
    min      : that.config.poolSizeMin,
    idleTimeoutMillis : 30000,
    log : false
  });
}

//close all connections
Client.prototype.close = function(){
  // clearTimeout(this.reconnectTimer);
  // for(var i=0;i<this.connections.length;i++){
  //   this.connections[i].close();
  // }
  var that = this;
  this.pool.drain(function() {
    that.pool.destroyAllNow();
  });
};

//does the actual call, returning the connection and the internal request
Client.prototype.doApiCall = function(req, callback, timeout){

  var that = this;

  //define the config for the api call
  var config = {
    request: req,
    callback: callback
  };

  //if a timeout was passed in add it to the conf
  if(timeout !== undefined){
    config.timeout = timeout;
  }

  // acquire connection - callback function is called
  // once a resource becomes available
  this.pool.acquire(function(err, connection) {
    if (err) {
      console.log(error.stack);
    } else {
      config.callback = function(err, response){
        that.pool.release(connection);
        callback(err, response);
      }
      written = connection.send(config);
      if(!written){
        console.log('Failed to write to socket.');
      }
    }
  });



  // for(var i=0;i<this.config.poolSize;i++){
  //   var written = false;
  //   try{
  //     //grab a connection from the pool and send the request
  //     written = this.connection().send(config);
  //   }catch(error){
  //     console.log(error.stack);
  //   }
  //   if(written){
  //     break;
  //   }else{
  //     console.log('Failed to write to socket. Trying new connection');
  //   }
  // }

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
