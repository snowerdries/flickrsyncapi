/*eslint no-console: ["error", { allow: ["warn", "error"] }] */
var express = require('express');
var flickrApi = require('flickr-oauth-and-upload'); 
var Promise = require('bluebird');
var https = require('https');
var fs = require('fs');

var app = express();
var imagesdir = 'images';
var pageCount = 0;

var flickrOptions = {
    api_key: '311f5a08fd2d80f0dc141ae1c665e60b',
    secret: '1eb41a3bd0698cb2',
    oauth_token: '',
    oauth_token_secret: ''
};



app.get('/login', function (req, res){
    var myCallback = function (err, data) {
        if (!err) {
            flickrOptions.oauth_token= data.oauthToken;
            flickrOptions.oauth_token_secret = data.oauthTokenSecret;
            res.redirect(data.url);
        } else {
            res.send('Error: ' + err);
        }
    };

    var args = {
        flickrConsumerKey: flickrOptions.api_key,
        flickrConsumerKeySecret: flickrOptions.secret,
        permissions: 'read',
        redirectUrl: 'http://localhost:3000/loggedin',
        callback: myCallback
    };

    flickrApi.getRequestToken(args);
});

app.get('/loggedin', function (req, res){
    var myCallback = function (err, data) {
        if (!err) {
            flickrOptions.oauth_token = data.oauthToken;
            flickrOptions.oauth_token_secret = data.oauthTokenSecret;
            res.redirect('/flickrsync');
        } else {
            res.send('Error: ' + err);
        }
    };

    var args = {
        flickrConsumerKey: flickrOptions.api_key,
        flickrConsumerKeySecret: flickrOptions.secret,
        oauthToken: flickrOptions.oauth_token,
        oauthTokenSecret: flickrOptions.oauth_token_secret,
        oauthVerifier: req.query.oauth_verifier,
        callback: myCallback
    };

    flickrApi.useRequestTokenToGetAccessToken(args);
});

app.get('/flickrsync', function (req, res) {  
    res.send('STARTED');  
    getFlickrPhotos()
    .then(getPhotosToDownload)
    .then(downloadPhotoById)
    .then(function(){        
        console.warn('DONE');
    }, function(error){
        console.error('ERROR: ' + error);
    });  
});

var getFlickrPhotos = function(){
    return new Promise(function(resolve, reject){
        getFlickrResponse('flickr.people.getPhotos',{api_key: flickrOptions.api_key, user_id: 'me', extras: 'media'}).then(function(data){
            pageCount = data.photos.pages;                    
            var currentPage = data.photos.page;
            currentPage+=1;
            var ids=data.photos.photo.map(function(photo){
                return photo.id;
            });
            var promises = [];         
            for (var i=currentPage; i <= pageCount; i++) { 
                promises.push(getFlickrResponse('flickr.people.getPhotos',{extras: 'media', page:i.toString(), api_key: flickrOptions.api_key, user_id: 'me'}));      
            
            }
            Promise.each(promises,function(data){                        
                var idvals= data.photos.photo.map(function(photo){
                    if(photo.media === 'photo'){
                        return photo.id;
                    } else {
                        return null;
                    } 

                }).filter(function(id){
                    return id;
                });
            
                ids =ids.concat(idvals);
            }).then(function(){
                resolve(ids);
            }, function(error){
                reject(error);
            });
            
        }, function(error){
            reject(error);
        });
    });
};

var getPhotosToDownload = function(ids) {
    return new Promise(function(resolve, reject){
        fs.readdir(imagesdir, (err, files) => {
            if(err) {
                reject(err);
                return;
            }
            var existingIds = files.map(function(file){
                return file.replace('.jpg','').replace('.png','');
            });            

            ids = ids.filter(function(id){
                return existingIds.indexOf(id) < 0;
            });

            resolve(ids);           
        });          
    });
};

var downloadPhoto = function(data) {
    return new Promise(function(resolve){
        if(data && data.sizes && data.sizes.size[data.sizes.size.length -1]) {
            var url = data.sizes.size[data.sizes.size.length -1].source; 
            var filename = url.replace(/^.*[\\\/]/, '');
            var idfilename = filename.split('_')[0] + '.' + filename.split('.').pop();
            filename = imagesdir + '/' + idfilename;
            if(idfilename !== '.') {
                console.warn('download: ' + url);
                var file = fs.createWriteStream(filename);
                https.get(url, function(response) {
                    response.pipe(file);
                    resolve();
                });
            } else {
                resolve();
            }
        }
    }).then(function(){
        return;
    });
};

var downloadPhotoById = function(ids) {
    console.warn(ids.length);
    return new Promise(function(resolve){    
        Promise.each(ids,function(id){
            return getFlickrResponse('flickr.photos.getSizes',{api_key: flickrOptions.api_key, photo_id: id})
            .then(downloadPhoto);
        }).then(function(){
            resolve();
        });
    });    
};

var getFlickrResponse = function(method, data) {
    return new Promise(function(resolve, reject ){
        var myCallback = function (err, data) {
            if (!err) {
                resolve(data);
                return;    
            }
            reject();
            return;
        };

        var args = {
            method: method,
            flickrConsumerKey: flickrOptions.api_key,
            flickrConsumerKeySecret: flickrOptions.secret,
            oauthToken: flickrOptions.oauth_token,
            oauthTokenSecret: flickrOptions.oauth_token_secret,
            callback: myCallback,
            optionalArgs : data
        };

        flickrApi.callApiMethod(args);
    });
};

app.listen(3000, function () {
    console.warn('Example app listening on port 3000!');
});