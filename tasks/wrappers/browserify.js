var Promise = require('es6-promise').Promise;
var browserify = require('browserify');
var path = require('path');
var watchify = require('watchify');
var fs = require('../utils/fs');
var File = require('../utils/file');
var log = require('../utils/log');

function Browserify(location, destination, options){
    this.location = location;
    this.destination = destination;
    this.options = options || {};
    this.checkForDeboweify();
}

Browserify.prototype.checkForDeboweify = function(){
    var options = this.options;
    if (options.vendorBundle && options.browserify && options.browserify.transform && options.browserify.transform.indexOf('debowerify')>-1){
        log.onError([
            'The browserify transform `debowerify` does not currenlty work with `vendorBundle`.',
            'Please remove `debowerify` from browserify.transform within your package.json.',
            ' * https://github.com/eugeneware/debowerify/issues/62'
        ].join('\n'));
    }
};

Browserify.prototype.buildVendor = function(fileObj, options){
    if (!options.vendorBundle) return Promise.resolve();
    delete this.options.entries;
    var outFile = path.join(this.destination, options.vendorTarget);
    var vendorFile = new File({ path: outFile });
    var v_ws = fs.createWriteStream(vendorFile.path);
    browserify().require(options.vendorBundle).bundle().pipe(v_ws);
    return new Promise(function(resolve, reject) {
        v_ws.end = function(){
            return resolve(vendorFile);
        };
        v_ws.on('error', reject);
    });
};

Browserify.prototype.mapExternalFiles = function() {
    if (!this.options.vendorBundle) return;
    return this.options.vendorBundle.map(function (v) {
        return (typeof v === 'string') ? v : v.expose;
    });
};

Browserify.prototype.file = function(fileObj, browserSync) {
    var self = this;
    var options = this.options || {};
    options.entries = fileObj.path;
    var b = browserify(options, (browserSync) ? watchify.args : undefined);
    var vendor = this.mapExternalFiles();
    if (vendor){
        b.external(vendor);
    }
    b.require(fileObj.path, {expose: fileObj.name.split('.')[0]});
    if (browserSync){
        return self.watchBundle(b, fileObj, browserSync);
    } else {
        return self.bundle(b, fileObj);
    }
};

Browserify.prototype.watchBundle = function(b, fileObj, browserSync) {
    var self = this;
    b = watchify(b, { delay: 1000 });
    return new Promise(function(resolve, reject) {
        b.on('update', function () {
            self.bundle(b, fileObj).then(function(){
                browserSync.reload();
                resolve();
            });
        });
        b.bundle();
    });
};

Browserify.prototype.bundle = function(b, fileObj) {
    var outFile = path.join(this.destination, fileObj.relativeDir, fileObj.name);
    var b_ws = fs.createWriteStream(path.resolve(outFile));
    b.bundle().pipe(b_ws);
    return new Promise(function(resolve, reject) {
        b_ws.end = function(){
            //todo: verbose mode?
            //log.info(' * ' + fileObj.name + ' saved in ' + self.destination);
            fileObj.path = outFile;
            return resolve(fileObj);
        };
        b_ws.on('error', reject);
    });
};

Browserify.prototype.watch = function(browserSync) {
    var self = this;
    return fs.glob(this.location).then(function(fileObjs) {
        fileObjs.forEach(function (fileObj, i) {
            self.file(fileObj, browserSync);
        });
    });
};

Browserify.prototype.write = function(){
    var self = this;
    var options = this.options || {};
    return fs.glob(this.location).then(function(fileObjs){
        //todo: verbose mode?
        //if (fileObjs.length===0){
        //    log.info('no .js files found within `' + self.location + '`');
        //}
        var promises = [];
        fileObjs.forEach(function (fileObj, i) {
            promises.push(self.file(fileObj));
        });
        if (options.vendorBundle){
            options.vendorBundle.forEach(function (vendorObj, i) {
                var fileObj = new File({ path: vendorObj.file || vendorObj });
                promises.push(self.buildVendor(fileObj, options));
            });
        }
        return Promise.all(promises);
    });
};

module.exports = Browserify;