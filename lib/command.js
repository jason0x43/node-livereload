module.exports.run = function () {
	var livereload = require('./livereload'),
		resolve = require('path').resolve,
		opts = require('opts'),
		log = require('util').log,
		path,
		port,
		server;

	opts.parse([
		{
			short: 'p',
			long: 'port',
			description: 'Specify the port',
			value: true,
			required: false
		},
		{
			short: 'd',
			long: 'debug',
			description: 'Debug mode',
			value: false,
			required: false
		}
	].reverse(), true);

	port = opts.get('port') || 35729;
	path = resolve(process.argv[2] || '.');

	log('Starting LiveReload for ' + path + ' on port ' + port + '.');

	server = livereload.createServer({
		port: port,
		debug: opts.get('debug')
	});
	server.watch(path);
};
