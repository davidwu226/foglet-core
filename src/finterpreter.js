/*
MIT License

Copyright (c) 2016 Grall Arnaud

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
'use strict';

const EventEmitter = require('events');
const VVwE = require('version-vector-with-exceptions');
const CausalBroadcast = require('causal-broadcast-definition');
const Unicast = require('unicast-definition');
const serialize = require('serialize-javascript');
const FStore = require('./fstore.js').FStore;
const Q = require('q');
const GUID = require('./guid.js');

class Command {
	constructor (options) {
		// Instance a job on a peer
		this.type = options.type || 'normal';
		this.callback = serialize(options.callback) || serialize(d => console.log(d));
		this.value = options.value;
		this.jobId = options.jobId;
		// For querying internal functions
		this.name = options.name;
		this.args = options.args;
	}
}

class FInterpreter extends EventEmitter {
	/**
	 * @constructor
	 * @param {Foglet} foglet This is the parent object in order to get all foglet basics operations
	 */
	constructor (foglet) {
		super();
		this.foglet = foglet;
		this.protocol = 'interpreter';
		this.vector = new VVwE(Number.MAX_VALUE);
		this.broadcast = new CausalBroadcast(this.foglet.spray, this.vector, this.protocol + '-broadcast');
		this.unicast = new Unicast(this.foglet.spray, this.protocol + '-unicast');
		this.signalBroadcast = this.protocol + '-broadcast';
		this.signalUnicast = this.protocol + '-unicast';

		this.properties = Object.getOwnPropertyNames(Object.getPrototypeOf(this.foglet));
		// We delete constructor and init
		this.properties = this.properties.slice(2, this.properties.length);

		// Allow to generate uuid
		this.uid = new GUID();

		const self = this;

		this.emitter =  (jobId, key, val) => {
			let newValue = { jobId };
			newValue[key] = val;
			self.foglet.interpreter.sendBroadcast(new Command({
				type: 'customResponse',
				value: newValue
			}));
		};

		this.store = new FStore({
			map : {
				views : function () {
					return self.foglet.getNeighbours();
				},
				jobs : {}
			}
		});

		this.broadcast.on('receive', message => {
			self.receiveBroadcast (message);
		});

		this.unicast.on('receive', (id, message) => {
			self.receiveUnicast (id, message);
		});

	}

	receiveBroadcast (message) {
		let result = null;
		if(message.type === 'custom') {
			this.receiveCustomBroadcast(message);
		}else if (message.type === 'customResponse') {
			result = message.value;
			this.emit(this.signalBroadcast+'-custom', result, message);
		} else {
			result = this.foglet[message.name](...message.args);
			this.emit(this.signalBroadcast, result, message);
		}
	}

	receiveCustomBroadcast (message) {
		const val = this.store.get(message.value) && this.store.get(message.value);
		let callback = this._deserialize(message.callback);
		if(typeof val === 'function') {
			callback(message.jobId, this.foglet, val(), this.emitter); // add an emitter in order to send back results
		} else {
			callback(message.jobId, this.foglet, val, this.emitter); // add an emitter in order to send back results
		}
	}

	receiveUnicast (id, message) {
		const result = this.foglet[message.name](...message.args);
		this.emit(this.signalUnicast, result, id, message);
	}

	sendBroadcast (message) {
		this.broadcast.send(message, this.vector.increment());
	}

	sendUnicast (message, peerId) {
		this.unicast.send(message, peerId);
	}

	executeCustom (value, callback) {
		let command = new Command({
			type: 'custom',
			value,
			callback,
			jobId : this.uid.guid()
		});
		return this.sendBroadcast(command);
	}

	executeBroadcast (name, args) {
		if(typeof name === 'string' && Array.isArray(args)) {
			let command  = new Command({name, args});
			let result;
			try {
				if(command && command.name && command.args) {
					if (this.properties.includes(command.name) && this.foglet[command.name].length === command.args.length) {
						return this.sendBroadcast(command);
					} else {
						result = false;
					}
				}else{
					result = false;
				}
			} catch (e) {
				result = e;
			}

			return result;
		}else{
			return false;
		}
	}

	executeUnicast (name, args, id) {
		if(typeof name === 'string' && Array.isArray(args)) {
			let command  = new Command({name, args});
			let result;
			try {
				if(command && command.name && command.args) {
					if (this.properties.includes(command.name) && this.foglet[command.name].length === command.args.length) {
						return this.sendUnicast(command, id);
					} else {
						result = false;
					}
				}else{
					result = false;
				}
			} catch (e) {
				result = e;
			}

			return result;
		}else{
			return false;
		}
	}

	mapReduce(key, mapper, reducer){
		this.executeCustom(key, mapper);
		this.on(this.signalBroadcast+'-custom', reducer);
	}

	_deserialize (serializedJavascript) {
		return eval('(' + serializedJavascript + ')');
	}

	_flog (message) {
		this.foglet._flog('[Interpreter]' + message);
	}

}

module.exports = { FInterpreter };
