# blogApi
This is the API for the blog platform.

The purpose of this new blog platform is to make a new blogging platform in NodeJS with an API decoupled from the web application. You can have a server with very minimal specs (512MB RAM, 1 core CPU) and distribute the work load to the clients. The client accesses the website and starts the web application, the web application contacts the API back-end for rendering the page client-side. All of these phones and desktops have a lot of computing power, why stress the server when the client can do the work, to within reason. Majority of the state is handled in the API, so there's still some work that needs to be done on the server.

This repository will maintain the API, development of the API should not interfere with development of the web application or mobile application (if one chooses to have a mobile application). The API is responsible for accepting CRUD, accessing a database if needed then returning the results. The API will also maintain session information, with that comes user authentication. 
