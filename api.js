/*
DCMS - API
Author: Martino Jones
20170601
This is the API for the blog. This API should never serve HTML/CSS/IMAGE/MULTIMEDIA, it's job is to access a DB
when needed and serve JSON data. This API also controls the state of the application, the web application should be 
stateless. 
*/

// Get the needed NPM packages
var restify = require('restify'),
fs = require('fs');
var sqlite3 = require('sqlite3');
var jwt = require('jsonwebtoken');
var pbkdf2 = require('pbkdf2');


// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) {
	console.log('Error reading in config file!')
	process.exit();
}

// Setup needed security
if (config.Pasword_Salt === undefined || config.JSON_Web_Token_Secret === undefined || config.Password_Min_Length === undefined) {
	console.log('Whoa! security needs to be setup. Check to make sure you have sale and secret setup')
	process.exit();
}
var salt = config.Pasword_Salt;
var secret = config.JSON_Web_Token_Secret;


// Configure restify server
var server = restify.createServer({
	name: config.Server_Name,
});
server.use(restify.bodyParser());

// Rate limit some config, only applies when you specify
var rateLimitStrict = restify.throttle({burst:1,rate:1,ip:true});
var rateLimitLight = restify.throttle({burst:100,rate:50,ip:true});

// SQLite3 functions
var db = new sqlite3.cached.Database(config.Database_Location);

// Functions
function verifyUser(callback, username, password) {
	var derivedKey = pbkdf2.pbkdf2Sync(password, salt, 1, 32, 'sha256');
	password = derivedKey.toString('hex');

	var query = db.all("select username from auth_user where username == ? and password == ?", [username, password], function (err, data) {
		callback(data);
	});

}

function verifyUsername(callback, username) {
	db.all("select username from auth_user where username == ?", username, function (err, data) {
		if (!data || data[0] === undefined || data[0] === null) {
			callback(false);
		} else {
			callback(true);
		}
	})
}

function createUser(callback, username, password, email, firstname, lastname, isActive, isAdmin) {
	// Hash password
	var derivedKey = pbkdf2.pbkdf2Sync(password, salt, 1, 32, 'sha256');
	password = derivedKey.toString('hex');

	// TODO
	db.run("INSERT OR IGNORE INTO auth_user (username, password, email, first_name, last_name, is_active, is_admin) VALUES (?,?,?,?,?,?,?)", [username, password, email, firstname, lastname, isActive, isAdmin], function (err, data) {
		if (err) {
			console.log(err);
			callback(false);
		} else {
			callback(true);
		}
	});
}

function getPosts(callback, offset) {
	if (offset === undefined) {
		offset = 0;
	}

	db.all("select id,post_title,post_short,post_date from blog_status limit 5 offset " + offset, function (err, rows) {
		callback(rows);
	})
};

function getArticle(callback, id) {
	db.all("select * from blog_status where id == " + id, function (err, rows) {
		callback(rows);
	})
};

function getAlerts(callback) {
	//This function is for getting any alerts that should be posted to the page
	db.all("select * from alerts limit 1", function (err, rows) {
		if (err) {
			callback(undefined);
			return;
		}
		callback(rows);
	})
}

function createArticle(callback, title, text, date )
{

}


// APIs
server.get('/api/ping', function (req, res, next) {
	res.send(200, {"message": "Okay"});
});


// This is for getting pages of articles with offset
server.get(/api\/articles\/(\d+)/, function (req, res, next) {
	if (req.params[0] > 1000) {
		console.log("Page request bigger than limit! ");
		res.send(404, {"message": "Can\'t find what you\'re looking for!"});
	}

	try {
		var offset = parseInt(req.params[0]);
	} catch (e) {
		console.log("Error parsing offset!");
		res.send(404, {"message": "I can\'t seem to read your offset"});
	}

	if (offset < 0) {
		res.send(404, {"message": "Can\'t find what you\'re looking for!"});
	} else if (offset === 1) {
		offset = 0;
	} else {
		offset = offset * 5 - 5;
	}


	getPosts(function (posts) {
		if (posts === undefined || posts === null) {
			res.send(404, {"message": "Articles not found"});
			return;
		}
		res.setHeader('Content-Type', 'application/json');
		res.send(200, posts);
	}, offset);

});

server.get('/api/alerts', function (req, res, next) {

	getAlerts(function (message) {
		if (message === "" || message === undefined || message === null) {
			res.setHeader('Content-Type', 'application/json');
			res.send(200, {message: null});
			return;
		} else {
			res.setHeader('Content-Type', 'application/json');
			res.send(200, message);
			return;
		}
	});

});

// Authentication and registration
server.post('/api/login', function (req, res, next) {
	var username = req.headers.username;
	var password = req.headers.password;
	if (!username || !password) {
		res.send(401, "Invalid login!");
		return;
	}

	// Get the user
	verifyUser(function (user) {
		if (!user || user[0] === undefined || user[0] === null) {
			res.send(401, "Invalid login!");
			return;
		}

		// Valid user!
		console.log("User logged in: " + user[0].username);

		jwt.sign({user: username}, secret, { expiresIn: config.Session_Timeout }, function (err, token) {
			if (err) {
				console.log(err);
				res.json({
					success: false,
					message: 'Failed to sign web token'
				})
				return;
			} else {
				res.json({
					success: true,
					message: 'Enjoy your token!',
					token: token
				});
				return;
			}

		});




	}, username, password);

});

server.post('/api/register', rateLimitStrict, function (req, res, next) 
{
	//First make sure the username doesn't exist and then make the user
	// Make sure needed information is provided

	var userRegistrationData = {};
	userRegistrationData.FirstName = req.body.FirstName;
	userRegistrationData.LastName = req.body.LastName;
	userRegistrationData.Email = req.body.Email;
	userRegistrationData.Username = req.body.Username;
	userRegistrationData.Password = req.body.Password;
	userRegistrationData.isActive = true;
	userRegistrationData.isAdmin = false;

	// Verify provided information
	// Check null || empty
	if (userRegistrationData.FirstName === undefined || userRegistrationData.LastName === undefined ||
		userRegistrationData.Email === undefined || userRegistrationData.Username === undefined ||
		userRegistrationData.Password === undefined) 
	{
		res.send(403, {"message": 'Invalid data, make sure all data is provided.'});
	return;
	} 
	else 
	{
		// Verify email format
		var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;

		if (reg.test(userRegistrationData.Email) == false) {
			res.send(403, {"message": 'Invalid email format!'});
			return;

		}

		// Make sure password is at least 
		if (userRegistrationData.Password === undefined || userRegistrationData.Password.length < config.Password_Min_Length) {
			res.send(403, {"message": 'Password does not meet the min complexity'});
			return;
		}

		// Make sure the user doesn't exist
		verifyUsername(function (exists) {
			if (exists === false) {
				// Register user
				createUser(function (confirm) {
					if (confirm) {
						res.send(200, {"message": 'Registration succeeded.'});
						return;

					} else {
						res.send(403, {"message": 'Registration failed.'});
						return;

					}
				}, userRegistrationData.Username,
				userRegistrationData.Password,
				userRegistrationData.Email,
				userRegistrationData.FirstName,
				userRegistrationData.LastName,
				userRegistrationData.isActive,
				userRegistrationData.isAdmin)
			} else {
				res.send(403, {"message": 'Username already exists.'});
				return;
			}
		}, userRegistrationData.Username)


	}

		// Make sure email was provided
});

server.get(/api\/article\/(\d+)/, function (req, res, next) {
	var id = req.params[0];
	getArticle(function (post) {
		if (post === undefined || post === null) {
			res.send(404, {"message": "Article not found"});
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.send(200, post)
	}, id);

});

/*
	This section is for authenticated requests ONLY! Always check for tokens!
	*/
server.post('/api/article/post', function (req, res, next) {
	// UNDER DEVELOPMENT
	// This function is for posting articles, NOT updating

	// Make sure they have a valid token
	var token = req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) {
			if (err) {
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) {
					res.send(400, "Invalid post format!");
					console.log(req.body);
					return;
				}

				// Make the post
				var post = {};
				post.post_title = req.body.post_title;
				post.post_date = new Date(); // We need to do something about the date time, they will want to set the timezone!
				post.post_text = req.body.post_text;
				post.post_image = req.body.post_image;
				post.post_short = req.body.post_short;

				// Check requirements
				if (post.post_title === undefined || post.post_date === undefined) {
					console.log('Error making post!', post);
					res.send(400, "I was not able to make a post with the data provided!");
					return;
				}

				console.log(post);


				// Do this when done
				res.send(200, "Posted");
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({
			success: false,
			message: 'No token provided.'
		});

	}

});

server.post('/api/article/update', function (req, res, next) {
	// UNDER DEVELOPMENT
	// This function is for posting articles, NOT updating

	// Make sure they have a valid token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];

	// decode token
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) {
			if (err) {
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} else {
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) {
					res.send(400, "Invalid post format!");
					console.log(req.body);
					return;
				}

				// Make the post
				var post = {};
				post.post_title = req.body.post_title;
				post.post_date = new Date(); // We need to do something about the date time, they will want to set the timezone!
				post.post_text = req.body.post_text;
				post.post_image = req.body.post_image;
				post.post_short = req.body.post_short;

				// Check requirements
				if (post.post_title === undefined || post.post_date === undefined) {
					console.log('Error making post!', post);
					res.send(400, {"message": "I was not able to make a post with the data provided!"});
					return;
				}

				console.log(post);


				// Do this when done
				res.send(200, {"message": "Posted"});
			}
		});

	} else {

		// if there is no token
		// return an error
		return res.status(403).send({
			success: false,
			message: 'No token provided.'
		});

	}

});

server.post('/api/upload', function(req, res, next)
	{
	console.log(arguments.formatters); // no files in any request properties
	req.on('file', function() { // "end" doesn't work either, callback never called
		console.log(arguments);
	});

});

server.listen(config.Server_Port);
console.log("Server started for %s on port %s", config.Server_Name, config.Server_Port);
