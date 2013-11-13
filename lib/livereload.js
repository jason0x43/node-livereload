var fs = require('fs'),
	http = require('http'),
	path = require('path'),
	url = require('url'),
	ws = require('websocket.io'),
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
	this.sockets = [];
	this.exts = [];

	exts = (config.exts || []).concat(defaultExts);

	for (var i = 0; i < exts.length; i++) {
		this.exts.push(new RegExp('\\.' + exts[i] + '$', 'i'));
	}
}

Server.prototype.listen = function () {
	log('Waiting for browser to connect...');
	this.server = ws.listen(this.port);
	this.server.on('connection', this.onConnection.bind(this));
	return this.server.on('close', this.onClose.bind(this));
};

Server.prototype.onConnection = function (socket) {
	log('Browser connected');
	socket.send('!!ver:' + this.version);
	socket.on('message', function (message) {
		var data = JSON.parse(message);
		log('Browser: type=' + data.ext + ', extension=' + data.extver);
	});
	return this.sockets.push(socket);
};

Server.prototype.onClose = function (socket) {
	log('Browser disconnected');
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
	var i,
		sockets = this.sockets,
		len = sockets.length,
		results = [],
		data = JSON.stringify([
			'refresh',
			{
				path: path,
				apply_js_live: this.applyJSLive,
				apply_css_live: this.applyCSSLive
			}
		]);

	log('Refreshing ' + path);

	for (i = 0; i < len; i++) {
		results.push(sockets[i].send(data));
	}
	return results;
};


exports.createServer = function (config) {
	var app, server;

	app = http.createServer(function (req, res) {
		if (url.parse(req.url).pathname === '/livereload.js') {
			res.writeHead(200, {
				'Content-Type': 'text/javascript'
			});
			return res.end(fs.readFileSync(__dirname + '/../ext/livereload.js'));
		}
	});

	config = config || {};
	config.server = config.server || app;

	server = new Server(config);
	server.listen();
	return server;
};
