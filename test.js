var Client = require('./lib/client'),
Request = require('./lib/request'),
argv = require('optimist').argv;

var client = new Client();

if(argv.m === 'firehose'){
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected');
      req = new Request('/firehose', 'GET');
      req.setTxnAcceptMulti();
      client.doApiCall(
        req,
        function(err, response){
          console.log(response);
        }
      );
    }
  });
}else{
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected');
      req = new Request('/ping', 'GET');
      client.doApiCall(
        req,
        function(err, response){
          console.log(response);
        }
      );
    }
  });
}



