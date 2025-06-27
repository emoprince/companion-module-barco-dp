var instance_skel = require('../../instance_skel');
var tcp = require('../../tcp');
var debug;
var log;

exports.id = 'barco-series4';
exports.name = 'Barco Series 4 Projector';

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);
	self.actions(); // export actions
	return self;
}

instance.prototype.init = function () {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.status(self.STATUS_UNKNOWN);

	if (self.config.host !== undefined) {
		self.tcp = new tcp(self.config.host, self.config.port || '43731');

		self.tcp.on('status_change', function (status, message) {
			self.status(status, message);
			self.log('info', `TCP connection status: ${message}`);
		});

		self.tcp.on('error', function () {
			// Ignore
		});
	}
};

instance.prototype.updateConfig = function (config) {
	var self = this;
	self.config = config;

	if (self.tcp !== undefined) {
		self.tcp.destroy();
		delete self.tcp;
	}

	if (self.config.host !== undefined) {
		self.tcp = new tcp(self.config.host, self.config.port || '43731');

		self.tcp.on('status_change', function (status, message) {
			self.status(status, message);
			self.log('info', `TCP connection status: ${message}`);
		});

		self.tcp.on('error', function () {
			// Ignore
		});
	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;
	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module is for Barco Series 4 projectors (default port 43731)'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			default: '192.168.0.100',
			regex: self.REGEX_IP
		},
		{
			type: 'dropdown',
			id: 'port',
			label: 'Portnumber',
			width: 6,
			default: '43731',
			choices: [{ label: 'Series 4 - Port 43731', id: '43731' }]
		}
	];
};

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this;

	if (self.tcp !== undefined) {
		self.tcp.destroy();
	}
	debug("destroy", self.id);
};

instance.prototype.actions = function (system) {
	var self = this;

	var actions = {
		'lamp': {
			label: 'Lamp control',
			options: [{
				type: 'dropdown',
				label: 'on/off',
				id: 'lamp',
				default: 'lamp_on',
				choices: [{ label: 'lamp on', id: 'lamp_on' }, { label: 'lamp off', id: 'lamp_off' }]
			}]
		},
		'shutter': {
			label: 'Shutter option 1',
			options: [{
				type: 'dropdown',
				label: 'open/close',
				id: 'shutter',
				default: 'shutter_close',
				choices: [{ label: 'shutter close', id: 'shutter_close' }, { label: 'shutter open', id: 'shutter_open' }]
			}]
		},
		'lensShift': {
			label: 'Shift the lens',
			options: [{
				type: 'dropdown',
				id: 'side',
				label: 'shift',
				choices: [{ label: 'Up', id: '0' }, { label: 'Down', id: '1' }, { label: 'Left', id: '2' }, { label: 'Right', id: '3' }],
				default: '0'
			}]
		},
		'lensZoom': {
			label: 'Zoom the lens',
			options: [{
				type: 'dropdown',
				id: 'zoom',
				label: 'zoom',
				choices: [{ label: 'Zoom in', id: '0' }, { label: 'Zoom out', id: '1' }],
				default: '0'
			}]
		},
		'lensFocus': {
			label: 'Focus the lens',
			options: [{
				type: 'dropdown',
				id: 'focus',
				label: 'focus',
				choices: [{ label: 'Near', id: '0' }, { label: 'Far', id: '1' }],
				default: '0'
			}]
		},
		'macro': {
			label: 'Execute macro',
			options: [{
				label: 'Macro name',
				type: 'textinput',
				id: 'macro'
			}]
		}
	};

	self.setActions(actions);
};

instance.prototype.action = function (action) {
	var self = this;
	var id = action.action;
	var opt = action.options;
	var cmd;

	getCommandValue = function (command, parameter) {
		let checksum = 0;

		command.forEach(function (item) {
			checksum += item;
		});

		if (parameter !== null) {
			let pBuffer = Buffer.from([parseInt(parameter)]);
			pBuffer.forEach(function (item) {
				checksum += item;
			});
			checksum = checksum % 256;

			return Buffer.concat([
				Buffer.from([0xFE, 0x00]),
				command,
				pBuffer,
				Buffer.from([checksum]),
				Buffer.from([0xFF])
			]);
		} else {
			checksum = checksum % 256;

			return Buffer.concat([
				Buffer.from([0xFE, 0x00]),
				command,
				Buffer.from([0x00]),
				Buffer.from([checksum]),
				Buffer.from([0xFF])
			]);
		}
	};

	switch (id) {
		case 'lamp':
			cmd = getCommandValue(Buffer.from([0x00, 0x03, 0x02, 0x76, 0x1a]), opt.lamp === 'lamp_on' ? '1' : '0');
			break;

		case 'shutter':
			cmd = opt.shutter === 'shutter_open'
				? Buffer.from([0xfe, 0x00, 0x22, 0x42, 0x00, 0x64, 0xff])
				: Buffer.from([0xfe, 0x00, 0x23, 0x42, 0x00, 0x65, 0xff]);
			break;

		case 'lensShift':
			cmd = getCommandValue(Buffer.from([0xf4, 0x81]), opt.side);
			break;

		case 'lensZoom':
			cmd = getCommandValue(Buffer.from([0xf4, 0x82]), opt.zoom);
			break;

		case 'lensFocus':
			cmd = getCommandValue(Buffer.from([0xf4, 0x83]), opt.focus);
			break;

		case 'macro':
			cmd = getCommandValue(Buffer.concat([Buffer.from([0xe8, 0x81]), Buffer.from(opt.macro)]), null);
			break;
	}

	if (cmd !== undefined && self.tcp !== undefined) {
		debug('sending', cmd, 'to', self.tcp.host);
		self.tcp.send(cmd);
	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
