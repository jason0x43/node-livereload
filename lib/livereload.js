var fs = require('fs'),
	http = require('http'),
	path = require('path'),
	url = require('url'),
	ws = require('ws'),
	observer = require('observer'),
	util = require('util'),
	log = util.log,
	debug = util.debug,
	defaultExclusions = [/\.git\//, /\.svn\//, /\.hg\//],
	defaultExts = [
		'html', 'css', 'js', 'png', 'gif', 'jpg', 'php', 'php5', 'py', 'rb',
		'erb', 'coffee'
	],
	defaultPort = 35729,
	version = '1.6';


// disable debugging
debug = function debug() {};


function Server(config) {
	var exts;
	config = config || {};

	this.version = config.version || version;
	this.port = config.port || defaultPort;
	this.exclusions = (config.excludes || []).concat(defaultExclusions);
	this.applyJSLive = config.applyJSLive || false;
	this.applyCSSLive = config.applyCSSLive || true;
	this.webServer = config.webServer || null;
	this.sockets = {};
	this.exts = [];

	exts = (config.exts || []).concat(defaultExts);

	for (var i = 0; i < exts.length; i++) {
		this.exts.push(new RegExp('\\.' + exts[i] + '$', 'i'));
	}
}

Server.prototype.listen = function () {
	log('Waiting for browser to connect...');
	if (this.webServer) {
		this.webServer.listen(this.port);
		this.wsServer = new ws.Server({ server: this.webServer });
	} else {
		this.wsServer = new ws.Server({ port: this.port });
	}
	this.wsServer.on('connection', this.onConnection.bind(this));
};

Server.prototype.onConnection = function (socket) {
	var self = this,
		key = String(Math.random());

	this.sockets[key] = socket;
	socket.send('!!ver:' + this.version);

	socket.on('message', function (message) {
		var data = JSON.parse(message);
		log('Browser: type=' + data.ext + ', extension=' + data.extver);
	});

	socket.on('error', function () {
		log('Socket error:', arguments);
	});

	socket.on('close', function () {
		delete self.sockets[key];
		log('Browser disconnected');
	});

	log('Browser connected');
};

Server.prototype._isInteresting = function (filename) {
	for (var i = 0; i < this.exts.length; i++) {
		if (filename.match(this.exts[i])) {
			return true;
		}
	}
	return false;
};

Server.prototype.watch = function (dirname) {
	var self = this;
	this._observer = observer.observe(dirname, {
		excludes: self.exclusions
	});
	this._observer.on('change', function (eventType, filename) {
		if (self._isInteresting(filename)) {
			debug(eventType + ' ' + filename);
			self.refresh(filename);
		}
	});
};

Server.prototype.refresh = function (path) {
	var key,
		data = JSON.stringify([
			'refresh',
			{
				path: path,
				apply_js_live: this.applyJSLive,
				apply_css_live: this.applyCSSLive
			}
		]);

	log('Refreshing ' + path);

	for (key in this.sockets) {
		this.sockets[key].send(data);
	}
};


exports.createServer = function (config) {
	var app, server;

	app = http.createServer(function (request, respoonse) {
		if (url.parse(request.url).pathname === '/livereload.js') {
			response.writeHead(200, {
				'Content-Type': 'text/javascript'
			});
			return response.end(fs.readFileSync(__dirname + '/../ext/livereload.js'));
		}
	});

	config = config || {};
	config.webServer = config.webServer || app;

	server = new Server(config);
	server.listen();
	return server;
};
