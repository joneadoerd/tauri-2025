const zeromq = require('zeromq');

async function runMockSensor() {
  // Register with the server
  const reqSocket = new zeromq.Request();
  reqSocket.connect("tcp://localhost:5555");
  
  await reqSocket.send("REGISTER");
  const [sensorId] = await reqSocket.receive();
  console.log(`Registered as ${sensorId.toString()}`);
  
  // Subscribe to commands for this specific sensor
  const cmdSocket = new zeromq.Subscriber();
  cmdSocket.connect("tcp://localhost:5557");
  cmdSocket.subscribe(sensorId.toString());
  
  // Simulate sending data
  const dataInterval = setInterval(async () => {
    const value = Math.random() * 100;
    const data = JSON.stringify({
      sensor_id: sensorId.toString(),
      value,
      timestamp: Date.now()
    });
    
    await reqSocket.send(`DATA:${data}`);
    const [ack] = await reqSocket.receive(); // Wait for ACK
    console.log(`Sent data: ${value.toFixed(2)}`);
  }, 1000 + Math.random() * 2000);
  
  // Handle commands
  (async () => {
    for await (const [topic, cmd] of cmdSocket) {
      console.log(`COMMAND RECEIVED: ${cmd.toString()}`);
      // Implement your command handling logic here
    }
  })();
  
  // Cleanup on exit
  process.on('SIGINT', async () => {
    clearInterval(dataInterval);
    await reqSocket.send(`UNREGISTER:${sensorId.toString()}`);
    await reqSocket.receive();
    reqSocket.close();
    cmdSocket.close();
    process.exit(0);
  });
}

runMockSensor().catch(console.error);