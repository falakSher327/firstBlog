const mongoose = require("mongoose");
const { MONGO_DB_CONNECTION_STRING } = require("../config/index");

const dbConnect = async () => {
  try {
    const db = await mongoose.connect(MONGO_DB_CONNECTION_STRING);
    console.log(`database is connected to ${db.connection.host}`);
  } catch (error) {
    console.log(`Error:${error}`);
  }
};
module.exports = dbConnect;
