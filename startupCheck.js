// This is for sanity checks before starting the API

var sqlite3 = require('sqlite3');


// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) {
	console.log('Error reading in config file!')
	process.exit();
}

// SQLite3 functions
var db = new sqlite3.cached.Database(config.Database_Location);

function startupCheck()
{
    console.log('Startup Check loaded.');
}

function checkregisterLimitTable()
{

}


startupCheck.prototype.startupCheck = function()
{

}

module.exports = startupCheck;