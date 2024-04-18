const mongoose = require("mongoose");
require('dotenv').config();

function makeNewConnection(uri) {    
  const db = mongoose.createConnection(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
  });

  db.on('error', function (error) {
      console.log(`MongoDB :: connection ${this.name} ${JSON.stringify(error)}`);
      db.close().catch(() => console.log(`MongoDB :: failed to close connection ${this.name}`));
  });

  db.on('connected', function () {          
      console.log(`MongoDB :: connectado ${this.name}`);
  });

  db.on('disconnected', function () {
      console.log(`MongoDB :: desconectado ${this.name}`);
  });

  return db;
}

const siteConnection = makeNewConnection(process.env.MONGO_SITE);
const mlConnection = makeNewConnection(process.env.MONGO_URI);
const inventoryConnection = makeNewConnection(process.env.MONGO_INVENTORY);

module.exports = {  
  mlConnection,
  inventoryConnection,
  siteConnection
}
  

