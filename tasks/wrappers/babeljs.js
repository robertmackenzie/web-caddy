var Promise = require('es6-promise').Promise;
var path = require('path');
var babelJS = require("babel-core");
var fs = require('../utils/fs');
var File = require('../utils/file');

function BabelJS(fileObj, options){
    this.fileObj = fileObj;
    this.options = options || {};
}

BabelJS.prototype.write = function(){
    var fileObj = this.fileObj;
    var es5 = babelJS.minify(fileObj.path, this.options);
    var newFile = new File({ path: fileObj.path });
    newFile.name = fileObj.name.replace('.js','.min.js');
    newFile.contents = es5.code;
    return fs.write(newFile);
};

module.exports = BabelJS;
