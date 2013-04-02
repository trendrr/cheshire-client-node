var net = require('net');


var client = new net.Socket();
client.connect('8009', '127.0.0.1', function() {

    console.log('CONNECTED: ' + HOST + ':' + PORT);
    // Write a message to the socket as soon as the client is connected, the server will receive it as message from the client
    client.write('{"strest" : {"v" : 2.0, "user-agent" : "node-strest  1.0", "txn" : {"id" : "t13", "accept" : "single"}, "uri" : "/ping", "method" : "GET", "params" : { "param1" : 12 }}}');
});

// Add a 'data' event handler for the client socket
// data is what the server sent to this socket
client.on('data', function(data) {

    console.log('DATA: ' + data);
    // Close the client socket completely
    client.destroy();

});

// Add a 'close' event handler for the client socket
client.on('close', function() {
    console.log('Connection closed');
});
