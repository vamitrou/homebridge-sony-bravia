
var MAX_VOL = 20;
var DEFAULT_VOL = 8;
var CUR_VOL;

var request = require('request');
var Accessory, Service, Characteristic;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-sony-bravia', 'SonyAndroidTV', SonyBravia);
}

function SonyBravia(log, config) {
    this.log = log;
    this.name = config.name || 'Sony TV';
    this.ip = config.ip;
    this.psk = config.psk;

    if (!this.ip)
        throw new Error('No IP address provided.');
    if (!this.psk)
        throw new Error('No PSK provided.');

    this.service = new Service.Fan(this.name);
    this.serviceInfo = new Service.AccessoryInformation();
    this.serviceInfo
        .setCharacteristic(Characteristic.Manufacturer, 'Sony')
        .setCharacteristic(Characteristic.Model, 'Android TV')
        .setCharacteristic(Characteristic.SerialNumber, 'DEADBEEF');
    
    this.service
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
    this.service
        .addCharacteristic(new Characteristic.RotationSpeed())
        .on('get', this.getVolume.bind(this))
        .on('set', this.setVolume.bind(this));
}

SonyBravia.prototype = {
    getPowerState: function(callback) {
        var log = this.log;

        request.post({
            url: 'http://' + this.ip + '/sony/system',
            headers: { 
                'X-Auth-PSK': this.psk
            },
            form: JSON.stringify({
                method: 'getPowerStatus',
                params: [],
                version: '1.0',
                id: 1
            })
        }, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                log.debug('Status: ' + json.result[0].status);
                callback(null, (json.result[0].status == 'active'));
                return;
            }
            log.debug('Error %s while getting powerstate: %s', response.statusCode, error);
            callback();
        });
    },

    setPowerState: function(state, callback) {
        var log = this.log;

        request.post({
            url: 'http://' + this.ip + '/sony/system',
            headers: {
                'X-Auth-PSK': this.psk
            },
            form: JSON.stringify({
                method: 'setPowerStatus',
                params: [{
                    'status': Boolean(state)
                }],
                version: '1.0',
                id: 2
            })
        }, function(error, response, body) {
            if (error || response.statusCode != 200) {
                var json = JSON.parse(body);
                log.debug('setPowerState: API Error: %s', json.error[1]);
            }
            callback();
        });
    },

    getVolume: function(callback) {
        var log = this.log

            request.post({
                url: 'http://' + this.ip + '/sony/audio',
                headers: {
                    'X-Auth-PSK': this.psk
                },
                form: JSON.stringify({
                    method: 'getVolumeInformation',
                    params: [],
                    version: '1.0',
                    id: 3
                })
            }, function (error, response, body) {
                var json = JSON.parse(body);
                if (error || response.statusCode != 200) {
                    if (json.error) {
                        if (json.error[0] == 40005) {
                            log.debug('getVolume: Display is turned off');
                        } 
                        else {
                            log.debug('Error getting volume: %s' + json.error[1]);
                        }
                    } 
                    CUR_VOL = 0;
                    log.debug('Could not get volume.');
                }
                else {
                    CUR_VOL = json.result[0][0].volume;
                    log.debug('Current volume: ' + CUR_VOL);
                }
                callback();
            });
    },

    setVolume: function(value, callback) {
        var log = this.log;

        if (value >= MAX_VOL) {
            value = DEFAULT_VOL;
            log.debug('Requested volume greater than MAX_VOL.');
        }
        log.debug('Setting volume to: %s', value.toString());

        request.post({
            url: 'http://' + this.ip + '/sony/audio',
            headers: {
                'X-Auth-PSK': this.psk
            },
            form: JSON.stringify({
                method: 'setAudioVolume',
                params: [{
                    'target': '',
                    'volume': value.toString() 
                }],
                version: '1.0',
                id: 4
            })
        }, function(error, response, body) {
            var json = JSON.parse(body);
            if (error || response.statusCode != 200) {
                if (json.error) {
                    if (json.error[0] == 40005) {
                        log.debug('getVolume: Display is turned off');
                    } 
                    else {
                        log.debug('Error setting volume: %s' + json.error[1]);
                    }
                }
                log.debug('Could not set volume.');
            }
            callback();
        });
    },

    identify: function(callback) {
        callback();
    },

    getServices: function() {
        return [this.serviceInfo, this.service];
    }
};
