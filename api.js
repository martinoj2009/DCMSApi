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
var jwt = require('jsonwebtoken');


/* Load Modules */
var Backend = new (require('./ApiBackend.js'))();


// Read in the config file
// TODO: I need to find a better way to read this in, as a require
var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
if (!config) 
{
	console.log('Error reading in config file!')
	process.exit();
}

var salt = config.Pasword_Salt;
var secret = config.JSON_Web_Token_Secret;


// Configure restify server
var server = restify.createServer({
	name: config.Server_Name
});
server.use(restify.bodyParser());

// Rate limit some config, only applies when you specify
// Global ratelimit
server.use(restify.throttle({burst:100,rate:50,ip:true}));
var rateLimitStrict = restify.throttle({burst:1,rate:1,ip:true});
var rateLimitLight = restify.throttle({burst:100,rate:50,ip:true});


/* API Utilities */

/* This API call is for testing if the API is up and running
 * Returns: Object{success: <status>, message: <message>, user: <username if logged in>}
 */
server.get('/api/ping', function (req, res, next) 
{
	var token = req.headers['x-access-token'];
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				res.send(200, {success: true, loggedIn: false});
				return;
			} 
			else 
			{
				// Ping with username
				req.decoded = decoded;
				res.send(200, {success: true, loggedIn: true, user: decoded.username});
				return;
			}
		});
	}
	else
	{
		res.send(200, {success: true, loggedIn: false});
		return;
	}
});

/* API Calls for articles */

/* This API call is for getting articles pagginated by 5 at a time
 * Retruns: an array of maps
 * TODO: Allow config file to set pagination
 */
server.get(/api\/articles\/(\d+)/, function (req, res, next) 
{
	if (req.params[0] > 1000) 
	{
		res.send(200, {success: false, "message": "Page request too big."});
		return;
	}
	
	try 
	{
		var offset = parseInt(req.params[0]);
	} 
	catch (e) 
	{
		console.log("Error parsing offset!");
		res.send(200, {success: false, message: "I can\'t seem to read your offset"});
		return;
	}
	
	if (offset < 0) 
	{
		res.send(200, {success: false, message: "Can\'t find what you\'re looking for!"});
		return;
	} 
	else if (offset === 1) 
	{
		offset = 0;
	} 
	else 
	{
		offset = offset * 5 - 5;
	}
	
	Backend.getPosts(function (posts) 
	{
		if (!posts || !posts) 
		{
			res.send(200, {success: false, message: "Articles not found"});
			return;
		}

		res.setHeader('Content-Type', 'application/json');
		res.send(200, posts);
	}, offset);
});

/* This API call is for getting a specific article. 
 * Returns: map
 * TODO: Might want to do straight JSON-RPC here... maybe.
 */
server.get(/api\/article\/(\d+)/, function (req, res, next) 
{
	var id = req.params[0];
	Backend.getArticle(function (post) 
	{
		if (!post) 
		{
			res.send(200, {success: false, message: "Article not found"});
			return;
		}
		post.success = true;
		res.send(200, post)
	}, id);
});

/* API Call for site wide alerts */

/* This API call is for getting the current alert
 * Returns: Object{success: <status>, message: <alert message>, title: <alert title>}
 */
server.get('/api/alert', function (req, res, next) 
{
	Backend.getAlerts(function (message) 
	{
		if (message === "" || !message) 
		{
			res.setHeader('Content-Type', 'application/json');
			res.send(200, {success: true, message: null});
			return;
		} 
		else 
		{
			res.setHeader('Content-Type', 'application/json');
			message[0].success = true;
			res.send(200, message[0]);
			return;
		}
	});
});

/* Authentication and registration */

/* This API call is for authenticating users
 * Returns: Object with JWT token
 */
server.post('/api/login', function (req, res, next) 
{
	var user = {};
	user.username = req.headers.username;
	user.password = req.headers.password;

	if (!user.username || !user.password) 
	{
		res.send(200, {success: false, message: "Invalid login data provided!"});
		return;
	}
	
	// Get the user
	Backend.verifyUser(function (data) 
	{
		if (!data || !data[0]) 
		{
			res.send(200, {success: false, message: "Invalid login!"});
			return;
		}

		// Valid user!
		let userObject = {
			username: data[0].username,
			isAdmin: data[0].is_admin,
			firstname: data[0].first_name,
			lastname: data[0].last_name
		}
		console.log("User logged in: ", userObject);
		
		jwt.sign(userObject, secret, { expiresIn: config.Session_Timeout }, function (err, token) 
		{
			if (err) 
			{
				console.log(err);
				res.json({
					success: false,
					message: 'Failed to sign web token'
				});
				return;
			} 
			else 
			{
				res.json({
					success: true,
					message: 'Enjoy your token!',
					token: token
				});
				return;
			}
			
		});
	}, user);
});

/* This API call is for user registration
 *
 */
server.post('/api/register', function (req, res, next) 
{
	//First make sure the username doesn't exist and then make the user
	// Make sure needed information is provided
	
	var userRegistrationData = {};
	userRegistrationData.firstname = req.body.firstname;
	userRegistrationData.lastname = req.body.lastname;
	userRegistrationData.email = req.body.email;
	userRegistrationData.username = req.body.username;
	userRegistrationData.password = req.body.password;
	userRegistrationData.isActive = true;
	userRegistrationData.isAdmin = false;
	
	// Verify provided information
	// Check null || empty
	if (!userRegistrationData.firstname || !userRegistrationData.lastname ||
		!userRegistrationData.email || !userRegistrationData.username ||
		!userRegistrationData.password) 
	{
		console.log("INVALID: %o", userRegistrationData);
		res.send(200, {success: false, message: 'Invalid data, make sure all data is provided.'});
		return;
	} 
	else 
	{
		// Verify email format
		var reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;
		if (reg.test(userRegistrationData.email) == false) 
		{
			res.send(200, {success: false, message: 'Invalid email format!'});
			return;
		}
		
		// Make sure password is at least Password_Min_Length
		if (userRegistrationData.password === undefined || userRegistrationData.password.length < config.Password_Min_Length) 
		{
			res.send(200, {success: false, message: 'Password does not meet the min complexity'});
			return;
		}

		console.log("Registering: " + userRegistrationData.username);
		
		// Make sure the user doesn't exist
		Backend.verifyUsername(function (exists) 
		{
			if (exists === false) 
			{
				// Register user
				Backend.createUser(function (confirm) 
				{
					if (confirm) 
					{
						res.send(200, {success: true, message: 'Registration succeeded.'});
						return;
					} 
					else 
					{
						res.send(200, {success: false, message: 'Registration failed.'});
						return;
					}
				}, userRegistrationData)
			} 
			else 
			{
				res.send(200, {success: false, message: 'Username already exists.'});
				return;
			}
		}, userRegistrationData.username)
	}
});


/*
This section is for authenticated requests ONLY! Always check for tokens and if an account exists
*/

/* This API call is for updating an article
 *
 */
server.post('/api/alert/update', function(req, res, next)
{
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{	
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Makesure user exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// if everything is good, save to request for use in other routes
						req.decoded = decoded;

						// Make sure this is an admin
						if(!decoded.isAdmin)
						{
							res.send(200, {success: false, message: "Must be an admin"});
							console.log("You must be an admin to post articles: ", decoded);
							return;
						}

						if (!req.body) 
						{
							res.send(200, {success: false, message: "Please provide alert_title and alert_message in body."});
							console.log(req.body);
							return;
						}

						let newAlert = {}
						newAlert.title = req.body.alert_title;
						newAlert.message = req.body.alert_message;

						// Make sure they provided data
						if(!newAlert.title || !newAlert.message)
						{
							res.send(200, {success: false, message: "Please provide alert_title and alert_message in body."});
							return;
						}

						console.log(newAlert);

						Backend.setAlert(function(status)
						{
							if(status)
							{
								res.send(200, {success: true, message: "Alert set"});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Alert not set"});
							}
						}, newAlert);
					}
				}, decoded.username);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
	}
});

/* This API call is for posting an new article
 *
 */
server.post('/api/article/post', function (req, res, next) 
{
	// UNDER DEVELOPMENT
	// This function is for posting articles, NOT updating
	
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Make sure user exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// if everything is good, save to request for use in other routes
						req.decoded = decoded;
						if (!req.body) 
						{
							res.send(200, {success: false, message: "Invalid post format!"});
							console.log(req.body);
							return;
						}

						// Make sure this is an admin
						if(!decoded.isAdmin)
						{
							res.send(200, {success: false, message: "Must be an admin"});
							console.log("You must be an admin to post articles: ", decoded);
							return;
						}

						// Make the post
						var post = {};
						post.title = req.body.post_title;
						post.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
						post.text = req.body.post_text;
						post.image = req.body.post_image;
						post.short = req.body.post_short;
						post.status = req.body.post_status;
						post.author = decoded.username;

						console.log("Creating post: " + post.title);

						// Make sure status is set, default to 1 for published
						if(!post.status)
						{
							post.status = 1;
						}
						
						// Check requirements
						if (!post.title || !post.date) 
							{
							console.log('Error making post!', post);
							res.send(200, {success: false, message: "I was not able to make a post with the data provided!"});
							return;
						}
						
						Backend.createArticle(function(result)
						{
							if(result)
								{
								res.send(200, {success: true, message: "Posted"});
								return;
							}
							else
								{
								res.send(200, {success: false, message: "Was not able to post"});
								return;
							}
						}, post);
					}
				}, decoded.username);
				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This API call is for deleting an article
 * TODO: Maybe allow deleting an array of articles?
 */
server.del('/api/article/delete', function(req, res, next)
{
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Make sure the account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// if everything is good, save to request for use in other routes
						req.decoded = decoded;
						if (!req.body) 
						{
							res.send(200, {success: false, message: "Invalid post format!"});
							console.log(req.body);
							return;
						}

						// Make sure this is an admin
						if(!decoded.isAdmin)
						{
							res.send(200, {success: false, message: "Must be an admin"});
							console.log("You must be an admin to post articles: ", decoded);
							return;
						}

						// Make the post
						var post = {};
						post.id = req.body.post_id;
						Backend.deleteArticle(function(status)
						{
							if(status)
							{
								res.send(200, {success: true, message: "Post deleted."});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Could not delete post."});
								return;
							}
						}, post);
					}
				}, decoded.username);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This API call is for updating an article.
 *
 */
server.post('/api/article/update', function (req, res, next) 
{	
	// Make sure they have a valid token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) 
				{
					res.send(200, {success: false, message: "Invalid post format!"});
					console.log(req.body);
					return;
				}

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to post articles: ", decoded);
					return;
				}

				// Make sure account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// Make the post
						var post = {};
						post.title = req.body.post_title;
						post.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
						post.text = req.body.post_text;
						post.image = req.body.post_image;
						post.short = req.body.post_short;
						post.status = req.body.post_status;
						post.id = req.body.post_id;
						
						// Check requirements
						if (!post.id) 
						{
							res.send(200, {success: false, message: "I was not able to update a post with the data provided!"});
							return;
						}
						
						Backend.updateArticle(function(result)
						{
							if(result)
							{
								res.send(200, {success: true, message: "Updated"});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Was not able update post"});
								return;
							}
						}, post);

					}
				}, decoded.username);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});


/* Status Updates */

/* This API call is for getting articles pagginated by 5 at a time
 * Retruns: an array of maps
 * TODO: Allow config file to set pagination
 */
server.get(/api\/statuses\/(\d+)/, function (req, res, next) 
{
	if (req.params[0] > 1000) 
	{
		res.send(200, {success: false, "message": "Page request too big."});
		return;
	}
	
	try 
	{
		var offset = parseInt(req.params[0]);
	} 
	catch (e) 
	{
		console.log("Error parsing offset!");
		res.send(200, {success: false, message: "I can\'t seem to read your offset"});
		return;
	}
	
	if (offset < 0) 
	{
		res.send(200, {success: false, message: "Can\'t find what you\'re looking for!"});
		return;
	} 
	else if (offset === 1) 
	{
		offset = 0;
	} 
	else 
	{
		offset = offset * 5 - 5;
	}
	
	Backend.getStatuses(function (statuses) 
	{
		if (!statuses) 
		{
			res.send(200, {success: false, message: "Statuses not found"});
			return;
		}

		res.send(200, statuses);
	}, offset);
});

/* This API call is for getting a specific article. 
 * Returns: map
 * TODO: Might want to do straight JSON-RPC here... maybe.
 */
server.get(/api\/status\/(\d+)/, function (req, res, next) 
{
	var id = req.params[0];
	Backend.getStatus(function (status) 
	{
		if (!status) 
		{
			res.send(200, {success: false, message: "Status not found"});
			return;
		}
		status.success = true;
		res.send(200, status)
	}, id);
});

/* This API call is for posting an new status
 *
 */
server.post('/api/status/post', function (req, res, next) 
{
	// UNDER DEVELOPMENT
	// This function is for posting articles, NOT updating
	
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Make sure user exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// if everything is good, save to request for use in other routes
						req.decoded = decoded;
						if (!req.body) 
						{
							res.send(200, {success: false, message: "Invalid status format!"});
							console.log(req.body);
							return;
						}

						// Make sure this is an admin
						if(!decoded.isAdmin)
						{
							res.send(200, {success: false, message: "Must be an admin"});
							console.log("You must be an admin to post statuses: ", decoded);
							return;
						}

						// Make the status
						var status = {};
						status.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
						status.text = req.body.status_text;
						status.image_url = req.body.image_url;
						status.author = decoded.username;

						console.log("Creating status: ", status);

						
						// Check requirements
						if (!status.text || !status.date) 
							{
							console.log('Error making status!', status);
							res.send(200, {success: false, message: "I was not able to make a status with the data provided!"});
							return;
						}
						
						Backend.createStatus(function(result)
						{
							if(result)
								{
								res.send(200, {success: true, message: "Posted"});
								return;
							}
							else
								{
								res.send(200, {success: false, message: "Was not able to post status"});
								return;
							}
						}, status);
					}
				}, decoded.username);
				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This API call is for deleting a status.
 * TODO: Maybe allow deleting an array of statuses?
 */
server.del('/api/status/delete', function(req, res, next)
{
	// Make sure they have a valid token
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Make sure the account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Status not found."});
						return;
					}
					else
					{
						// if everything is good, save to request for use in other routes
						req.decoded = decoded;
						if (!req.body) 
						{
							res.send(200, {success: false, message: "Invalid status format!"});
							console.log(req.body);
							return;
						}

						// Make sure this is an admin
						if(!decoded.isAdmin)
						{
							res.send(200, {success: false, message: "Must be an admin"});
							console.log("You must be an admin to delete statuses: ", decoded);
							return;
						}

						// Delete the status
						var status = {};
						status.id = req.body.status_id;
						Backend.deleteStatus(function(status)
						{
							if(status)
							{
								res.send(200, {success: true, message: "Status deleted."});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Could not delete status."});
								return;
							}
						}, status);
					}
				}, decoded.username);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This API call is for updating a status.
 *
 */
server.post('/api/status/update', function (req, res, next) 
{	
	// Make sure they have a valid token
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// if everything is good, save to request for use in other routes
				req.decoded = decoded;
				if (!req.body) 
				{
					res.send(200, {success: false, message: "Invalid status format!"});
					console.log(req.body);
					return;
				}

				// Make sure this is an admin
				if(!decoded.isAdmin)
				{
					res.send(200, {success: false, message: "Must be an admin"});
					console.log("You must be an admin to status articles: ", decoded);
					return;
				}

				// Make sure account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// Make the status
						var status = {};
						status.date = new Date(); // We need to do something about the date time, they will want to set the timezone!
						status.text = req.body.status_text;
						status.image_url = req.body.image_url;
						status.id = req.body.status_id;
						
						// Check requirements
						if (!status.id) 
						{
							res.send(200, {success: false, message: "I was not able to update a status with the data provided!"});
							return;
						}
						
						Backend.updateStatus(function(result)
						{
							if(result)
							{
								res.send(200, {success: true, message: "Updated"});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Was not able update status"});
								return;
							}
						}, status);

					}
				}, decoded.username);
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});



/* Multimedia */
/* This API call is for doing file uploads..
 * THIS IS STILL UNDER DEVELOPMENT
 */
server.post('/api/upload', function(req, res, next)
{
	res.send(200, {success: false, message: "Feature not ready."});
	return;
	console.log(arguments.formatters); // no files in any request properties
	req.on('file', function() 
	{ // "end" doesn't work either, callback never called
		console.log(arguments);
	});
});

/* Account Managment */

/* This method is for returning account infomation about the user
 *
 */
server.get('/api/account/info', function(req, res, next)
{
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				// Make sure the account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						// Get the user information
						Backend.getAccountInformation(function(data)
						{
							if(data)
							{
								data.success = true;
								res.send(200, data);
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Was not able to get your user information."});
								return;
							}
						}, decoded);
					}
				}, decoded.username);
				
				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This method is for allowing users to update their account information
 *
 */
server.post('/api/account/update', function(req, res, next)
{
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				if(!req.body)
				{
					res.send(200, {success: false, message: "No data provided."});
					return;
				}

				var user = {}
				user.first_name = req.body.firstname;
				user.last_name = req.body.lastname;
				user.password = req.body.password;
				user.username = decoded.username;

				// Make sure the account exists
				Backend.verifyUsername(function(status)
				{
					if(!status)
					{
						res.send(200, {success: false, message: "Account not found."});
						return;
					}
					else
					{
						Backend.updateAccountInformation(function(status)
						{
							if(status)
							{
								res.send(200, {success: true, message: "Updated user information."});
								return;
							}
							else
							{
								res.send(200, {success: false, message: "Was not able to update user information"});
								return;
							}
						}, user);
					}
				});				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

/* This method is for allowing users to delete their account
 *
 */
server.del('/api/account/delete', function(req, res, next)
{
	var token = req.headers['x-access-token'];
	
	// decode token
	if (token) 
	{
		// verifies secret and checks exp
		jwt.verify(token, secret, function (err, decoded) 
		{
			if (err) 
			{
				return res.json({
					success: false,
					message: 'Failed to authenticate token.'
				});
			} 
			else 
			{
				var user = {}
				user.username = decoded.username;
				user.password = req.headers.password;

				// They MUST provide their password to delete their account
				if(!user.username || ! user.password)
				{
					res.send(200, {success: false, message: "You must provide login information (username, password) to delete your account!"});
					return;
				}

				// Make sure the username exists
				Backend.deleteAccount(function(status)
				{
					if(status)
					{
						res.send(200, {success: true, message: "Deleted user account."});
						return;
					}
					else
					{
						res.send(200, {success: false, message: "Was not able to delete user account."});
						return;
					}
				}, user);				
			}
		});
	} 
	else 
	{
		// if there is no token
		// return an error
		return res.send(200, {
			success: false,
			message: 'No token provided.'
		});
		
	}
});

server.listen(config.Server_Port);
console.log("Server started for %s on port %s", config.Server_Name, config.Server_Port);
