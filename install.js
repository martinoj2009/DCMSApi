/*
Martino Jones
20170629
This file is for installing and configuring the API for the blog
*/

var sqlite3 = require('sqlite3');
fs = require('fs');
var util = require('util');
var crypto = require('crypto');


// Check to see if a config file exists, if it does check if they want to overwrite it
if (fs.existsSync('./config.json')) {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    console.log("I see you have a config file, would you like to overwrite it? If not I will try to use it.");

    process.stdin.on('data', function (text) {
        if (text === 'yes\n' || text === 'y\n') {
            fs.writeFile('./config.json', '', function () {
                console.log('File erased!')
                buildConfig();
            })
        } else {
            buildConfig();
        }
    });
}

function buildConfig() {
    // Open config file and start building it
    try
    {
        var configFile = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    }
    catch(e)
    {
        console.log('Config file invalid format, starting from scratch...\n\n');
        //console.log(e);
        //process.exit();
        configFile = {};
    }

    console.log('Starting to build the config file');

    // Database file
    if (configFile.Database_Location === undefined) {
        configFile.Database_Location = 'blog.sqlite3';
    }

    // Make password salt
    if (configFile.Pasword_Salt === undefined) {
        configFile.Pasword_Salt = crypto.randomBytes(64).toString('hex');
    }


    // JSON web token
    if (configFile.JSON_Web_Token_Secret === undefined) {
        configFile.JSON_Web_Token_Secret = crypto.randomBytes(64).toString('hex');
    }

    if (configFile.Server_Name === undefined) {
        configFile.Server_Name = 'My Blog';
    }

    // Server port
    if(!configFile.Server_Port)
    {
        configFile.Server_Port = '8000';
    }

    let content = JSON.stringify(configFile);
    // Write to file
    fs.writeFile('./config.json', content, 'utf8',function(err, data)
        {
            if(err)
            {
                console.error('Error writing to file!');
                console.error(err);
                process.exit();
            }
            else
            {
                // Building done
                console.log('Done building config file!');
                console.log(configFile);
                process.exit();
            }
        });

}