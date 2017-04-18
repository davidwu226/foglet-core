'use strict';

const Foglet = require('../src/foglet.js').Foglet;
const FBroadcast = require('../src/flib/fbroadcast.js');

describe('[FBROADCAST] functions', function () {
	this.timeout(30000);
	it('[FBROADCAST] sendBroadcast with ordered message on 3 peers network', function (done) {
		let f1 = new Foglet({
			protocol: 'test-fbroadcast',
			webrtc: {
				trickle: true,
				iceServers: []
			},
			room: 'test-fbroadcast'
		});

		let f2 = new Foglet({
			protocol: 'test-fbroadcast',
			webrtc: {
				trickle: true,
				iceServers: []
			},
			room: 'test-fbroadcast'
		});

		let f3 = new Foglet({
			protocol: 'test-fbroadcast',
			webrtc: {
				trickle: true,
				iceServers: []
			},
			room: 'test-fbroadcast'
		});

		let cpt = 0;
		let totalResult = 4;
		let results = [];
		const expectedResults = [ '1', '2', '3', '4', '1', '2', '3', '4' ];
		const receiveResult = (peer, message) => {
			console.log('Peer: ', peer, ' |  Message received:' + message);
			results.push(message);
			cpt++;
			if (checkResult(peer, message) && cpt === totalResult) {
				done();
			}
		};

		const checkResult = (peer, message) => {
			console.log('Peer: ', peer, ' |  Message received:' + message);
			let check = true;
			let i = 0;
			while( check && i < results.length ) {
				const indexResult = results.indexOf(message);
				const indexExpectedResult = expectedResults.indexOf(message);
				if(indexResult !== indexExpectedResult) {
					check = false;
				}
				i++;
			}
			return check;
		};

		f1.connection(f2).then(() => {
			f2.connection(f3).then(() => {
				f1.onBroadcast((message) => {
					receiveResult(1, message);
				});

				f2.onBroadcast((message) => {
					receiveResult(2, message);
				});

				f3.onBroadcast((message) => {
					receiveResult(3, message);
				});

				const ec1 = f1.sendBroadcast('1');
				f1.sendBroadcast('2', ec1);

				const ec2 = f1.sendBroadcast('3');
				f1.sendBroadcast('4', ec2);
			}).catch(error => {
				console.log(error);
				done(error);
			});
		});
	}); // end it

	it('[FBROADCAST] sendBroadcast/onBroadcast', function (done) {
		let f1 = new Foglet({
			protocol:'test-broadcast',
			webrtc:	{
				trickle: true,
				iceServers: []
			},
			room: 'test-broadcast'
		});
		let f2 = new Foglet({
			protocol:'test-broadcast',
			webrtc:	{
				trickle: true,
				iceServers: []
			},
			room: 'test-broadcast'
		});

		f2.onBroadcast((data) => {
			console.log(data);
			assert(data, 'hello');
			done();
		});

		f1.connection(f2).then( () => {
			setTimeout(function () {
				f1.sendBroadcast('hello');
			}, 2000);
		});
	});

	it('[FBROADCAST] sendUnicast/onUnicast', function (done) {
		let f1 = new Foglet({
			protocol:'test-unicast',
			webrtc:	{
				trickle: true,
				iceServers: []
			},
			room: 'test-unicastroom'
		});

		let f2 = new Foglet({
			protocol:'test-unicast',
			webrtc:	{
				trickle: true,
				iceServers: []
			},
			room: 'test-unicastroom'
		});

		f2.onUnicast((id, message) => {
			console.log(id + ' : ' + message);
			assert(message, 'hello');
			done();
		});

		f1.connection(f2).then( () => {
			setTimeout(function () {
				const peers = f1.getNeighbours();
				console.log(peers);
				for(let i = 0; i < peers.length; i++) {
					f1.sendUnicast('hello', peers[i]);
				}
			}, 2000);
		});
	});
});
