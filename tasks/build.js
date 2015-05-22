var Promise = require('es6-promise').Promise;
var log = require('./utils/log');
var helper = require('./utils/config-helper');
var UglifyJS = require("./wrappers/uglifyjs");
var BabelJS = require("./wrappers/babeljs");
var extend = require('util')._extend;
var clean = require('./clean');
var config, paths, globs, pkg, build = {};

function initConfig(){
    config = helper.getConfig();
    paths = config.paths;
    globs = config.globs;
    pkg = config.pkg;
}

build.html = function html(options) {
    var htmlWrapper = helper.matches(config.tasks.build, ['jade','mustache']);
    if (!htmlWrapper) return Promise.resolve();
    log.info(' * HTML');

    var Html = require('./wrappers/' + htmlWrapper);
    options = extend(config.pkg || {}, options);
    options.now = Date().split(' ').splice(0,5).join(' ');
    return Promise.all([
        paths.demo && new Html(globs.demo.html, paths.target, options).write(),
        paths.target && new Html(globs.source.html, paths.target, options).write()
    ]).then(build.htmlMin).then(options.reload).catch(log.warn);
};

//todo: location for consistency or fileObjs for speed??
build.htmlMin = function htmlMin(fileObjs) {
    var htmlWrapper = helper.matches(config.tasks.build, ['html-min']);
    if (!htmlWrapper) return Promise.resolve();
    log.info(' * HTML Min');

    var HtmlMin = require('./wrappers/html-min');
    var promises = [];
    fileObjs.forEach(function(fileObjs){
        promises.push(new HtmlMin(fileObjs).write());
    });
    return Promise.all(promises).catch(log.warn);
};

build.scripts = function scripts(options, cb){
    var scriptsWrapper = helper.matches(config.tasks.build, ['browserify','requirejs']);
    var babel = helper.matches(config.tasks.build, ['babel']);

    if (!scriptsWrapper) return Promise.resolve();
    log.info(' * Scripts');

    var Scripts = require('./wrappers/' + scriptsWrapper);
    options = extend(config[scriptsWrapper] || {}, options || {});
    options.browserify = pkg.browserify;
    options.browser = pkg.browser;
    options["browserify-shim"] = pkg["browserify-shim"];
    //browserify
    return Promise.all([
        paths.demo && new Scripts(globs.demo.scripts, paths.target, options).write(),
        paths.target && new Scripts(globs.source.scripts, paths.target, options).write()
    //es6to5
    ]).then(wait).then(function(fileObjPromises){
        if(babel) {
            return build.es6To5(fileObjPromises);
        } else return fileObjPromises;
    //uglify
    }).then(wait).then(function(fileObjPromises){
        if (options.dev) return Promise.resolve();
        return build.jsMin(fileObjPromises[1]); ////only minify source code (not demo code)
    }).then(options.reload).catch(log.warn);
};

function wait(fileObjs){
    return new Promise(function(resolve, reject) {
        setTimeout(function(){
            resolve(fileObjs);
        },100);
    });
}

build.es6To5 = function (fileObjs){
    log.info(' * Compiling ES6 to ES5');
    var promises = [];
    fileObjs.forEach(function (fileObj, i) {
        log.info('    * ' + fileObj.name);
        promises.push(new BabelJS(fileObj, build.options).write());
    });
    return Promise.all(promises);
};

build.jsMin = function (fileObjs){
    log.info(' * Minifying JS');
    var promises = [];
    fileObjs.forEach(function (fileObj, i) {
        log.info('    * ' + fileObj.name);
        promises.push(new UglifyJS(fileObj, build.options).write());
    });
    return Promise.all(promises);
};

build.styles = function styles(options){
    var stylesWrapper = helper.matches(config.tasks.build, ['sass']);
    if (!stylesWrapper) return Promise.resolve();
    log.info(' * Styles');

    var Styles = require('./wrappers/' + stylesWrapper);
    options = extend(config[stylesWrapper] || {}, options);
    return Promise.all([
        paths.target && new Styles(globs.source.styles, paths.target, options).write(),
        paths.demo && new Styles(globs.demo.styles, paths.target, options).write()
    ]).then(options.reload).catch(log.warn);
};

build.all = function all(options){
    return Promise.all([
        build.scripts(options),
        build.styles(options),
        build.html(options)
    ]).catch(log.warn);
};

var prepare = {
    all: function(){ return clean.build(); },
    noop: function(){ return Promise.resolve(); }
};

function exec(task, options){
    initConfig();
    options = options || {};
    if (!config.tasks.build) return Promise.resolve();
    return (prepare[task] || prepare.noop)().then(function(){
        log.info('Building :');
        build[task](options);
    });
}

module.exports = {
    html: function(options){ return exec('html', options); },
    styles:  function(options){ return exec('styles', options); },
    scripts:  function(options){ return exec('scripts', options); },
    all:  function(options){ return exec('all', options); }
};
