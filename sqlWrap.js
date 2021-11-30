'use strict'

const sql = require('sqlite3');
const util = require('util');


// creates a new database object, not a 
// new database. 
const db = new sql.Database("activities.db");

// check if ActivityTable exists
let cmd = " SELECT name FROM sqlite_master WHERE type='table' AND name='ActivityTable' ";

db.get(cmd, function (err, val) {
  if (val == undefined) {
    console.log("No ActivityTable file - creating one");
    createActivityTable();
  } else {
    console.log("ActivityTable file found");
  }
});

// called to create table if needed
function createActivityTable() {
  // explicitly declaring the rowIdNum protects rowids from changing if the 
  // table is compacted; not an issue here, but good practice
  const cmd = 'CREATE TABLE ActivityTable (rowIdNum INTEGER PRIMARY KEY, userId TEXT, activity TEXT, date INTEGER, amount FLOAT)';
  db.run(cmd, function(err, val) {
    if (err) {
      console.log("ActivityTable creation failure",err.message);
    } else {
      console.log("Created ActivityTable");
    }
  });
}


// check if UserTable exists
let cmd2 = " SELECT name FROM sqlite_master WHERE type='table' AND name='UserTable' ";

db.get(cmd, function (err, val) {
  if (val == undefined) {
    console.log("No UserTable file - creating one");
    createUserTable();
  } else {
    console.log("UserTable file found");
  }
});

function createUserTable() {
  const cmd2 = 'CREATE TABLE UserTable (rowIdNum INTEGER PRIMARY KEY, id TEXT, name TEXT)';
  db.run(cmd2, function(err, val) {
    if (err) {
      console.log("UserTable creation failure",err.message);
    } else {
      console.log("Created UserTable");
    }
  });
}

// wrap all database commands in promises
db.run = util.promisify(db.run);
db.get = util.promisify(db.get);
db.all = util.promisify(db.all);

// empty all data from db
db.deleteEverythingActivity = async function() {
  await db.run("delete from ActivityTable");
  db.run("vacuum");
}

// empty all data from db
db.deleteEverythingUser = async function() {
  await db.run("delete from UserTable");
  db.run("vacuum");
}

db.deleteEverything = async function() {
  await db.run("delete from ActivityTable");
  await db.run("delete from UserTable");
  db.run("vacuum");
}

// allow code in index.js to use the db object
module.exports = db;