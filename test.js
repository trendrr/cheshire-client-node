var Client = require('./lib/client'),
Request = require('./lib/request'),
argv = require('optimist')
  .usage('Test the node cheshire client.\nUsage: $0 --m single|firehose|batch|loop')
  .demand('m')
  .alias('m', 'mode')
  .describe('m', 'Mode to test')
  .argv;

var client = new Client();

if(argv.m === 'firehose'){
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected: testing firehose...');
      var req = new Request('/firehose', 'GET');
      req.setTxnAcceptMulti();
      client.doApiCall(
        req,
        function(err, response){
          console.log(response);
          if(response.iteration === 50){
            console.log('Ok you get the point! 50 iterations succesfull. Bye...');
            client.close();
          }
        }
      );
    }
  });
}else if(argv.m === 'batch'){
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected: testing batch...');
      var reqs = {
        req1: new Request('/ping', 'GET'),
        req2: new Request('/ping', 'GET'),
        req3: new Request('/ping', 'GET'),
        req4: new Request('/ping', 'GET')
      };
      client.doBatchApiCall(
        reqs,
        function(err, response){
          console.log(response);
        }
      );
    }
  });
}else if(argv.m === 'single'){
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected: testing single...');
      client.doApiCall(
        new Request('/ping', 'GET'),
        function(err, response){
          console.log(response);
          client.close();
        }
      );
    }
  });
}else if(argv.m === 'loop'){
  client.connect(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Client connected: ping loop...');
      pingTimer = setInterval(function(){
        client.doApiCall(
          new Request('/ping', 'GET'),
          function(err, response){
            console.log(response);
            console.log(response.strest.txn);
          }
        );
      }, 2000);
    }
  });
}



