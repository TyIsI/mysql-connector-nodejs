"use strict";

var crypto = require('crypto');

var sha1 = function (text) {
    var s = crypto.createHash('sha1');
    s.update(text);//, 'utf8');
    return s.digest();
};

var xor = function (buf1, buf2) {
    if (buf1.length !== buf2.length) {
        throw new Error("Length of both buffers has to be identical");
    }
    var res = new Buffer(buf1.length);
    for (var i = 0; i < buf1.length; ++i) {
        res[i] = buf1[i] ^ buf2[i];
    }
    return res;
};

/**
 * MySQL 4.1 Authentication
 *
 * @implements {module:mysqlx/Authentication:IAuthenticator}
 * @param properties
 * @constructor
 */
function MySQL41Auth(properties) {
    this._user = properties.dbUser;
    this._password = properties.dbPassword;
}

module.exports = MySQL41Auth;

MySQL41Auth.prototype.verifyServer = function (serverMethods) {
    return (serverMethods.indexOf(this.name) !== -1);
};

MySQL41Auth.prototype.name = "MYSQL41";

MySQL41Auth.prototype.getInitialAuthData = function () {
    return;
};

MySQL41Auth.prototype.scramble = function (scramble) {
    var buf1 = sha1(this._password);
    var buf2 = sha1(buf1);

    var s = crypto.createHash('sha1');
    s.update(scramble);
    s.update(buf2);
    var tmpBuffer = s.digest();

    return xor(buf1, tmpBuffer);
};


MySQL41Auth.prototype.getNextAuthData = function (serverData) {
    if (serverData.length != 20) {
        throw new Error("Scramble buffer had invalid length - expected 20 bytes, got " + serverData.length)
    }

    var retval = new Buffer(this._user.length + 20 * 2 + 3);
    retval[0] = 0x00;
    retval.write(this._user, 1);
    retval[this._user.length + 1] = 0x00;
    retval[this._user.length + 2] = 0x00;

    if (!this._password) {
        // We've allocated space for the scrambled password but don't need it
        return retval.slice(0, this._user.length + 2);
    }

    var pass = this.scramble(serverData);
    retval.write("*", this._user.length + 2);
    for (var i = 0, pos = this._user.length + 3; i < 20; pos += 2, ++i) {
        if (pass[i] < 16) {
            retval.write("0" + pass[i].toString(16), pos);
        } else {
            retval.write(pass[i].toString(16), pos);
        }
    }
    return retval;
};
