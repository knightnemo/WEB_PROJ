"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var _exportNames = {
  Client: true,
  CopyConditions: true,
  PostPolicy: true
};
var Stream = _interopRequireWildcard(require("stream"), true);
var _async = require("async");
var _lodash = require("lodash");
var querystring = _interopRequireWildcard(require("query-string"), true);
var _webEncoding = require("web-encoding");
var _xml2js = require("xml2js");
var errors = _interopRequireWildcard(require("./errors.js"), true);
Object.keys(errors).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === errors[key]) return;
  exports[key] = errors[key];
});
var _helpers = require("./helpers.js");
Object.keys(_helpers).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _helpers[key]) return;
  exports[key] = _helpers[key];
});
var _callbackify = require("./internal/callbackify.js");
var _client = require("./internal/client.js");
var _copyConditions = require("./internal/copy-conditions.js");
exports.CopyConditions = _copyConditions.CopyConditions;
var _helper = require("./internal/helper.js");
var _postPolicy = require("./internal/post-policy.js");
exports.PostPolicy = _postPolicy.PostPolicy;
var _notification = require("./notification.js");
Object.keys(_notification).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  if (Object.prototype.hasOwnProperty.call(_exportNames, key)) return;
  if (key in exports && exports[key] === _notification[key]) return;
  exports[key] = _notification[key];
});
var _promisify = require("./promisify.js");
var _signing = require("./signing.js");
var transformers = _interopRequireWildcard(require("./transformers.js"), true);
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
/*
 * MinIO Javascript Library for Amazon S3 Compatible Cloud Storage, (C) 2015 MinIO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

class Client extends _client.TypedClient {
  // Set application specific information.
  //
  // Generates User-Agent in the following style.
  //
  //       MinIO (OS; ARCH) LIB/VER APP/VER
  //
  // __Arguments__
  // * `appName` _string_ - Application name.
  // * `appVersion` _string_ - Application version.
  setAppInfo(appName, appVersion) {
    if (!(0, _helper.isString)(appName)) {
      throw new TypeError(`Invalid appName: ${appName}`);
    }
    if (appName.trim() === '') {
      throw new errors.InvalidArgumentError('Input appName cannot be empty.');
    }
    if (!(0, _helper.isString)(appVersion)) {
      throw new TypeError(`Invalid appVersion: ${appVersion}`);
    }
    if (appVersion.trim() === '') {
      throw new errors.InvalidArgumentError('Input appVersion cannot be empty.');
    }
    this.userAgent = `${this.userAgent} ${appName}/${appVersion}`;
  }

  // Remove the partially uploaded object.
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `objectName` _string_: name of the object
  // * `callback(err)` _function_: callback function is called with non `null` value in case of error
  removeIncompleteUpload(bucketName, objectName, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.IsValidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var removeUploadId;
    _async.during(cb => {
      this.findUploadId(bucketName, objectName).then(uploadId => {
        removeUploadId = uploadId;
        cb(null, uploadId);
      }, cb);
    }, cb => {
      var method = 'DELETE';
      var query = `uploadId=${removeUploadId}`;
      this.makeRequest({
        method,
        bucketName,
        objectName,
        query
      }, '', [204], '', false, e => cb(e));
    }, cb);
  }

  // Copy the object.
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `objectName` _string_: name of the object
  // * `srcObject` _string_: path of the source object to be copied
  // * `conditions` _CopyConditions_: copy conditions that needs to be satisfied (optional, default `null`)
  // * `callback(err, {etag, lastModified})` _function_: non null `err` indicates error, `etag` _string_ and `listModifed` _Date_ are respectively the etag and the last modified date of the newly copied object
  copyObjectV1(arg1, arg2, arg3, arg4, arg5) {
    var bucketName = arg1;
    var objectName = arg2;
    var srcObject = arg3;
    var conditions, cb;
    if (typeof arg4 == 'function' && arg5 === undefined) {
      conditions = null;
      cb = arg4;
    } else {
      conditions = arg4;
      cb = arg5;
    }
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(srcObject)) {
      throw new TypeError('srcObject should be of type "string"');
    }
    if (srcObject === '') {
      throw new errors.InvalidPrefixError(`Empty source prefix`);
    }
    if (conditions !== null && !(conditions instanceof _copyConditions.CopyConditions)) {
      throw new TypeError('conditions should be of type "CopyConditions"');
    }
    var headers = {};
    headers['x-amz-copy-source'] = (0, _helper.uriResourceEscape)(srcObject);
    if (conditions !== null) {
      if (conditions.modified !== '') {
        headers['x-amz-copy-source-if-modified-since'] = conditions.modified;
      }
      if (conditions.unmodified !== '') {
        headers['x-amz-copy-source-if-unmodified-since'] = conditions.unmodified;
      }
      if (conditions.matchETag !== '') {
        headers['x-amz-copy-source-if-match'] = conditions.matchETag;
      }
      if (conditions.matchEtagExcept !== '') {
        headers['x-amz-copy-source-if-none-match'] = conditions.matchETagExcept;
      }
    }
    var method = 'PUT';
    this.makeRequest({
      method,
      bucketName,
      objectName,
      headers
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return cb(e);
      }
      var transformer = transformers.getCopyObjectTransformer();
      (0, _helper.pipesetup)(response, transformer).on('error', e => cb(e)).on('data', data => cb(null, data));
    });
  }

  /**
   * Internal Method to perform copy of an object.
   * @param sourceConfig __object__   instance of CopySourceOptions @link ./helpers/CopySourceOptions
   * @param destConfig  __object__   instance of CopyDestinationOptions @link ./helpers/CopyDestinationOptions
   * @param cb __function__ called with null if there is an error
   * @returns Promise if no callack is passed.
   */
  copyObjectV2(sourceConfig, destConfig, cb) {
    if (!(sourceConfig instanceof _helpers.CopySourceOptions)) {
      throw new errors.InvalidArgumentError('sourceConfig should of type CopySourceOptions ');
    }
    if (!(destConfig instanceof _helpers.CopyDestinationOptions)) {
      throw new errors.InvalidArgumentError('destConfig should of type CopyDestinationOptions ');
    }
    if (!destConfig.validate()) {
      return false;
    }
    if (!destConfig.validate()) {
      return false;
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    const headers = Object.assign({}, sourceConfig.getHeaders(), destConfig.getHeaders());
    const bucketName = destConfig.Bucket;
    const objectName = destConfig.Object;
    const method = 'PUT';
    this.makeRequest({
      method,
      bucketName,
      objectName,
      headers
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return cb(e);
      }
      const transformer = transformers.getCopyObjectTransformer();
      (0, _helper.pipesetup)(response, transformer).on('error', e => cb(e)).on('data', data => {
        const resHeaders = response.headers;
        const copyObjResponse = {
          Bucket: destConfig.Bucket,
          Key: destConfig.Object,
          LastModified: data.LastModified,
          MetaData: (0, _helper.extractMetadata)(resHeaders),
          VersionId: (0, _helper.getVersionId)(resHeaders),
          SourceVersionId: (0, _helper.getSourceVersionId)(resHeaders),
          Etag: (0, _helper.sanitizeETag)(resHeaders.etag),
          Size: +resHeaders['content-length']
        };
        return cb(null, copyObjResponse);
      });
    });
  }

  // Backward compatibility for Copy Object API.
  copyObject(...allArgs) {
    if (allArgs[0] instanceof _helpers.CopySourceOptions && allArgs[1] instanceof _helpers.CopyDestinationOptions) {
      return this.copyObjectV2(...arguments);
    }
    return this.copyObjectV1(...arguments);
  }

  // list a batch of objects
  listObjectsQuery(bucketName, prefix, marker, listQueryOpts = {}) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!(0, _helper.isString)(marker)) {
      throw new TypeError('marker should be of type "string"');
    }
    let {
      Delimiter,
      MaxKeys,
      IncludeVersion
    } = listQueryOpts;
    if (!(0, _helper.isObject)(listQueryOpts)) {
      throw new TypeError('listQueryOpts should be of type "object"');
    }
    if (!(0, _helper.isString)(Delimiter)) {
      throw new TypeError('Delimiter should be of type "string"');
    }
    if (!(0, _helper.isNumber)(MaxKeys)) {
      throw new TypeError('MaxKeys should be of type "number"');
    }
    const queries = [];
    // escape every value in query string, except maxKeys
    queries.push(`prefix=${(0, _helper.uriEscape)(prefix)}`);
    queries.push(`delimiter=${(0, _helper.uriEscape)(Delimiter)}`);
    queries.push(`encoding-type=url`);
    if (IncludeVersion) {
      queries.push(`versions`);
    }
    if (marker) {
      marker = (0, _helper.uriEscape)(marker);
      if (IncludeVersion) {
        queries.push(`key-marker=${marker}`);
      } else {
        queries.push(`marker=${marker}`);
      }
    }

    // no need to escape maxKeys
    if (MaxKeys) {
      if (MaxKeys >= 1000) {
        MaxKeys = 1000;
      }
      queries.push(`max-keys=${MaxKeys}`);
    }
    queries.sort();
    var query = '';
    if (queries.length > 0) {
      query = `${queries.join('&')}`;
    }
    var method = 'GET';
    var transformer = transformers.getListObjectsTransformer();
    this.makeRequest({
      method,
      bucketName,
      query
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return transformer.emit('error', e);
      }
      (0, _helper.pipesetup)(response, transformer);
    });
    return transformer;
  }

  // List the objects in the bucket.
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `prefix` _string_: the prefix of the objects that should be listed (optional, default `''`)
  // * `recursive` _bool_: `true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'. (optional, default `false`)
  // * `listOpts _object_: query params to list object with below keys
  // *    listOpts.MaxKeys _int_ maximum number of keys to return
  // *    listOpts.IncludeVersion  _bool_ true|false to include versions.
  // __Return Value__
  // * `stream` _Stream_: stream emitting the objects in the bucket, the object is of the format:
  // * `obj.name` _string_: name of the object
  // * `obj.prefix` _string_: name of the object prefix
  // * `obj.size` _number_: size of the object
  // * `obj.etag` _string_: etag of the object
  // * `obj.lastModified` _Date_: modified time stamp
  // * `obj.isDeleteMarker` _boolean_: true if it is a delete marker
  // * `obj.versionId` _string_: versionId of the object
  listObjects(bucketName, prefix, recursive, listOpts = {}) {
    if (prefix === undefined) {
      prefix = '';
    }
    if (recursive === undefined) {
      recursive = false;
    }
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidPrefix)(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!(0, _helper.isBoolean)(recursive)) {
      throw new TypeError('recursive should be of type "boolean"');
    }
    if (!(0, _helper.isObject)(listOpts)) {
      throw new TypeError('listOpts should be of type "object"');
    }
    var marker = '';
    const listQueryOpts = {
      Delimiter: recursive ? '' : '/',
      // if recursive is false set delimiter to '/'
      MaxKeys: 1000,
      IncludeVersion: listOpts.IncludeVersion
    };
    var objects = [];
    var ended = false;
    var readStream = Stream.Readable({
      objectMode: true
    });
    readStream._read = () => {
      // push one object per _read()
      if (objects.length) {
        readStream.push(objects.shift());
        return;
      }
      if (ended) {
        return readStream.push(null);
      }
      // if there are no objects to push do query for the next batch of objects
      this.listObjectsQuery(bucketName, prefix, marker, listQueryOpts).on('error', e => readStream.emit('error', e)).on('data', result => {
        if (result.isTruncated) {
          marker = result.nextMarker || result.versionIdMarker;
        } else {
          ended = true;
        }
        objects = result.objects;
        readStream._read();
      });
    };
    return readStream;
  }

  // listObjectsV2Query - (List Objects V2) - List some or all (up to 1000) of the objects in a bucket.
  //
  // You can use the request parameters as selection criteria to return a subset of the objects in a bucket.
  // request parameters :-
  // * `bucketName` _string_: name of the bucket
  // * `prefix` _string_: Limits the response to keys that begin with the specified prefix.
  // * `continuation-token` _string_: Used to continue iterating over a set of objects.
  // * `delimiter` _string_: A delimiter is a character you use to group keys.
  // * `max-keys` _number_: Sets the maximum number of keys returned in the response body.
  // * `start-after` _string_: Specifies the key to start after when listing objects in a bucket.
  listObjectsV2Query(bucketName, prefix, continuationToken, delimiter, maxKeys, startAfter) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!(0, _helper.isString)(continuationToken)) {
      throw new TypeError('continuationToken should be of type "string"');
    }
    if (!(0, _helper.isString)(delimiter)) {
      throw new TypeError('delimiter should be of type "string"');
    }
    if (!(0, _helper.isNumber)(maxKeys)) {
      throw new TypeError('maxKeys should be of type "number"');
    }
    if (!(0, _helper.isString)(startAfter)) {
      throw new TypeError('startAfter should be of type "string"');
    }
    var queries = [];

    // Call for listing objects v2 API
    queries.push(`list-type=2`);
    queries.push(`encoding-type=url`);

    // escape every value in query string, except maxKeys
    queries.push(`prefix=${(0, _helper.uriEscape)(prefix)}`);
    queries.push(`delimiter=${(0, _helper.uriEscape)(delimiter)}`);
    if (continuationToken) {
      continuationToken = (0, _helper.uriEscape)(continuationToken);
      queries.push(`continuation-token=${continuationToken}`);
    }
    // Set start-after
    if (startAfter) {
      startAfter = (0, _helper.uriEscape)(startAfter);
      queries.push(`start-after=${startAfter}`);
    }
    // no need to escape maxKeys
    if (maxKeys) {
      if (maxKeys >= 1000) {
        maxKeys = 1000;
      }
      queries.push(`max-keys=${maxKeys}`);
    }
    queries.sort();
    var query = '';
    if (queries.length > 0) {
      query = `${queries.join('&')}`;
    }
    var method = 'GET';
    var transformer = transformers.getListObjectsV2Transformer();
    this.makeRequest({
      method,
      bucketName,
      query
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return transformer.emit('error', e);
      }
      (0, _helper.pipesetup)(response, transformer);
    });
    return transformer;
  }

  // List the objects in the bucket using S3 ListObjects V2
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `prefix` _string_: the prefix of the objects that should be listed (optional, default `''`)
  // * `recursive` _bool_: `true` indicates recursive style listing and `false` indicates directory style listing delimited by '/'. (optional, default `false`)
  // * `startAfter` _string_: Specifies the key to start after when listing objects in a bucket. (optional, default `''`)
  //
  // __Return Value__
  // * `stream` _Stream_: stream emitting the objects in the bucket, the object is of the format:
  //   * `obj.name` _string_: name of the object
  //   * `obj.prefix` _string_: name of the object prefix
  //   * `obj.size` _number_: size of the object
  //   * `obj.etag` _string_: etag of the object
  //   * `obj.lastModified` _Date_: modified time stamp
  listObjectsV2(bucketName, prefix, recursive, startAfter) {
    if (prefix === undefined) {
      prefix = '';
    }
    if (recursive === undefined) {
      recursive = false;
    }
    if (startAfter === undefined) {
      startAfter = '';
    }
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidPrefix)(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!(0, _helper.isBoolean)(recursive)) {
      throw new TypeError('recursive should be of type "boolean"');
    }
    if (!(0, _helper.isString)(startAfter)) {
      throw new TypeError('startAfter should be of type "string"');
    }
    // if recursive is false set delimiter to '/'
    var delimiter = recursive ? '' : '/';
    var continuationToken = '';
    var objects = [];
    var ended = false;
    var readStream = Stream.Readable({
      objectMode: true
    });
    readStream._read = () => {
      // push one object per _read()
      if (objects.length) {
        readStream.push(objects.shift());
        return;
      }
      if (ended) {
        return readStream.push(null);
      }
      // if there are no objects to push do query for the next batch of objects
      this.listObjectsV2Query(bucketName, prefix, continuationToken, delimiter, 1000, startAfter).on('error', e => readStream.emit('error', e)).on('data', result => {
        if (result.isTruncated) {
          continuationToken = result.nextContinuationToken;
        } else {
          ended = true;
        }
        objects = result.objects;
        readStream._read();
      });
    };
    return readStream;
  }

  // Remove all the objects residing in the objectsList.
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `objectsList` _array_: array of objects of one of the following:
  // *         List of Object names as array of strings which are object keys:  ['objectname1','objectname2']
  // *         List of Object name and versionId as an object:  [{name:"objectname",versionId:"my-version-id"}]

  removeObjects(bucketName, objectsList, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!Array.isArray(objectsList)) {
      throw new errors.InvalidArgumentError('objectsList should be a list');
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    const maxEntries = 1000;
    const query = 'delete';
    const method = 'POST';
    let result = objectsList.reduce((result, entry) => {
      result.list.push(entry);
      if (result.list.length === maxEntries) {
        result.listOfList.push(result.list);
        result.list = [];
      }
      return result;
    }, {
      listOfList: [],
      list: []
    });
    if (result.list.length > 0) {
      result.listOfList.push(result.list);
    }
    const encoder = new _webEncoding.TextEncoder();
    const batchResults = [];
    _async.eachSeries(result.listOfList, (list, batchCb) => {
      var objects = [];
      list.forEach(function (value) {
        if ((0, _helper.isObject)(value)) {
          objects.push({
            Key: value.name,
            VersionId: value.versionId
          });
        } else {
          objects.push({
            Key: value
          });
        }
      });
      let deleteObjects = {
        Delete: {
          Quiet: true,
          Object: objects
        }
      };
      const builder = new _xml2js.Builder({
        headless: true
      });
      let payload = builder.buildObject(deleteObjects);
      payload = Buffer.from(encoder.encode(payload));
      const headers = {};
      headers['Content-MD5'] = (0, _helper.toMd5)(payload);
      let removeObjectsResult;
      this.makeRequest({
        method,
        bucketName,
        query,
        headers
      }, payload, [200], '', true, (e, response) => {
        if (e) {
          return batchCb(e);
        }
        (0, _helper.pipesetup)(response, transformers.removeObjectsTransformer()).on('data', data => {
          removeObjectsResult = data;
        }).on('error', e => {
          return batchCb(e, null);
        }).on('end', () => {
          batchResults.push(removeObjectsResult);
          return batchCb(null, removeObjectsResult);
        });
      });
    }, () => {
      cb(null, _lodash.flatten(batchResults));
    });
  }

  // Generate a generic presigned URL which can be
  // used for HTTP methods GET, PUT, HEAD and DELETE
  //
  // __Arguments__
  // * `method` _string_: name of the HTTP method
  // * `bucketName` _string_: name of the bucket
  // * `objectName` _string_: name of the object
  // * `expiry` _number_: expiry in seconds (optional, default 7 days)
  // * `reqParams` _object_: request parameters (optional) e.g {versionId:"10fa9946-3f64-4137-a58f-888065c0732e"}
  // * `requestDate` _Date_: A date object, the url will be issued at (optional)
  presignedUrl(method, bucketName, objectName, expires, reqParams, requestDate, cb) {
    if (this.anonymous) {
      throw new errors.AnonymousRequestError('Presigned ' + method + ' url cannot be generated for anonymous requests');
    }
    if ((0, _helper.isFunction)(requestDate)) {
      cb = requestDate;
      requestDate = new Date();
    }
    if ((0, _helper.isFunction)(reqParams)) {
      cb = reqParams;
      reqParams = {};
      requestDate = new Date();
    }
    if ((0, _helper.isFunction)(expires)) {
      cb = expires;
      reqParams = {};
      expires = 24 * 60 * 60 * 7; // 7 days in seconds
      requestDate = new Date();
    }
    if (!(0, _helper.isNumber)(expires)) {
      throw new TypeError('expires should be of type "number"');
    }
    if (!(0, _helper.isObject)(reqParams)) {
      throw new TypeError('reqParams should be of type "object"');
    }
    if (!(0, _helper.isValidDate)(requestDate)) {
      throw new TypeError('requestDate should be of type "Date" and valid');
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var query = querystring.stringify(reqParams);
    this.getBucketRegion(bucketName, (e, region) => {
      if (e) {
        return cb(e);
      }
      // This statement is added to ensure that we send error through
      // callback on presign failure.
      var url;
      var reqOptions = this.getRequestOptions({
        method,
        region,
        bucketName,
        objectName,
        query
      });
      this.checkAndRefreshCreds();
      try {
        url = (0, _signing.presignSignatureV4)(reqOptions, this.accessKey, this.secretKey, this.sessionToken, region, requestDate, expires);
      } catch (pe) {
        return cb(pe);
      }
      cb(null, url);
    });
  }

  // Generate a presigned URL for GET
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `objectName` _string_: name of the object
  // * `expiry` _number_: expiry in seconds (optional, default 7 days)
  // * `respHeaders` _object_: response headers to override or request params for query (optional) e.g {versionId:"10fa9946-3f64-4137-a58f-888065c0732e"}
  // * `requestDate` _Date_: A date object, the url will be issued at (optional)
  presignedGetObject(bucketName, objectName, expires, respHeaders, requestDate, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if ((0, _helper.isFunction)(respHeaders)) {
      cb = respHeaders;
      respHeaders = {};
      requestDate = new Date();
    }
    var validRespHeaders = ['response-content-type', 'response-content-language', 'response-expires', 'response-cache-control', 'response-content-disposition', 'response-content-encoding'];
    validRespHeaders.forEach(header => {
      if (respHeaders !== undefined && respHeaders[header] !== undefined && !(0, _helper.isString)(respHeaders[header])) {
        throw new TypeError(`response header ${header} should be of type "string"`);
      }
    });
    return this.presignedUrl('GET', bucketName, objectName, expires, respHeaders, requestDate, cb);
  }

  // Generate a presigned URL for PUT. Using this URL, the browser can upload to S3 only with the specified object name.
  //
  // __Arguments__
  // * `bucketName` _string_: name of the bucket
  // * `objectName` _string_: name of the object
  // * `expiry` _number_: expiry in seconds (optional, default 7 days)
  presignedPutObject(bucketName, objectName, expires, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    return this.presignedUrl('PUT', bucketName, objectName, expires, cb);
  }

  // return PostPolicy object
  newPostPolicy() {
    return new _postPolicy.PostPolicy();
  }

  // presignedPostPolicy can be used in situations where we want more control on the upload than what
  // presignedPutObject() provides. i.e Using presignedPostPolicy we will be able to put policy restrictions
  // on the object's `name` `bucket` `expiry` `Content-Type` `Content-Disposition` `metaData`
  presignedPostPolicy(postPolicy, cb) {
    if (this.anonymous) {
      throw new errors.AnonymousRequestError('Presigned POST policy cannot be generated for anonymous requests');
    }
    if (!(0, _helper.isObject)(postPolicy)) {
      throw new TypeError('postPolicy should be of type "object"');
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('cb should be of type "function"');
    }
    this.getBucketRegion(postPolicy.formData.bucket, (e, region) => {
      if (e) {
        return cb(e);
      }
      var date = new Date();
      var dateStr = (0, _helper.makeDateLong)(date);
      this.checkAndRefreshCreds();
      if (!postPolicy.policy.expiration) {
        // 'expiration' is mandatory field for S3.
        // Set default expiration date of 7 days.
        var expires = new Date();
        expires.setSeconds(24 * 60 * 60 * 7);
        postPolicy.setExpires(expires);
      }
      postPolicy.policy.conditions.push(['eq', '$x-amz-date', dateStr]);
      postPolicy.formData['x-amz-date'] = dateStr;
      postPolicy.policy.conditions.push(['eq', '$x-amz-algorithm', 'AWS4-HMAC-SHA256']);
      postPolicy.formData['x-amz-algorithm'] = 'AWS4-HMAC-SHA256';
      postPolicy.policy.conditions.push(['eq', '$x-amz-credential', this.accessKey + '/' + (0, _helper.getScope)(region, date)]);
      postPolicy.formData['x-amz-credential'] = this.accessKey + '/' + (0, _helper.getScope)(region, date);
      if (this.sessionToken) {
        postPolicy.policy.conditions.push(['eq', '$x-amz-security-token', this.sessionToken]);
        postPolicy.formData['x-amz-security-token'] = this.sessionToken;
      }
      var policyBase64 = Buffer.from(JSON.stringify(postPolicy.policy)).toString('base64');
      postPolicy.formData.policy = policyBase64;
      var signature = (0, _signing.postPresignSignatureV4)(region, date, this.secretKey, policyBase64);
      postPolicy.formData['x-amz-signature'] = signature;
      var opts = {};
      opts.region = region;
      opts.bucketName = postPolicy.formData.bucket;
      var reqOptions = this.getRequestOptions(opts);
      var portStr = this.port == 80 || this.port === 443 ? '' : `:${this.port.toString()}`;
      var urlStr = `${reqOptions.protocol}//${reqOptions.host}${portStr}${reqOptions.path}`;
      cb(null, {
        postURL: urlStr,
        formData: postPolicy.formData
      });
    });
  }

  // Remove all the notification configurations in the S3 provider
  setBucketNotification(bucketName, config, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isObject)(config)) {
      throw new TypeError('notification config should be of type "Object"');
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var method = 'PUT';
    var query = 'notification';
    var builder = new _xml2js.Builder({
      rootName: 'NotificationConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    var payload = builder.buildObject(config);
    this.makeRequest({
      method,
      bucketName,
      query
    }, payload, [200], '', false, cb);
  }
  removeAllBucketNotification(bucketName, cb) {
    this.setBucketNotification(bucketName, new _notification.NotificationConfig(), cb);
  }

  // Return the list of notification configurations stored
  // in the S3 provider
  getBucketNotification(bucketName, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var method = 'GET';
    var query = 'notification';
    this.makeRequest({
      method,
      bucketName,
      query
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return cb(e);
      }
      var transformer = transformers.getBucketNotificationTransformer();
      var bucketNotification;
      (0, _helper.pipesetup)(response, transformer).on('data', result => bucketNotification = result).on('error', e => cb(e)).on('end', () => cb(null, bucketNotification));
    });
  }

  // Listens for bucket notifications. Returns an EventEmitter.
  listenBucketNotification(bucketName, prefix, suffix, events) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix must be of type string');
    }
    if (!(0, _helper.isString)(suffix)) {
      throw new TypeError('suffix must be of type string');
    }
    if (!Array.isArray(events)) {
      throw new TypeError('events must be of type Array');
    }
    let listener = new _notification.NotificationPoller(this, bucketName, prefix, suffix, events);
    listener.start();
    return listener;
  }
  getObjectRetention(bucketName, objectName, getOpts, cb) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(getOpts)) {
      throw new errors.InvalidArgumentError('callback should be of type "object"');
    } else if (getOpts.versionId && !(0, _helper.isString)(getOpts.versionId)) {
      throw new errors.InvalidArgumentError('VersionID should be of type "string"');
    }
    if (cb && !(0, _helper.isFunction)(cb)) {
      throw new errors.InvalidArgumentError('callback should be of type "function"');
    }
    const method = 'GET';
    let query = 'retention';
    if (getOpts.versionId) {
      query += `&versionId=${getOpts.versionId}`;
    }
    this.makeRequest({
      method,
      bucketName,
      objectName,
      query
    }, '', [200], '', true, (e, response) => {
      if (e) {
        return cb(e);
      }
      let retentionConfig = Buffer.from('');
      (0, _helper.pipesetup)(response, transformers.objectRetentionTransformer()).on('data', data => {
        retentionConfig = data;
      }).on('error', cb).on('end', () => {
        cb(null, retentionConfig);
      });
    });
  }

  /**
   * Internal method to upload a part during compose object.
   * @param partConfig __object__ contains the following.
   *    bucketName __string__
   *    objectName __string__
   *    uploadID __string__
   *    partNumber __number__
   *    headers __object__
   * @param cb called with null incase of error.
   */
  uploadPartCopy(partConfig, cb) {
    const {
      bucketName,
      objectName,
      uploadID,
      partNumber,
      headers
    } = partConfig;
    const method = 'PUT';
    let query = `uploadId=${uploadID}&partNumber=${partNumber}`;
    const requestOptions = {
      method,
      bucketName,
      objectName: objectName,
      query,
      headers
    };
    return this.makeRequest(requestOptions, '', [200], '', true, (e, response) => {
      let partCopyResult = Buffer.from('');
      if (e) {
        return cb(e);
      }
      (0, _helper.pipesetup)(response, transformers.uploadPartTransformer()).on('data', data => {
        partCopyResult = data;
      }).on('error', cb).on('end', () => {
        let uploadPartCopyRes = {
          etag: (0, _helper.sanitizeETag)(partCopyResult.ETag),
          key: objectName,
          part: partNumber
        };
        cb(null, uploadPartCopyRes);
      });
    });
  }
  composeObject(destObjConfig = {}, sourceObjList = [], cb) {
    const me = this; // many async flows. so store the ref.
    const sourceFilesLength = sourceObjList.length;
    if (!Array.isArray(sourceObjList)) {
      throw new errors.InvalidArgumentError('sourceConfig should an array of CopySourceOptions ');
    }
    if (!(destObjConfig instanceof _helpers.CopyDestinationOptions)) {
      throw new errors.InvalidArgumentError('destConfig should of type CopyDestinationOptions ');
    }
    if (sourceFilesLength < 1 || sourceFilesLength > _helper.PART_CONSTRAINTS.MAX_PARTS_COUNT) {
      throw new errors.InvalidArgumentError(`"There must be as least one and up to ${_helper.PART_CONSTRAINTS.MAX_PARTS_COUNT} source objects.`);
    }
    if (!(0, _helper.isFunction)(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    for (let i = 0; i < sourceFilesLength; i++) {
      if (!sourceObjList[i].validate()) {
        return false;
      }
    }
    if (!destObjConfig.validate()) {
      return false;
    }
    const getStatOptions = srcConfig => {
      let statOpts = {};
      if (!_lodash.isEmpty(srcConfig.VersionID)) {
        statOpts = {
          versionId: srcConfig.VersionID
        };
      }
      return statOpts;
    };
    const srcObjectSizes = [];
    let totalSize = 0;
    let totalParts = 0;
    const sourceObjStats = sourceObjList.map(srcItem => me.statObject(srcItem.Bucket, srcItem.Object, getStatOptions(srcItem)));
    return Promise.all(sourceObjStats).then(srcObjectInfos => {
      const validatedStats = srcObjectInfos.map((resItemStat, index) => {
        const srcConfig = sourceObjList[index];
        let srcCopySize = resItemStat.size;
        // Check if a segment is specified, and if so, is the
        // segment within object bounds?
        if (srcConfig.MatchRange) {
          // Since range is specified,
          //    0 <= src.srcStart <= src.srcEnd
          // so only invalid case to check is:
          const srcStart = srcConfig.Start;
          const srcEnd = srcConfig.End;
          if (srcEnd >= srcCopySize || srcStart < 0) {
            throw new errors.InvalidArgumentError(`CopySrcOptions ${index} has invalid segment-to-copy [${srcStart}, ${srcEnd}] (size is ${srcCopySize})`);
          }
          srcCopySize = srcEnd - srcStart + 1;
        }

        // Only the last source may be less than `absMinPartSize`
        if (srcCopySize < _helper.PART_CONSTRAINTS.ABS_MIN_PART_SIZE && index < sourceFilesLength - 1) {
          throw new errors.InvalidArgumentError(`CopySrcOptions ${index} is too small (${srcCopySize}) and it is not the last part.`);
        }

        // Is data to copy too large?
        totalSize += srcCopySize;
        if (totalSize > _helper.PART_CONSTRAINTS.MAX_MULTIPART_PUT_OBJECT_SIZE) {
          throw new errors.InvalidArgumentError(`Cannot compose an object of size ${totalSize} (> 5TiB)`);
        }

        // record source size
        srcObjectSizes[index] = srcCopySize;

        // calculate parts needed for current source
        totalParts += (0, _helper.partsRequired)(srcCopySize);
        // Do we need more parts than we are allowed?
        if (totalParts > _helper.PART_CONSTRAINTS.MAX_PARTS_COUNT) {
          throw new errors.InvalidArgumentError(`Your proposed compose object requires more than ${_helper.PART_CONSTRAINTS.MAX_PARTS_COUNT} parts`);
        }
        return resItemStat;
      });
      if (totalParts === 1 && totalSize <= _helper.PART_CONSTRAINTS.MAX_PART_SIZE || totalSize === 0) {
        return this.copyObject(sourceObjList[0], destObjConfig, cb); // use copyObjectV2
      }

      // preserve etag to avoid modification of object while copying.
      for (let i = 0; i < sourceFilesLength; i++) {
        sourceObjList[i].MatchETag = validatedStats[i].etag;
      }
      const splitPartSizeList = validatedStats.map((resItemStat, idx) => {
        const calSize = (0, _helper.calculateEvenSplits)(srcObjectSizes[idx], sourceObjList[idx]);
        return calSize;
      });
      function getUploadPartConfigList(uploadId) {
        const uploadPartConfigList = [];
        splitPartSizeList.forEach((splitSize, splitIndex) => {
          const {
            startIndex: startIdx,
            endIndex: endIdx,
            objInfo: objConfig
          } = splitSize;
          let partIndex = splitIndex + 1; // part index starts from 1.
          const totalUploads = Array.from(startIdx);
          const headers = sourceObjList[splitIndex].getHeaders();
          totalUploads.forEach((splitStart, upldCtrIdx) => {
            let splitEnd = endIdx[upldCtrIdx];
            const sourceObj = `${objConfig.Bucket}/${objConfig.Object}`;
            headers['x-amz-copy-source'] = `${sourceObj}`;
            headers['x-amz-copy-source-range'] = `bytes=${splitStart}-${splitEnd}`;
            const uploadPartConfig = {
              bucketName: destObjConfig.Bucket,
              objectName: destObjConfig.Object,
              uploadID: uploadId,
              partNumber: partIndex,
              headers: headers,
              sourceObj: sourceObj
            };
            uploadPartConfigList.push(uploadPartConfig);
          });
        });
        return uploadPartConfigList;
      }
      const performUploadParts = uploadId => {
        const uploadList = getUploadPartConfigList(uploadId);
        _async.map(uploadList, me.uploadPartCopy.bind(me), (err, res) => {
          if (err) {
            this.abortMultipartUpload(destObjConfig.Bucket, destObjConfig.Object, uploadId).then(() => cb(), err => cb(err));
            return;
          }
          const partsDone = res.map(partCopy => ({
            etag: partCopy.etag,
            part: partCopy.part
          }));
          return me.completeMultipartUpload(destObjConfig.Bucket, destObjConfig.Object, uploadId, partsDone).then(result => cb(null, result), err => cb(err));
        });
      };
      const newUploadHeaders = destObjConfig.getHeaders();
      me.initiateNewMultipartUpload(destObjConfig.Bucket, destObjConfig.Object, newUploadHeaders).then(uploadId => {
        performUploadParts(uploadId);
      }, err => {
        cb(err, null);
      });
    }).catch(error => {
      cb(error, null);
    });
  }
}

// Promisify various public-facing APIs on the Client module.
exports.Client = Client;
Client.prototype.copyObject = (0, _promisify.promisify)(Client.prototype.copyObject);
Client.prototype.removeObjects = (0, _promisify.promisify)(Client.prototype.removeObjects);
Client.prototype.presignedUrl = (0, _promisify.promisify)(Client.prototype.presignedUrl);
Client.prototype.presignedGetObject = (0, _promisify.promisify)(Client.prototype.presignedGetObject);
Client.prototype.presignedPutObject = (0, _promisify.promisify)(Client.prototype.presignedPutObject);
Client.prototype.presignedPostPolicy = (0, _promisify.promisify)(Client.prototype.presignedPostPolicy);
Client.prototype.getBucketNotification = (0, _promisify.promisify)(Client.prototype.getBucketNotification);
Client.prototype.setBucketNotification = (0, _promisify.promisify)(Client.prototype.setBucketNotification);
Client.prototype.removeAllBucketNotification = (0, _promisify.promisify)(Client.prototype.removeAllBucketNotification);
Client.prototype.removeIncompleteUpload = (0, _promisify.promisify)(Client.prototype.removeIncompleteUpload);
Client.prototype.getObjectRetention = (0, _promisify.promisify)(Client.prototype.getObjectRetention);
Client.prototype.composeObject = (0, _promisify.promisify)(Client.prototype.composeObject);

// refactored API use promise internally
Client.prototype.makeBucket = (0, _callbackify.callbackify)(Client.prototype.makeBucket);
Client.prototype.bucketExists = (0, _callbackify.callbackify)(Client.prototype.bucketExists);
Client.prototype.removeBucket = (0, _callbackify.callbackify)(Client.prototype.removeBucket);
Client.prototype.listBuckets = (0, _callbackify.callbackify)(Client.prototype.listBuckets);
Client.prototype.getObject = (0, _callbackify.callbackify)(Client.prototype.getObject);
Client.prototype.fGetObject = (0, _callbackify.callbackify)(Client.prototype.fGetObject);
Client.prototype.getPartialObject = (0, _callbackify.callbackify)(Client.prototype.getPartialObject);
Client.prototype.statObject = (0, _callbackify.callbackify)(Client.prototype.statObject);
Client.prototype.putObjectRetention = (0, _callbackify.callbackify)(Client.prototype.putObjectRetention);
Client.prototype.putObject = (0, _callbackify.callbackify)(Client.prototype.putObject);
Client.prototype.fPutObject = (0, _callbackify.callbackify)(Client.prototype.fPutObject);
Client.prototype.removeObject = (0, _callbackify.callbackify)(Client.prototype.removeObject);
Client.prototype.removeBucketReplication = (0, _callbackify.callbackify)(Client.prototype.removeBucketReplication);
Client.prototype.setBucketReplication = (0, _callbackify.callbackify)(Client.prototype.setBucketReplication);
Client.prototype.getBucketReplication = (0, _callbackify.callbackify)(Client.prototype.getBucketReplication);
Client.prototype.getObjectLegalHold = (0, _callbackify.callbackify)(Client.prototype.getObjectLegalHold);
Client.prototype.setObjectLegalHold = (0, _callbackify.callbackify)(Client.prototype.setObjectLegalHold);
Client.prototype.setObjectLockConfig = (0, _callbackify.callbackify)(Client.prototype.setObjectLockConfig);
Client.prototype.getObjectLockConfig = (0, _callbackify.callbackify)(Client.prototype.getObjectLockConfig);
Client.prototype.getBucketPolicy = (0, _callbackify.callbackify)(Client.prototype.getBucketPolicy);
Client.prototype.setBucketPolicy = (0, _callbackify.callbackify)(Client.prototype.setBucketPolicy);
Client.prototype.getBucketTagging = (0, _callbackify.callbackify)(Client.prototype.getBucketTagging);
Client.prototype.getObjectTagging = (0, _callbackify.callbackify)(Client.prototype.getObjectTagging);
Client.prototype.setBucketTagging = (0, _callbackify.callbackify)(Client.prototype.setBucketTagging);
Client.prototype.removeBucketTagging = (0, _callbackify.callbackify)(Client.prototype.removeBucketTagging);
Client.prototype.setObjectTagging = (0, _callbackify.callbackify)(Client.prototype.setObjectTagging);
Client.prototype.removeObjectTagging = (0, _callbackify.callbackify)(Client.prototype.removeObjectTagging);
Client.prototype.getBucketVersioning = (0, _callbackify.callbackify)(Client.prototype.getBucketVersioning);
Client.prototype.setBucketVersioning = (0, _callbackify.callbackify)(Client.prototype.setBucketVersioning);
Client.prototype.selectObjectContent = (0, _callbackify.callbackify)(Client.prototype.selectObjectContent);
Client.prototype.setBucketLifecycle = (0, _callbackify.callbackify)(Client.prototype.setBucketLifecycle);
Client.prototype.getBucketLifecycle = (0, _callbackify.callbackify)(Client.prototype.getBucketLifecycle);
Client.prototype.removeBucketLifecycle = (0, _callbackify.callbackify)(Client.prototype.removeBucketLifecycle);
Client.prototype.setBucketEncryption = (0, _callbackify.callbackify)(Client.prototype.setBucketEncryption);
Client.prototype.getBucketEncryption = (0, _callbackify.callbackify)(Client.prototype.getBucketEncryption);
Client.prototype.removeBucketEncryption = (0, _callbackify.callbackify)(Client.prototype.removeBucketEncryption);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJTdHJlYW0iLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsInJlcXVpcmUiLCJfYXN5bmMiLCJfbG9kYXNoIiwicXVlcnlzdHJpbmciLCJfd2ViRW5jb2RpbmciLCJfeG1sMmpzIiwiZXJyb3JzIiwiT2JqZWN0Iiwia2V5cyIsImZvckVhY2giLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJfZXhwb3J0TmFtZXMiLCJleHBvcnRzIiwiX2hlbHBlcnMiLCJfY2FsbGJhY2tpZnkiLCJfY2xpZW50IiwiX2NvcHlDb25kaXRpb25zIiwiQ29weUNvbmRpdGlvbnMiLCJfaGVscGVyIiwiX3Bvc3RQb2xpY3kiLCJQb3N0UG9saWN5IiwiX25vdGlmaWNhdGlvbiIsIl9wcm9taXNpZnkiLCJfc2lnbmluZyIsInRyYW5zZm9ybWVycyIsIl9nZXRSZXF1aXJlV2lsZGNhcmRDYWNoZSIsIm5vZGVJbnRlcm9wIiwiV2Vha01hcCIsImNhY2hlQmFiZWxJbnRlcm9wIiwiY2FjaGVOb2RlSW50ZXJvcCIsIm9iaiIsIl9fZXNNb2R1bGUiLCJkZWZhdWx0IiwiY2FjaGUiLCJoYXMiLCJnZXQiLCJuZXdPYmoiLCJoYXNQcm9wZXJ0eURlc2NyaXB0b3IiLCJkZWZpbmVQcm9wZXJ0eSIsImdldE93blByb3BlcnR5RGVzY3JpcHRvciIsImRlc2MiLCJzZXQiLCJDbGllbnQiLCJUeXBlZENsaWVudCIsInNldEFwcEluZm8iLCJhcHBOYW1lIiwiYXBwVmVyc2lvbiIsImlzU3RyaW5nIiwiVHlwZUVycm9yIiwidHJpbSIsIkludmFsaWRBcmd1bWVudEVycm9yIiwidXNlckFnZW50IiwicmVtb3ZlSW5jb21wbGV0ZVVwbG9hZCIsImJ1Y2tldE5hbWUiLCJvYmplY3ROYW1lIiwiY2IiLCJpc1ZhbGlkQnVja2V0TmFtZSIsIklzVmFsaWRCdWNrZXROYW1lRXJyb3IiLCJpc1ZhbGlkT2JqZWN0TmFtZSIsIkludmFsaWRPYmplY3ROYW1lRXJyb3IiLCJpc0Z1bmN0aW9uIiwicmVtb3ZlVXBsb2FkSWQiLCJhc3luYyIsImR1cmluZyIsImZpbmRVcGxvYWRJZCIsInRoZW4iLCJ1cGxvYWRJZCIsIm1ldGhvZCIsInF1ZXJ5IiwibWFrZVJlcXVlc3QiLCJlIiwiY29weU9iamVjdFYxIiwiYXJnMSIsImFyZzIiLCJhcmczIiwiYXJnNCIsImFyZzUiLCJzcmNPYmplY3QiLCJjb25kaXRpb25zIiwidW5kZWZpbmVkIiwiSW52YWxpZEJ1Y2tldE5hbWVFcnJvciIsIkludmFsaWRQcmVmaXhFcnJvciIsImhlYWRlcnMiLCJ1cmlSZXNvdXJjZUVzY2FwZSIsIm1vZGlmaWVkIiwidW5tb2RpZmllZCIsIm1hdGNoRVRhZyIsIm1hdGNoRXRhZ0V4Y2VwdCIsIm1hdGNoRVRhZ0V4Y2VwdCIsInJlc3BvbnNlIiwidHJhbnNmb3JtZXIiLCJnZXRDb3B5T2JqZWN0VHJhbnNmb3JtZXIiLCJwaXBlc2V0dXAiLCJvbiIsImRhdGEiLCJjb3B5T2JqZWN0VjIiLCJzb3VyY2VDb25maWciLCJkZXN0Q29uZmlnIiwiQ29weVNvdXJjZU9wdGlvbnMiLCJDb3B5RGVzdGluYXRpb25PcHRpb25zIiwidmFsaWRhdGUiLCJhc3NpZ24iLCJnZXRIZWFkZXJzIiwiQnVja2V0IiwicmVzSGVhZGVycyIsImNvcHlPYmpSZXNwb25zZSIsIktleSIsIkxhc3RNb2RpZmllZCIsIk1ldGFEYXRhIiwiZXh0cmFjdE1ldGFkYXRhIiwiVmVyc2lvbklkIiwiZ2V0VmVyc2lvbklkIiwiU291cmNlVmVyc2lvbklkIiwiZ2V0U291cmNlVmVyc2lvbklkIiwiRXRhZyIsInNhbml0aXplRVRhZyIsImV0YWciLCJTaXplIiwiY29weU9iamVjdCIsImFsbEFyZ3MiLCJhcmd1bWVudHMiLCJsaXN0T2JqZWN0c1F1ZXJ5IiwicHJlZml4IiwibWFya2VyIiwibGlzdFF1ZXJ5T3B0cyIsIkRlbGltaXRlciIsIk1heEtleXMiLCJJbmNsdWRlVmVyc2lvbiIsImlzT2JqZWN0IiwiaXNOdW1iZXIiLCJxdWVyaWVzIiwicHVzaCIsInVyaUVzY2FwZSIsInNvcnQiLCJsZW5ndGgiLCJqb2luIiwiZ2V0TGlzdE9iamVjdHNUcmFuc2Zvcm1lciIsImVtaXQiLCJsaXN0T2JqZWN0cyIsInJlY3Vyc2l2ZSIsImxpc3RPcHRzIiwiaXNWYWxpZFByZWZpeCIsImlzQm9vbGVhbiIsIm9iamVjdHMiLCJlbmRlZCIsInJlYWRTdHJlYW0iLCJSZWFkYWJsZSIsIm9iamVjdE1vZGUiLCJfcmVhZCIsInNoaWZ0IiwicmVzdWx0IiwiaXNUcnVuY2F0ZWQiLCJuZXh0TWFya2VyIiwidmVyc2lvbklkTWFya2VyIiwibGlzdE9iamVjdHNWMlF1ZXJ5IiwiY29udGludWF0aW9uVG9rZW4iLCJkZWxpbWl0ZXIiLCJtYXhLZXlzIiwic3RhcnRBZnRlciIsImdldExpc3RPYmplY3RzVjJUcmFuc2Zvcm1lciIsImxpc3RPYmplY3RzVjIiLCJuZXh0Q29udGludWF0aW9uVG9rZW4iLCJyZW1vdmVPYmplY3RzIiwib2JqZWN0c0xpc3QiLCJBcnJheSIsImlzQXJyYXkiLCJtYXhFbnRyaWVzIiwicmVkdWNlIiwiZW50cnkiLCJsaXN0IiwibGlzdE9mTGlzdCIsImVuY29kZXIiLCJUZXh0RW5jb2RlciIsImJhdGNoUmVzdWx0cyIsImVhY2hTZXJpZXMiLCJiYXRjaENiIiwidmFsdWUiLCJuYW1lIiwidmVyc2lvbklkIiwiZGVsZXRlT2JqZWN0cyIsIkRlbGV0ZSIsIlF1aWV0IiwiYnVpbGRlciIsInhtbDJqcyIsIkJ1aWxkZXIiLCJoZWFkbGVzcyIsInBheWxvYWQiLCJidWlsZE9iamVjdCIsIkJ1ZmZlciIsImZyb20iLCJlbmNvZGUiLCJ0b01kNSIsInJlbW92ZU9iamVjdHNSZXN1bHQiLCJyZW1vdmVPYmplY3RzVHJhbnNmb3JtZXIiLCJfIiwiZmxhdHRlbiIsInByZXNpZ25lZFVybCIsImV4cGlyZXMiLCJyZXFQYXJhbXMiLCJyZXF1ZXN0RGF0ZSIsImFub255bW91cyIsIkFub255bW91c1JlcXVlc3RFcnJvciIsIkRhdGUiLCJpc1ZhbGlkRGF0ZSIsInN0cmluZ2lmeSIsImdldEJ1Y2tldFJlZ2lvbiIsInJlZ2lvbiIsInVybCIsInJlcU9wdGlvbnMiLCJnZXRSZXF1ZXN0T3B0aW9ucyIsImNoZWNrQW5kUmVmcmVzaENyZWRzIiwicHJlc2lnblNpZ25hdHVyZVY0IiwiYWNjZXNzS2V5Iiwic2VjcmV0S2V5Iiwic2Vzc2lvblRva2VuIiwicGUiLCJwcmVzaWduZWRHZXRPYmplY3QiLCJyZXNwSGVhZGVycyIsInZhbGlkUmVzcEhlYWRlcnMiLCJoZWFkZXIiLCJwcmVzaWduZWRQdXRPYmplY3QiLCJuZXdQb3N0UG9saWN5IiwicHJlc2lnbmVkUG9zdFBvbGljeSIsInBvc3RQb2xpY3kiLCJmb3JtRGF0YSIsImJ1Y2tldCIsImRhdGUiLCJkYXRlU3RyIiwibWFrZURhdGVMb25nIiwicG9saWN5IiwiZXhwaXJhdGlvbiIsInNldFNlY29uZHMiLCJzZXRFeHBpcmVzIiwiZ2V0U2NvcGUiLCJwb2xpY3lCYXNlNjQiLCJKU09OIiwidG9TdHJpbmciLCJzaWduYXR1cmUiLCJwb3N0UHJlc2lnblNpZ25hdHVyZVY0Iiwib3B0cyIsInBvcnRTdHIiLCJwb3J0IiwidXJsU3RyIiwicHJvdG9jb2wiLCJob3N0IiwicGF0aCIsInBvc3RVUkwiLCJzZXRCdWNrZXROb3RpZmljYXRpb24iLCJjb25maWciLCJyb290TmFtZSIsInJlbmRlck9wdHMiLCJwcmV0dHkiLCJyZW1vdmVBbGxCdWNrZXROb3RpZmljYXRpb24iLCJOb3RpZmljYXRpb25Db25maWciLCJnZXRCdWNrZXROb3RpZmljYXRpb24iLCJnZXRCdWNrZXROb3RpZmljYXRpb25UcmFuc2Zvcm1lciIsImJ1Y2tldE5vdGlmaWNhdGlvbiIsImxpc3RlbkJ1Y2tldE5vdGlmaWNhdGlvbiIsInN1ZmZpeCIsImV2ZW50cyIsImxpc3RlbmVyIiwiTm90aWZpY2F0aW9uUG9sbGVyIiwic3RhcnQiLCJnZXRPYmplY3RSZXRlbnRpb24iLCJnZXRPcHRzIiwicmV0ZW50aW9uQ29uZmlnIiwib2JqZWN0UmV0ZW50aW9uVHJhbnNmb3JtZXIiLCJ1cGxvYWRQYXJ0Q29weSIsInBhcnRDb25maWciLCJ1cGxvYWRJRCIsInBhcnROdW1iZXIiLCJyZXF1ZXN0T3B0aW9ucyIsInBhcnRDb3B5UmVzdWx0IiwidXBsb2FkUGFydFRyYW5zZm9ybWVyIiwidXBsb2FkUGFydENvcHlSZXMiLCJFVGFnIiwicGFydCIsImNvbXBvc2VPYmplY3QiLCJkZXN0T2JqQ29uZmlnIiwic291cmNlT2JqTGlzdCIsIm1lIiwic291cmNlRmlsZXNMZW5ndGgiLCJQQVJUX0NPTlNUUkFJTlRTIiwiTUFYX1BBUlRTX0NPVU5UIiwiaSIsImdldFN0YXRPcHRpb25zIiwic3JjQ29uZmlnIiwic3RhdE9wdHMiLCJpc0VtcHR5IiwiVmVyc2lvbklEIiwic3JjT2JqZWN0U2l6ZXMiLCJ0b3RhbFNpemUiLCJ0b3RhbFBhcnRzIiwic291cmNlT2JqU3RhdHMiLCJtYXAiLCJzcmNJdGVtIiwic3RhdE9iamVjdCIsIlByb21pc2UiLCJhbGwiLCJzcmNPYmplY3RJbmZvcyIsInZhbGlkYXRlZFN0YXRzIiwicmVzSXRlbVN0YXQiLCJpbmRleCIsInNyY0NvcHlTaXplIiwic2l6ZSIsIk1hdGNoUmFuZ2UiLCJzcmNTdGFydCIsIlN0YXJ0Iiwic3JjRW5kIiwiRW5kIiwiQUJTX01JTl9QQVJUX1NJWkUiLCJNQVhfTVVMVElQQVJUX1BVVF9PQkpFQ1RfU0laRSIsInBhcnRzUmVxdWlyZWQiLCJNQVhfUEFSVF9TSVpFIiwiTWF0Y2hFVGFnIiwic3BsaXRQYXJ0U2l6ZUxpc3QiLCJpZHgiLCJjYWxTaXplIiwiY2FsY3VsYXRlRXZlblNwbGl0cyIsImdldFVwbG9hZFBhcnRDb25maWdMaXN0IiwidXBsb2FkUGFydENvbmZpZ0xpc3QiLCJzcGxpdFNpemUiLCJzcGxpdEluZGV4Iiwic3RhcnRJbmRleCIsInN0YXJ0SWR4IiwiZW5kSW5kZXgiLCJlbmRJZHgiLCJvYmpJbmZvIiwib2JqQ29uZmlnIiwicGFydEluZGV4IiwidG90YWxVcGxvYWRzIiwic3BsaXRTdGFydCIsInVwbGRDdHJJZHgiLCJzcGxpdEVuZCIsInNvdXJjZU9iaiIsInVwbG9hZFBhcnRDb25maWciLCJwZXJmb3JtVXBsb2FkUGFydHMiLCJ1cGxvYWRMaXN0IiwiYmluZCIsImVyciIsInJlcyIsImFib3J0TXVsdGlwYXJ0VXBsb2FkIiwicGFydHNEb25lIiwicGFydENvcHkiLCJjb21wbGV0ZU11bHRpcGFydFVwbG9hZCIsIm5ld1VwbG9hZEhlYWRlcnMiLCJpbml0aWF0ZU5ld011bHRpcGFydFVwbG9hZCIsImNhdGNoIiwiZXJyb3IiLCJwcm9taXNpZnkiLCJtYWtlQnVja2V0IiwiY2FsbGJhY2tpZnkiLCJidWNrZXRFeGlzdHMiLCJyZW1vdmVCdWNrZXQiLCJsaXN0QnVja2V0cyIsImdldE9iamVjdCIsImZHZXRPYmplY3QiLCJnZXRQYXJ0aWFsT2JqZWN0IiwicHV0T2JqZWN0UmV0ZW50aW9uIiwicHV0T2JqZWN0IiwiZlB1dE9iamVjdCIsInJlbW92ZU9iamVjdCIsInJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uIiwic2V0QnVja2V0UmVwbGljYXRpb24iLCJnZXRCdWNrZXRSZXBsaWNhdGlvbiIsImdldE9iamVjdExlZ2FsSG9sZCIsInNldE9iamVjdExlZ2FsSG9sZCIsInNldE9iamVjdExvY2tDb25maWciLCJnZXRPYmplY3RMb2NrQ29uZmlnIiwiZ2V0QnVja2V0UG9saWN5Iiwic2V0QnVja2V0UG9saWN5IiwiZ2V0QnVja2V0VGFnZ2luZyIsImdldE9iamVjdFRhZ2dpbmciLCJzZXRCdWNrZXRUYWdnaW5nIiwicmVtb3ZlQnVja2V0VGFnZ2luZyIsInNldE9iamVjdFRhZ2dpbmciLCJyZW1vdmVPYmplY3RUYWdnaW5nIiwiZ2V0QnVja2V0VmVyc2lvbmluZyIsInNldEJ1Y2tldFZlcnNpb25pbmciLCJzZWxlY3RPYmplY3RDb250ZW50Iiwic2V0QnVja2V0TGlmZWN5Y2xlIiwiZ2V0QnVja2V0TGlmZWN5Y2xlIiwicmVtb3ZlQnVja2V0TGlmZWN5Y2xlIiwic2V0QnVja2V0RW5jcnlwdGlvbiIsImdldEJ1Y2tldEVuY3J5cHRpb24iLCJyZW1vdmVCdWNrZXRFbmNyeXB0aW9uIl0sInNvdXJjZXMiOlsibWluaW8uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIE1pbklPIEphdmFzY3JpcHQgTGlicmFyeSBmb3IgQW1hem9uIFMzIENvbXBhdGlibGUgQ2xvdWQgU3RvcmFnZSwgKEMpIDIwMTUgTWluSU8sIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0ICogYXMgU3RyZWFtIGZyb20gJ25vZGU6c3RyZWFtJ1xuXG5pbXBvcnQgYXN5bmMgZnJvbSAnYXN5bmMnXG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnXG5pbXBvcnQgKiBhcyBxdWVyeXN0cmluZyBmcm9tICdxdWVyeS1zdHJpbmcnXG5pbXBvcnQgeyBUZXh0RW5jb2RlciB9IGZyb20gJ3dlYi1lbmNvZGluZydcbmltcG9ydCB4bWwyanMgZnJvbSAneG1sMmpzJ1xuXG5pbXBvcnQgKiBhcyBlcnJvcnMgZnJvbSAnLi9lcnJvcnMudHMnXG5pbXBvcnQgeyBDb3B5RGVzdGluYXRpb25PcHRpb25zLCBDb3B5U291cmNlT3B0aW9ucyB9IGZyb20gJy4vaGVscGVycy50cydcbmltcG9ydCB7IGNhbGxiYWNraWZ5IH0gZnJvbSAnLi9pbnRlcm5hbC9jYWxsYmFja2lmeS5qcydcbmltcG9ydCB7IFR5cGVkQ2xpZW50IH0gZnJvbSAnLi9pbnRlcm5hbC9jbGllbnQudHMnXG5pbXBvcnQgeyBDb3B5Q29uZGl0aW9ucyB9IGZyb20gJy4vaW50ZXJuYWwvY29weS1jb25kaXRpb25zLnRzJ1xuaW1wb3J0IHtcbiAgY2FsY3VsYXRlRXZlblNwbGl0cyxcbiAgZXh0cmFjdE1ldGFkYXRhLFxuICBnZXRTY29wZSxcbiAgZ2V0U291cmNlVmVyc2lvbklkLFxuICBnZXRWZXJzaW9uSWQsXG4gIGlzQm9vbGVhbixcbiAgaXNGdW5jdGlvbixcbiAgaXNOdW1iZXIsXG4gIGlzT2JqZWN0LFxuICBpc1N0cmluZyxcbiAgaXNWYWxpZEJ1Y2tldE5hbWUsXG4gIGlzVmFsaWREYXRlLFxuICBpc1ZhbGlkT2JqZWN0TmFtZSxcbiAgaXNWYWxpZFByZWZpeCxcbiAgbWFrZURhdGVMb25nLFxuICBQQVJUX0NPTlNUUkFJTlRTLFxuICBwYXJ0c1JlcXVpcmVkLFxuICBwaXBlc2V0dXAsXG4gIHNhbml0aXplRVRhZyxcbiAgdG9NZDUsXG4gIHVyaUVzY2FwZSxcbiAgdXJpUmVzb3VyY2VFc2NhcGUsXG59IGZyb20gJy4vaW50ZXJuYWwvaGVscGVyLnRzJ1xuaW1wb3J0IHsgUG9zdFBvbGljeSB9IGZyb20gJy4vaW50ZXJuYWwvcG9zdC1wb2xpY3kudHMnXG5pbXBvcnQgeyBOb3RpZmljYXRpb25Db25maWcsIE5vdGlmaWNhdGlvblBvbGxlciB9IGZyb20gJy4vbm90aWZpY2F0aW9uLnRzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnLi9wcm9taXNpZnkuanMnXG5pbXBvcnQgeyBwb3N0UHJlc2lnblNpZ25hdHVyZVY0LCBwcmVzaWduU2lnbmF0dXJlVjQgfSBmcm9tICcuL3NpZ25pbmcudHMnXG5pbXBvcnQgKiBhcyB0cmFuc2Zvcm1lcnMgZnJvbSAnLi90cmFuc2Zvcm1lcnMuanMnXG5cbmV4cG9ydCAqIGZyb20gJy4vZXJyb3JzLnRzJ1xuZXhwb3J0ICogZnJvbSAnLi9oZWxwZXJzLnRzJ1xuZXhwb3J0ICogZnJvbSAnLi9ub3RpZmljYXRpb24udHMnXG5leHBvcnQgeyBDb3B5Q29uZGl0aW9ucywgUG9zdFBvbGljeSB9XG5cbmV4cG9ydCBjbGFzcyBDbGllbnQgZXh0ZW5kcyBUeXBlZENsaWVudCB7XG4gIC8vIFNldCBhcHBsaWNhdGlvbiBzcGVjaWZpYyBpbmZvcm1hdGlvbi5cbiAgLy9cbiAgLy8gR2VuZXJhdGVzIFVzZXItQWdlbnQgaW4gdGhlIGZvbGxvd2luZyBzdHlsZS5cbiAgLy9cbiAgLy8gICAgICAgTWluSU8gKE9TOyBBUkNIKSBMSUIvVkVSIEFQUC9WRVJcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBhcHBOYW1lYCBfc3RyaW5nXyAtIEFwcGxpY2F0aW9uIG5hbWUuXG4gIC8vICogYGFwcFZlcnNpb25gIF9zdHJpbmdfIC0gQXBwbGljYXRpb24gdmVyc2lvbi5cbiAgc2V0QXBwSW5mbyhhcHBOYW1lLCBhcHBWZXJzaW9uKSB7XG4gICAgaWYgKCFpc1N0cmluZyhhcHBOYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW52YWxpZCBhcHBOYW1lOiAke2FwcE5hbWV9YClcbiAgICB9XG4gICAgaWYgKGFwcE5hbWUudHJpbSgpID09PSAnJykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW5wdXQgYXBwTmFtZSBjYW5ub3QgYmUgZW1wdHkuJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhhcHBWZXJzaW9uKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW52YWxpZCBhcHBWZXJzaW9uOiAke2FwcFZlcnNpb259YClcbiAgICB9XG4gICAgaWYgKGFwcFZlcnNpb24udHJpbSgpID09PSAnJykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW5wdXQgYXBwVmVyc2lvbiBjYW5ub3QgYmUgZW1wdHkuJylcbiAgICB9XG4gICAgdGhpcy51c2VyQWdlbnQgPSBgJHt0aGlzLnVzZXJBZ2VudH0gJHthcHBOYW1lfS8ke2FwcFZlcnNpb259YFxuICB9XG5cbiAgLy8gUmVtb3ZlIHRoZSBwYXJ0aWFsbHkgdXBsb2FkZWQgb2JqZWN0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBjYWxsYmFjayhlcnIpYCBfZnVuY3Rpb25fOiBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBub24gYG51bGxgIHZhbHVlIGluIGNhc2Ugb2YgZXJyb3JcbiAgcmVtb3ZlSW5jb21wbGV0ZVVwbG9hZChidWNrZXROYW1lLCBvYmplY3ROYW1lLCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSXNWYWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuICAgIHZhciByZW1vdmVVcGxvYWRJZFxuICAgIGFzeW5jLmR1cmluZyhcbiAgICAgIChjYikgPT4ge1xuICAgICAgICB0aGlzLmZpbmRVcGxvYWRJZChidWNrZXROYW1lLCBvYmplY3ROYW1lKS50aGVuKCh1cGxvYWRJZCkgPT4ge1xuICAgICAgICAgIHJlbW92ZVVwbG9hZElkID0gdXBsb2FkSWRcbiAgICAgICAgICBjYihudWxsLCB1cGxvYWRJZClcbiAgICAgICAgfSwgY2IpXG4gICAgICB9LFxuICAgICAgKGNiKSA9PiB7XG4gICAgICAgIHZhciBtZXRob2QgPSAnREVMRVRFJ1xuICAgICAgICB2YXIgcXVlcnkgPSBgdXBsb2FkSWQ9JHtyZW1vdmVVcGxvYWRJZH1gXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSwgJycsIGZhbHNlLCAoZSkgPT4gY2IoZSkpXG4gICAgICB9LFxuICAgICAgY2IsXG4gICAgKVxuICB9XG5cbiAgLy8gQ29weSB0aGUgb2JqZWN0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBzcmNPYmplY3RgIF9zdHJpbmdfOiBwYXRoIG9mIHRoZSBzb3VyY2Ugb2JqZWN0IHRvIGJlIGNvcGllZFxuICAvLyAqIGBjb25kaXRpb25zYCBfQ29weUNvbmRpdGlvbnNfOiBjb3B5IGNvbmRpdGlvbnMgdGhhdCBuZWVkcyB0byBiZSBzYXRpc2ZpZWQgKG9wdGlvbmFsLCBkZWZhdWx0IGBudWxsYClcbiAgLy8gKiBgY2FsbGJhY2soZXJyLCB7ZXRhZywgbGFzdE1vZGlmaWVkfSlgIF9mdW5jdGlvbl86IG5vbiBudWxsIGBlcnJgIGluZGljYXRlcyBlcnJvciwgYGV0YWdgIF9zdHJpbmdfIGFuZCBgbGlzdE1vZGlmZWRgIF9EYXRlXyBhcmUgcmVzcGVjdGl2ZWx5IHRoZSBldGFnIGFuZCB0aGUgbGFzdCBtb2RpZmllZCBkYXRlIG9mIHRoZSBuZXdseSBjb3BpZWQgb2JqZWN0XG4gIGNvcHlPYmplY3RWMShhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1KSB7XG4gICAgdmFyIGJ1Y2tldE5hbWUgPSBhcmcxXG4gICAgdmFyIG9iamVjdE5hbWUgPSBhcmcyXG4gICAgdmFyIHNyY09iamVjdCA9IGFyZzNcbiAgICB2YXIgY29uZGl0aW9ucywgY2JcbiAgICBpZiAodHlwZW9mIGFyZzQgPT0gJ2Z1bmN0aW9uJyAmJiBhcmc1ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbmRpdGlvbnMgPSBudWxsXG4gICAgICBjYiA9IGFyZzRcbiAgICB9IGVsc2Uge1xuICAgICAgY29uZGl0aW9ucyA9IGFyZzRcbiAgICAgIGNiID0gYXJnNVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHNyY09iamVjdCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NyY09iamVjdCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKHNyY09iamVjdCA9PT0gJycpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBFbXB0eSBzb3VyY2UgcHJlZml4YClcbiAgICB9XG5cbiAgICBpZiAoY29uZGl0aW9ucyAhPT0gbnVsbCAmJiAhKGNvbmRpdGlvbnMgaW5zdGFuY2VvZiBDb3B5Q29uZGl0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbmRpdGlvbnMgc2hvdWxkIGJlIG9mIHR5cGUgXCJDb3B5Q29uZGl0aW9uc1wiJylcbiAgICB9XG5cbiAgICB2YXIgaGVhZGVycyA9IHt9XG4gICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UnXSA9IHVyaVJlc291cmNlRXNjYXBlKHNyY09iamVjdClcblxuICAgIGlmIChjb25kaXRpb25zICE9PSBudWxsKSB7XG4gICAgICBpZiAoY29uZGl0aW9ucy5tb2RpZmllZCAhPT0gJycpIHtcbiAgICAgICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UtaWYtbW9kaWZpZWQtc2luY2UnXSA9IGNvbmRpdGlvbnMubW9kaWZpZWRcbiAgICAgIH1cbiAgICAgIGlmIChjb25kaXRpb25zLnVubW9kaWZpZWQgIT09ICcnKSB7XG4gICAgICAgIGhlYWRlcnNbJ3gtYW16LWNvcHktc291cmNlLWlmLXVubW9kaWZpZWQtc2luY2UnXSA9IGNvbmRpdGlvbnMudW5tb2RpZmllZFxuICAgICAgfVxuICAgICAgaWYgKGNvbmRpdGlvbnMubWF0Y2hFVGFnICE9PSAnJykge1xuICAgICAgICBoZWFkZXJzWyd4LWFtei1jb3B5LXNvdXJjZS1pZi1tYXRjaCddID0gY29uZGl0aW9ucy5tYXRjaEVUYWdcbiAgICAgIH1cbiAgICAgIGlmIChjb25kaXRpb25zLm1hdGNoRXRhZ0V4Y2VwdCAhPT0gJycpIHtcbiAgICAgICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UtaWYtbm9uZS1tYXRjaCddID0gY29uZGl0aW9ucy5tYXRjaEVUYWdFeGNlcHRcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbWV0aG9kID0gJ1BVVCdcbiAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzIH0sICcnLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0Q29weU9iamVjdFRyYW5zZm9ybWVyKClcbiAgICAgIHBpcGVzZXR1cChyZXNwb25zZSwgdHJhbnNmb3JtZXIpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiBjYihudWxsLCBkYXRhKSlcbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIE1ldGhvZCB0byBwZXJmb3JtIGNvcHkgb2YgYW4gb2JqZWN0LlxuICAgKiBAcGFyYW0gc291cmNlQ29uZmlnIF9fb2JqZWN0X18gICBpbnN0YW5jZSBvZiBDb3B5U291cmNlT3B0aW9ucyBAbGluayAuL2hlbHBlcnMvQ29weVNvdXJjZU9wdGlvbnNcbiAgICogQHBhcmFtIGRlc3RDb25maWcgIF9fb2JqZWN0X18gICBpbnN0YW5jZSBvZiBDb3B5RGVzdGluYXRpb25PcHRpb25zIEBsaW5rIC4vaGVscGVycy9Db3B5RGVzdGluYXRpb25PcHRpb25zXG4gICAqIEBwYXJhbSBjYiBfX2Z1bmN0aW9uX18gY2FsbGVkIHdpdGggbnVsbCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuICAgKiBAcmV0dXJucyBQcm9taXNlIGlmIG5vIGNhbGxhY2sgaXMgcGFzc2VkLlxuICAgKi9cbiAgY29weU9iamVjdFYyKHNvdXJjZUNvbmZpZywgZGVzdENvbmZpZywgY2IpIHtcbiAgICBpZiAoIShzb3VyY2VDb25maWcgaW5zdGFuY2VvZiBDb3B5U291cmNlT3B0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3NvdXJjZUNvbmZpZyBzaG91bGQgb2YgdHlwZSBDb3B5U291cmNlT3B0aW9ucyAnKVxuICAgIH1cbiAgICBpZiAoIShkZXN0Q29uZmlnIGluc3RhbmNlb2YgQ29weURlc3RpbmF0aW9uT3B0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ2Rlc3RDb25maWcgc2hvdWxkIG9mIHR5cGUgQ29weURlc3RpbmF0aW9uT3B0aW9ucyAnKVxuICAgIH1cbiAgICBpZiAoIWRlc3RDb25maWcudmFsaWRhdGUoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGlmICghZGVzdENvbmZpZy52YWxpZGF0ZSgpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkZXJzID0gT2JqZWN0LmFzc2lnbih7fSwgc291cmNlQ29uZmlnLmdldEhlYWRlcnMoKSwgZGVzdENvbmZpZy5nZXRIZWFkZXJzKCkpXG5cbiAgICBjb25zdCBidWNrZXROYW1lID0gZGVzdENvbmZpZy5CdWNrZXRcbiAgICBjb25zdCBvYmplY3ROYW1lID0gZGVzdENvbmZpZy5PYmplY3RcblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycyB9LCAnJywgWzIwMF0sICcnLCB0cnVlLCAoZSwgcmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKVxuICAgICAgfVxuICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0Q29weU9iamVjdFRyYW5zZm9ybWVyKClcbiAgICAgIHBpcGVzZXR1cChyZXNwb25zZSwgdHJhbnNmb3JtZXIpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzSGVhZGVycyA9IHJlc3BvbnNlLmhlYWRlcnNcblxuICAgICAgICAgIGNvbnN0IGNvcHlPYmpSZXNwb25zZSA9IHtcbiAgICAgICAgICAgIEJ1Y2tldDogZGVzdENvbmZpZy5CdWNrZXQsXG4gICAgICAgICAgICBLZXk6IGRlc3RDb25maWcuT2JqZWN0LFxuICAgICAgICAgICAgTGFzdE1vZGlmaWVkOiBkYXRhLkxhc3RNb2RpZmllZCxcbiAgICAgICAgICAgIE1ldGFEYXRhOiBleHRyYWN0TWV0YWRhdGEocmVzSGVhZGVycyksXG4gICAgICAgICAgICBWZXJzaW9uSWQ6IGdldFZlcnNpb25JZChyZXNIZWFkZXJzKSxcbiAgICAgICAgICAgIFNvdXJjZVZlcnNpb25JZDogZ2V0U291cmNlVmVyc2lvbklkKHJlc0hlYWRlcnMpLFxuICAgICAgICAgICAgRXRhZzogc2FuaXRpemVFVGFnKHJlc0hlYWRlcnMuZXRhZyksXG4gICAgICAgICAgICBTaXplOiArcmVzSGVhZGVyc1snY29udGVudC1sZW5ndGgnXSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gY2IobnVsbCwgY29weU9ialJlc3BvbnNlKVxuICAgICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IGZvciBDb3B5IE9iamVjdCBBUEkuXG4gIGNvcHlPYmplY3QoLi4uYWxsQXJncykge1xuICAgIGlmIChhbGxBcmdzWzBdIGluc3RhbmNlb2YgQ29weVNvdXJjZU9wdGlvbnMgJiYgYWxsQXJnc1sxXSBpbnN0YW5jZW9mIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcHlPYmplY3RWMiguLi5hcmd1bWVudHMpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNvcHlPYmplY3RWMSguLi5hcmd1bWVudHMpXG4gIH1cblxuICAvLyBsaXN0IGEgYmF0Y2ggb2Ygb2JqZWN0c1xuICBsaXN0T2JqZWN0c1F1ZXJ5KGJ1Y2tldE5hbWUsIHByZWZpeCwgbWFya2VyLCBsaXN0UXVlcnlPcHRzID0ge30pIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWZpeCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhtYXJrZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtYXJrZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGxldCB7IERlbGltaXRlciwgTWF4S2V5cywgSW5jbHVkZVZlcnNpb24gfSA9IGxpc3RRdWVyeU9wdHNcblxuICAgIGlmICghaXNPYmplY3QobGlzdFF1ZXJ5T3B0cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RRdWVyeU9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgaWYgKCFpc1N0cmluZyhEZWxpbWl0ZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdEZWxpbWl0ZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIoTWF4S2V5cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ01heEtleXMgc2hvdWxkIGJlIG9mIHR5cGUgXCJudW1iZXJcIicpXG4gICAgfVxuXG4gICAgY29uc3QgcXVlcmllcyA9IFtdXG4gICAgLy8gZXNjYXBlIGV2ZXJ5IHZhbHVlIGluIHF1ZXJ5IHN0cmluZywgZXhjZXB0IG1heEtleXNcbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoRGVsaW1pdGVyKX1gKVxuICAgIHF1ZXJpZXMucHVzaChgZW5jb2RpbmctdHlwZT11cmxgKVxuXG4gICAgaWYgKEluY2x1ZGVWZXJzaW9uKSB7XG4gICAgICBxdWVyaWVzLnB1c2goYHZlcnNpb25zYClcbiAgICB9XG5cbiAgICBpZiAobWFya2VyKSB7XG4gICAgICBtYXJrZXIgPSB1cmlFc2NhcGUobWFya2VyKVxuICAgICAgaWYgKEluY2x1ZGVWZXJzaW9uKSB7XG4gICAgICAgIHF1ZXJpZXMucHVzaChga2V5LW1hcmtlcj0ke21hcmtlcn1gKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcmllcy5wdXNoKGBtYXJrZXI9JHttYXJrZXJ9YClcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBubyBuZWVkIHRvIGVzY2FwZSBtYXhLZXlzXG4gICAgaWYgKE1heEtleXMpIHtcbiAgICAgIGlmIChNYXhLZXlzID49IDEwMDApIHtcbiAgICAgICAgTWF4S2V5cyA9IDEwMDBcbiAgICAgIH1cbiAgICAgIHF1ZXJpZXMucHVzaChgbWF4LWtleXM9JHtNYXhLZXlzfWApXG4gICAgfVxuICAgIHF1ZXJpZXMuc29ydCgpXG4gICAgdmFyIHF1ZXJ5ID0gJydcbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyeSA9IGAke3F1ZXJpZXMuam9pbignJicpfWBcbiAgICB9XG5cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0TGlzdE9iamVjdHNUcmFuc2Zvcm1lcigpXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSwgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gdHJhbnNmb3JtZXIuZW1pdCgnZXJyb3InLCBlKVxuICAgICAgfVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcilcbiAgICB9KVxuICAgIHJldHVybiB0cmFuc2Zvcm1lclxuICB9XG5cbiAgLy8gTGlzdCB0aGUgb2JqZWN0cyBpbiB0aGUgYnVja2V0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgcHJlZml4YCBfc3RyaW5nXzogdGhlIHByZWZpeCBvZiB0aGUgb2JqZWN0cyB0aGF0IHNob3VsZCBiZSBsaXN0ZWQgKG9wdGlvbmFsLCBkZWZhdWx0IGAnJ2ApXG4gIC8vICogYHJlY3Vyc2l2ZWAgX2Jvb2xfOiBgdHJ1ZWAgaW5kaWNhdGVzIHJlY3Vyc2l2ZSBzdHlsZSBsaXN0aW5nIGFuZCBgZmFsc2VgIGluZGljYXRlcyBkaXJlY3Rvcnkgc3R5bGUgbGlzdGluZyBkZWxpbWl0ZWQgYnkgJy8nLiAob3B0aW9uYWwsIGRlZmF1bHQgYGZhbHNlYClcbiAgLy8gKiBgbGlzdE9wdHMgX29iamVjdF86IHF1ZXJ5IHBhcmFtcyB0byBsaXN0IG9iamVjdCB3aXRoIGJlbG93IGtleXNcbiAgLy8gKiAgICBsaXN0T3B0cy5NYXhLZXlzIF9pbnRfIG1heGltdW0gbnVtYmVyIG9mIGtleXMgdG8gcmV0dXJuXG4gIC8vICogICAgbGlzdE9wdHMuSW5jbHVkZVZlcnNpb24gIF9ib29sXyB0cnVlfGZhbHNlIHRvIGluY2x1ZGUgdmVyc2lvbnMuXG4gIC8vIF9fUmV0dXJuIFZhbHVlX19cbiAgLy8gKiBgc3RyZWFtYCBfU3RyZWFtXzogc3RyZWFtIGVtaXR0aW5nIHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQsIHRoZSBvYmplY3QgaXMgb2YgdGhlIGZvcm1hdDpcbiAgLy8gKiBgb2JqLm5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLnByZWZpeGAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdCBwcmVmaXhcbiAgLy8gKiBgb2JqLnNpemVgIF9udW1iZXJfOiBzaXplIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLmV0YWdgIF9zdHJpbmdfOiBldGFnIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLmxhc3RNb2RpZmllZGAgX0RhdGVfOiBtb2RpZmllZCB0aW1lIHN0YW1wXG4gIC8vICogYG9iai5pc0RlbGV0ZU1hcmtlcmAgX2Jvb2xlYW5fOiB0cnVlIGlmIGl0IGlzIGEgZGVsZXRlIG1hcmtlclxuICAvLyAqIGBvYmoudmVyc2lvbklkYCBfc3RyaW5nXzogdmVyc2lvbklkIG9mIHRoZSBvYmplY3RcbiAgbGlzdE9iamVjdHMoYnVja2V0TmFtZSwgcHJlZml4LCByZWN1cnNpdmUsIGxpc3RPcHRzID0ge30pIHtcbiAgICBpZiAocHJlZml4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHByZWZpeCA9ICcnXG4gICAgfVxuICAgIGlmIChyZWN1cnNpdmUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVjdXJzaXZlID0gZmFsc2VcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkUHJlZml4KHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBJbnZhbGlkIHByZWZpeCA6ICR7cHJlZml4fWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZml4IHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzQm9vbGVhbihyZWN1cnNpdmUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWN1cnNpdmUgc2hvdWxkIGJlIG9mIHR5cGUgXCJib29sZWFuXCInKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGxpc3RPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdE9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuICAgIHZhciBtYXJrZXIgPSAnJ1xuICAgIGNvbnN0IGxpc3RRdWVyeU9wdHMgPSB7XG4gICAgICBEZWxpbWl0ZXI6IHJlY3Vyc2l2ZSA/ICcnIDogJy8nLCAvLyBpZiByZWN1cnNpdmUgaXMgZmFsc2Ugc2V0IGRlbGltaXRlciB0byAnLydcbiAgICAgIE1heEtleXM6IDEwMDAsXG4gICAgICBJbmNsdWRlVmVyc2lvbjogbGlzdE9wdHMuSW5jbHVkZVZlcnNpb24sXG4gICAgfVxuICAgIHZhciBvYmplY3RzID0gW11cbiAgICB2YXIgZW5kZWQgPSBmYWxzZVxuICAgIHZhciByZWFkU3RyZWFtID0gU3RyZWFtLlJlYWRhYmxlKHsgb2JqZWN0TW9kZTogdHJ1ZSB9KVxuICAgIHJlYWRTdHJlYW0uX3JlYWQgPSAoKSA9PiB7XG4gICAgICAvLyBwdXNoIG9uZSBvYmplY3QgcGVyIF9yZWFkKClcbiAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICByZWFkU3RyZWFtLnB1c2gob2JqZWN0cy5zaGlmdCgpKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChlbmRlZCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKG51bGwpXG4gICAgICB9XG4gICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gb2JqZWN0cyB0byBwdXNoIGRvIHF1ZXJ5IGZvciB0aGUgbmV4dCBiYXRjaCBvZiBvYmplY3RzXG4gICAgICB0aGlzLmxpc3RPYmplY3RzUXVlcnkoYnVja2V0TmFtZSwgcHJlZml4LCBtYXJrZXIsIGxpc3RRdWVyeU9wdHMpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gcmVhZFN0cmVhbS5lbWl0KCdlcnJvcicsIGUpKVxuICAgICAgICAub24oJ2RhdGEnLCAocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5pc1RydW5jYXRlZCkge1xuICAgICAgICAgICAgbWFya2VyID0gcmVzdWx0Lm5leHRNYXJrZXIgfHwgcmVzdWx0LnZlcnNpb25JZE1hcmtlclxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqZWN0cyA9IHJlc3VsdC5vYmplY3RzXG4gICAgICAgICAgcmVhZFN0cmVhbS5fcmVhZCgpXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiByZWFkU3RyZWFtXG4gIH1cblxuICAvLyBsaXN0T2JqZWN0c1YyUXVlcnkgLSAoTGlzdCBPYmplY3RzIFYyKSAtIExpc3Qgc29tZSBvciBhbGwgKHVwIHRvIDEwMDApIG9mIHRoZSBvYmplY3RzIGluIGEgYnVja2V0LlxuICAvL1xuICAvLyBZb3UgY2FuIHVzZSB0aGUgcmVxdWVzdCBwYXJhbWV0ZXJzIGFzIHNlbGVjdGlvbiBjcml0ZXJpYSB0byByZXR1cm4gYSBzdWJzZXQgb2YgdGhlIG9iamVjdHMgaW4gYSBidWNrZXQuXG4gIC8vIHJlcXVlc3QgcGFyYW1ldGVycyA6LVxuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYHByZWZpeGAgX3N0cmluZ186IExpbWl0cyB0aGUgcmVzcG9uc2UgdG8ga2V5cyB0aGF0IGJlZ2luIHdpdGggdGhlIHNwZWNpZmllZCBwcmVmaXguXG4gIC8vICogYGNvbnRpbnVhdGlvbi10b2tlbmAgX3N0cmluZ186IFVzZWQgdG8gY29udGludWUgaXRlcmF0aW5nIG92ZXIgYSBzZXQgb2Ygb2JqZWN0cy5cbiAgLy8gKiBgZGVsaW1pdGVyYCBfc3RyaW5nXzogQSBkZWxpbWl0ZXIgaXMgYSBjaGFyYWN0ZXIgeW91IHVzZSB0byBncm91cCBrZXlzLlxuICAvLyAqIGBtYXgta2V5c2AgX251bWJlcl86IFNldHMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGtleXMgcmV0dXJuZWQgaW4gdGhlIHJlc3BvbnNlIGJvZHkuXG4gIC8vICogYHN0YXJ0LWFmdGVyYCBfc3RyaW5nXzogU3BlY2lmaWVzIHRoZSBrZXkgdG8gc3RhcnQgYWZ0ZXIgd2hlbiBsaXN0aW5nIG9iamVjdHMgaW4gYSBidWNrZXQuXG4gIGxpc3RPYmplY3RzVjJRdWVyeShidWNrZXROYW1lLCBwcmVmaXgsIGNvbnRpbnVhdGlvblRva2VuLCBkZWxpbWl0ZXIsIG1heEtleXMsIHN0YXJ0QWZ0ZXIpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWZpeCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhjb250aW51YXRpb25Ub2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbnRpbnVhdGlvblRva2VuIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKGRlbGltaXRlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2RlbGltaXRlciBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc051bWJlcihtYXhLZXlzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbWF4S2V5cyBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhzdGFydEFmdGVyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhcnRBZnRlciBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgdmFyIHF1ZXJpZXMgPSBbXVxuXG4gICAgLy8gQ2FsbCBmb3IgbGlzdGluZyBvYmplY3RzIHYyIEFQSVxuICAgIHF1ZXJpZXMucHVzaChgbGlzdC10eXBlPTJgKVxuICAgIHF1ZXJpZXMucHVzaChgZW5jb2RpbmctdHlwZT11cmxgKVxuXG4gICAgLy8gZXNjYXBlIGV2ZXJ5IHZhbHVlIGluIHF1ZXJ5IHN0cmluZywgZXhjZXB0IG1heEtleXNcbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoZGVsaW1pdGVyKX1gKVxuXG4gICAgaWYgKGNvbnRpbnVhdGlvblRva2VuKSB7XG4gICAgICBjb250aW51YXRpb25Ub2tlbiA9IHVyaUVzY2FwZShjb250aW51YXRpb25Ub2tlbilcbiAgICAgIHF1ZXJpZXMucHVzaChgY29udGludWF0aW9uLXRva2VuPSR7Y29udGludWF0aW9uVG9rZW59YClcbiAgICB9XG4gICAgLy8gU2V0IHN0YXJ0LWFmdGVyXG4gICAgaWYgKHN0YXJ0QWZ0ZXIpIHtcbiAgICAgIHN0YXJ0QWZ0ZXIgPSB1cmlFc2NhcGUoc3RhcnRBZnRlcilcbiAgICAgIHF1ZXJpZXMucHVzaChgc3RhcnQtYWZ0ZXI9JHtzdGFydEFmdGVyfWApXG4gICAgfVxuICAgIC8vIG5vIG5lZWQgdG8gZXNjYXBlIG1heEtleXNcbiAgICBpZiAobWF4S2V5cykge1xuICAgICAgaWYgKG1heEtleXMgPj0gMTAwMCkge1xuICAgICAgICBtYXhLZXlzID0gMTAwMFxuICAgICAgfVxuICAgICAgcXVlcmllcy5wdXNoKGBtYXgta2V5cz0ke21heEtleXN9YClcbiAgICB9XG4gICAgcXVlcmllcy5zb3J0KClcbiAgICB2YXIgcXVlcnkgPSAnJ1xuICAgIGlmIChxdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcmllcy5qb2luKCcmJyl9YFxuICAgIH1cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0TGlzdE9iamVjdHNWMlRyYW5zZm9ybWVyKClcbiAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9LCAnJywgWzIwMF0sICcnLCB0cnVlLCAoZSwgcmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1lci5lbWl0KCdlcnJvcicsIGUpXG4gICAgICB9XG4gICAgICBwaXBlc2V0dXAocmVzcG9uc2UsIHRyYW5zZm9ybWVyKVxuICAgIH0pXG4gICAgcmV0dXJuIHRyYW5zZm9ybWVyXG4gIH1cblxuICAvLyBMaXN0IHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQgdXNpbmcgUzMgTGlzdE9iamVjdHMgVjJcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYHByZWZpeGAgX3N0cmluZ186IHRoZSBwcmVmaXggb2YgdGhlIG9iamVjdHMgdGhhdCBzaG91bGQgYmUgbGlzdGVkIChvcHRpb25hbCwgZGVmYXVsdCBgJydgKVxuICAvLyAqIGByZWN1cnNpdmVgIF9ib29sXzogYHRydWVgIGluZGljYXRlcyByZWN1cnNpdmUgc3R5bGUgbGlzdGluZyBhbmQgYGZhbHNlYCBpbmRpY2F0ZXMgZGlyZWN0b3J5IHN0eWxlIGxpc3RpbmcgZGVsaW1pdGVkIGJ5ICcvJy4gKG9wdGlvbmFsLCBkZWZhdWx0IGBmYWxzZWApXG4gIC8vICogYHN0YXJ0QWZ0ZXJgIF9zdHJpbmdfOiBTcGVjaWZpZXMgdGhlIGtleSB0byBzdGFydCBhZnRlciB3aGVuIGxpc3Rpbmcgb2JqZWN0cyBpbiBhIGJ1Y2tldC4gKG9wdGlvbmFsLCBkZWZhdWx0IGAnJ2ApXG4gIC8vXG4gIC8vIF9fUmV0dXJuIFZhbHVlX19cbiAgLy8gKiBgc3RyZWFtYCBfU3RyZWFtXzogc3RyZWFtIGVtaXR0aW5nIHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQsIHRoZSBvYmplY3QgaXMgb2YgdGhlIGZvcm1hdDpcbiAgLy8gICAqIGBvYmoubmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAgICogYG9iai5wcmVmaXhgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3QgcHJlZml4XG4gIC8vICAgKiBgb2JqLnNpemVgIF9udW1iZXJfOiBzaXplIG9mIHRoZSBvYmplY3RcbiAgLy8gICAqIGBvYmouZXRhZ2AgX3N0cmluZ186IGV0YWcgb2YgdGhlIG9iamVjdFxuICAvLyAgICogYG9iai5sYXN0TW9kaWZpZWRgIF9EYXRlXzogbW9kaWZpZWQgdGltZSBzdGFtcFxuICBsaXN0T2JqZWN0c1YyKGJ1Y2tldE5hbWUsIHByZWZpeCwgcmVjdXJzaXZlLCBzdGFydEFmdGVyKSB7XG4gICAgaWYgKHByZWZpeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwcmVmaXggPSAnJ1xuICAgIH1cbiAgICBpZiAocmVjdXJzaXZlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlY3Vyc2l2ZSA9IGZhbHNlXG4gICAgfVxuICAgIGlmIChzdGFydEFmdGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHN0YXJ0QWZ0ZXIgPSAnJ1xuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRQcmVmaXgocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkUHJlZml4RXJyb3IoYEludmFsaWQgcHJlZml4IDogJHtwcmVmaXh9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwcmVmaXgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVmaXggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHJlY3Vyc2l2ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3JlY3Vyc2l2ZSBzaG91bGQgYmUgb2YgdHlwZSBcImJvb2xlYW5cIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoc3RhcnRBZnRlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N0YXJ0QWZ0ZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIC8vIGlmIHJlY3Vyc2l2ZSBpcyBmYWxzZSBzZXQgZGVsaW1pdGVyIHRvICcvJ1xuICAgIHZhciBkZWxpbWl0ZXIgPSByZWN1cnNpdmUgPyAnJyA6ICcvJ1xuICAgIHZhciBjb250aW51YXRpb25Ub2tlbiA9ICcnXG4gICAgdmFyIG9iamVjdHMgPSBbXVxuICAgIHZhciBlbmRlZCA9IGZhbHNlXG4gICAgdmFyIHJlYWRTdHJlYW0gPSBTdHJlYW0uUmVhZGFibGUoeyBvYmplY3RNb2RlOiB0cnVlIH0pXG4gICAgcmVhZFN0cmVhbS5fcmVhZCA9ICgpID0+IHtcbiAgICAgIC8vIHB1c2ggb25lIG9iamVjdCBwZXIgX3JlYWQoKVxuICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgIHJlYWRTdHJlYW0ucHVzaChvYmplY3RzLnNoaWZ0KCkpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYgKGVuZGVkKSB7XG4gICAgICAgIHJldHVybiByZWFkU3RyZWFtLnB1c2gobnVsbClcbiAgICAgIH1cbiAgICAgIC8vIGlmIHRoZXJlIGFyZSBubyBvYmplY3RzIHRvIHB1c2ggZG8gcXVlcnkgZm9yIHRoZSBuZXh0IGJhdGNoIG9mIG9iamVjdHNcbiAgICAgIHRoaXMubGlzdE9iamVjdHNWMlF1ZXJ5KGJ1Y2tldE5hbWUsIHByZWZpeCwgY29udGludWF0aW9uVG9rZW4sIGRlbGltaXRlciwgMTAwMCwgc3RhcnRBZnRlcilcbiAgICAgICAgLm9uKCdlcnJvcicsIChlKSA9PiByZWFkU3RyZWFtLmVtaXQoJ2Vycm9yJywgZSkpXG4gICAgICAgIC5vbignZGF0YScsIChyZXN1bHQpID0+IHtcbiAgICAgICAgICBpZiAocmVzdWx0LmlzVHJ1bmNhdGVkKSB7XG4gICAgICAgICAgICBjb250aW51YXRpb25Ub2tlbiA9IHJlc3VsdC5uZXh0Q29udGludWF0aW9uVG9rZW5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIG9iamVjdHMgPSByZXN1bHQub2JqZWN0c1xuICAgICAgICAgIHJlYWRTdHJlYW0uX3JlYWQoKVxuICAgICAgICB9KVxuICAgIH1cbiAgICByZXR1cm4gcmVhZFN0cmVhbVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCB0aGUgb2JqZWN0cyByZXNpZGluZyBpbiB0aGUgb2JqZWN0c0xpc3QuXG4gIC8vXG4gIC8vIF9fQXJndW1lbnRzX19cbiAgLy8gKiBgYnVja2V0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIGJ1Y2tldFxuICAvLyAqIGBvYmplY3RzTGlzdGAgX2FycmF5XzogYXJyYXkgb2Ygb2JqZWN0cyBvZiBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgLy8gKiAgICAgICAgIExpc3Qgb2YgT2JqZWN0IG5hbWVzIGFzIGFycmF5IG9mIHN0cmluZ3Mgd2hpY2ggYXJlIG9iamVjdCBrZXlzOiAgWydvYmplY3RuYW1lMScsJ29iamVjdG5hbWUyJ11cbiAgLy8gKiAgICAgICAgIExpc3Qgb2YgT2JqZWN0IG5hbWUgYW5kIHZlcnNpb25JZCBhcyBhbiBvYmplY3Q6ICBbe25hbWU6XCJvYmplY3RuYW1lXCIsdmVyc2lvbklkOlwibXktdmVyc2lvbi1pZFwifV1cblxuICByZW1vdmVPYmplY3RzKGJ1Y2tldE5hbWUsIG9iamVjdHNMaXN0LCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmplY3RzTGlzdCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ29iamVjdHNMaXN0IHNob3VsZCBiZSBhIGxpc3QnKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cblxuICAgIGNvbnN0IG1heEVudHJpZXMgPSAxMDAwXG4gICAgY29uc3QgcXVlcnkgPSAnZGVsZXRlJ1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuXG4gICAgbGV0IHJlc3VsdCA9IG9iamVjdHNMaXN0LnJlZHVjZShcbiAgICAgIChyZXN1bHQsIGVudHJ5KSA9PiB7XG4gICAgICAgIHJlc3VsdC5saXN0LnB1c2goZW50cnkpXG4gICAgICAgIGlmIChyZXN1bHQubGlzdC5sZW5ndGggPT09IG1heEVudHJpZXMpIHtcbiAgICAgICAgICByZXN1bHQubGlzdE9mTGlzdC5wdXNoKHJlc3VsdC5saXN0KVxuICAgICAgICAgIHJlc3VsdC5saXN0ID0gW11cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9LFxuICAgICAgeyBsaXN0T2ZMaXN0OiBbXSwgbGlzdDogW10gfSxcbiAgICApXG5cbiAgICBpZiAocmVzdWx0Lmxpc3QubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0Lmxpc3RPZkxpc3QucHVzaChyZXN1bHQubGlzdClcbiAgICB9XG5cbiAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKClcbiAgICBjb25zdCBiYXRjaFJlc3VsdHMgPSBbXVxuXG4gICAgYXN5bmMuZWFjaFNlcmllcyhcbiAgICAgIHJlc3VsdC5saXN0T2ZMaXN0LFxuICAgICAgKGxpc3QsIGJhdGNoQ2IpID0+IHtcbiAgICAgICAgdmFyIG9iamVjdHMgPSBbXVxuICAgICAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICAgICAgb2JqZWN0cy5wdXNoKHsgS2V5OiB2YWx1ZS5uYW1lLCBWZXJzaW9uSWQ6IHZhbHVlLnZlcnNpb25JZCB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmplY3RzLnB1c2goeyBLZXk6IHZhbHVlIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBsZXQgZGVsZXRlT2JqZWN0cyA9IHsgRGVsZXRlOiB7IFF1aWV0OiB0cnVlLCBPYmplY3Q6IG9iamVjdHMgfSB9XG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyBoZWFkbGVzczogdHJ1ZSB9KVxuICAgICAgICBsZXQgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoZGVsZXRlT2JqZWN0cylcbiAgICAgICAgcGF5bG9hZCA9IEJ1ZmZlci5mcm9tKGVuY29kZXIuZW5jb2RlKHBheWxvYWQpKVxuICAgICAgICBjb25zdCBoZWFkZXJzID0ge31cblxuICAgICAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcblxuICAgICAgICBsZXQgcmVtb3ZlT2JqZWN0c1Jlc3VsdFxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gYmF0Y2hDYihlKVxuICAgICAgICAgIH1cbiAgICAgICAgICBwaXBlc2V0dXAocmVzcG9uc2UsIHRyYW5zZm9ybWVycy5yZW1vdmVPYmplY3RzVHJhbnNmb3JtZXIoKSlcbiAgICAgICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgIHJlbW92ZU9iamVjdHNSZXN1bHQgPSBkYXRhXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdlcnJvcicsIChlKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBiYXRjaENiKGUsIG51bGwpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgIGJhdGNoUmVzdWx0cy5wdXNoKHJlbW92ZU9iamVjdHNSZXN1bHQpXG4gICAgICAgICAgICAgIHJldHVybiBiYXRjaENiKG51bGwsIHJlbW92ZU9iamVjdHNSZXN1bHQpXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICAgICgpID0+IHtcbiAgICAgICAgY2IobnVsbCwgXy5mbGF0dGVuKGJhdGNoUmVzdWx0cykpXG4gICAgICB9LFxuICAgIClcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGEgZ2VuZXJpYyBwcmVzaWduZWQgVVJMIHdoaWNoIGNhbiBiZVxuICAvLyB1c2VkIGZvciBIVFRQIG1ldGhvZHMgR0VULCBQVVQsIEhFQUQgYW5kIERFTEVURVxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYG1ldGhvZGAgX3N0cmluZ186IG5hbWUgb2YgdGhlIEhUVFAgbWV0aG9kXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBleHBpcnlgIF9udW1iZXJfOiBleHBpcnkgaW4gc2Vjb25kcyAob3B0aW9uYWwsIGRlZmF1bHQgNyBkYXlzKVxuICAvLyAqIGByZXFQYXJhbXNgIF9vYmplY3RfOiByZXF1ZXN0IHBhcmFtZXRlcnMgKG9wdGlvbmFsKSBlLmcge3ZlcnNpb25JZDpcIjEwZmE5OTQ2LTNmNjQtNDEzNy1hNThmLTg4ODA2NWMwNzMyZVwifVxuICAvLyAqIGByZXF1ZXN0RGF0ZWAgX0RhdGVfOiBBIGRhdGUgb2JqZWN0LCB0aGUgdXJsIHdpbGwgYmUgaXNzdWVkIGF0IChvcHRpb25hbClcbiAgcHJlc2lnbmVkVXJsKG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgcmVxUGFyYW1zLCByZXF1ZXN0RGF0ZSwgY2IpIHtcbiAgICBpZiAodGhpcy5hbm9ueW1vdXMpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuQW5vbnltb3VzUmVxdWVzdEVycm9yKCdQcmVzaWduZWQgJyArIG1ldGhvZCArICcgdXJsIGNhbm5vdCBiZSBnZW5lcmF0ZWQgZm9yIGFub255bW91cyByZXF1ZXN0cycpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKHJlcXVlc3REYXRlKSkge1xuICAgICAgY2IgPSByZXF1ZXN0RGF0ZVxuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKHJlcVBhcmFtcykpIHtcbiAgICAgIGNiID0gcmVxUGFyYW1zXG4gICAgICByZXFQYXJhbXMgPSB7fVxuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKGV4cGlyZXMpKSB7XG4gICAgICBjYiA9IGV4cGlyZXNcbiAgICAgIHJlcVBhcmFtcyA9IHt9XG4gICAgICBleHBpcmVzID0gMjQgKiA2MCAqIDYwICogNyAvLyA3IGRheXMgaW4gc2Vjb25kc1xuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIoZXhwaXJlcykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4cGlyZXMgc2hvdWxkIGJlIG9mIHR5cGUgXCJudW1iZXJcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QocmVxUGFyYW1zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxUGFyYW1zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWREYXRlKHJlcXVlc3REYXRlKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxdWVzdERhdGUgc2hvdWxkIGJlIG9mIHR5cGUgXCJEYXRlXCIgYW5kIHZhbGlkJylcbiAgICB9XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG4gICAgdmFyIHF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHJlcVBhcmFtcylcbiAgICB0aGlzLmdldEJ1Y2tldFJlZ2lvbihidWNrZXROYW1lLCAoZSwgcmVnaW9uKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gY2IoZSlcbiAgICAgIH1cbiAgICAgIC8vIFRoaXMgc3RhdGVtZW50IGlzIGFkZGVkIHRvIGVuc3VyZSB0aGF0IHdlIHNlbmQgZXJyb3IgdGhyb3VnaFxuICAgICAgLy8gY2FsbGJhY2sgb24gcHJlc2lnbiBmYWlsdXJlLlxuICAgICAgdmFyIHVybFxuICAgICAgdmFyIHJlcU9wdGlvbnMgPSB0aGlzLmdldFJlcXVlc3RPcHRpb25zKHsgbWV0aG9kLCByZWdpb24sIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0pXG5cbiAgICAgIHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuICAgICAgdHJ5IHtcbiAgICAgICAgdXJsID0gcHJlc2lnblNpZ25hdHVyZVY0KFxuICAgICAgICAgIHJlcU9wdGlvbnMsXG4gICAgICAgICAgdGhpcy5hY2Nlc3NLZXksXG4gICAgICAgICAgdGhpcy5zZWNyZXRLZXksXG4gICAgICAgICAgdGhpcy5zZXNzaW9uVG9rZW4sXG4gICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgIHJlcXVlc3REYXRlLFxuICAgICAgICAgIGV4cGlyZXMsXG4gICAgICAgIClcbiAgICAgIH0gY2F0Y2ggKHBlKSB7XG4gICAgICAgIHJldHVybiBjYihwZSlcbiAgICAgIH1cbiAgICAgIGNiKG51bGwsIHVybClcbiAgICB9KVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSBwcmVzaWduZWQgVVJMIGZvciBHRVRcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYG9iamVjdE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgZXhwaXJ5YCBfbnVtYmVyXzogZXhwaXJ5IGluIHNlY29uZHMgKG9wdGlvbmFsLCBkZWZhdWx0IDcgZGF5cylcbiAgLy8gKiBgcmVzcEhlYWRlcnNgIF9vYmplY3RfOiByZXNwb25zZSBoZWFkZXJzIHRvIG92ZXJyaWRlIG9yIHJlcXVlc3QgcGFyYW1zIGZvciBxdWVyeSAob3B0aW9uYWwpIGUuZyB7dmVyc2lvbklkOlwiMTBmYTk5NDYtM2Y2NC00MTM3LWE1OGYtODg4MDY1YzA3MzJlXCJ9XG4gIC8vICogYHJlcXVlc3REYXRlYCBfRGF0ZV86IEEgZGF0ZSBvYmplY3QsIHRoZSB1cmwgd2lsbCBiZSBpc3N1ZWQgYXQgKG9wdGlvbmFsKVxuICBwcmVzaWduZWRHZXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgcmVzcEhlYWRlcnMsIHJlcXVlc3REYXRlLCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24ocmVzcEhlYWRlcnMpKSB7XG4gICAgICBjYiA9IHJlc3BIZWFkZXJzXG4gICAgICByZXNwSGVhZGVycyA9IHt9XG4gICAgICByZXF1ZXN0RGF0ZSA9IG5ldyBEYXRlKClcbiAgICB9XG5cbiAgICB2YXIgdmFsaWRSZXNwSGVhZGVycyA9IFtcbiAgICAgICdyZXNwb25zZS1jb250ZW50LXR5cGUnLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtbGFuZ3VhZ2UnLFxuICAgICAgJ3Jlc3BvbnNlLWV4cGlyZXMnLFxuICAgICAgJ3Jlc3BvbnNlLWNhY2hlLWNvbnRyb2wnLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtZGlzcG9zaXRpb24nLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtZW5jb2RpbmcnLFxuICAgIF1cbiAgICB2YWxpZFJlc3BIZWFkZXJzLmZvckVhY2goKGhlYWRlcikgPT4ge1xuICAgICAgaWYgKHJlc3BIZWFkZXJzICE9PSB1bmRlZmluZWQgJiYgcmVzcEhlYWRlcnNbaGVhZGVyXSAhPT0gdW5kZWZpbmVkICYmICFpc1N0cmluZyhyZXNwSGVhZGVyc1toZWFkZXJdKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGByZXNwb25zZSBoZWFkZXIgJHtoZWFkZXJ9IHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCJgKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIHRoaXMucHJlc2lnbmVkVXJsKCdHRVQnLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBleHBpcmVzLCByZXNwSGVhZGVycywgcmVxdWVzdERhdGUsIGNiKVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSBwcmVzaWduZWQgVVJMIGZvciBQVVQuIFVzaW5nIHRoaXMgVVJMLCB0aGUgYnJvd3NlciBjYW4gdXBsb2FkIHRvIFMzIG9ubHkgd2l0aCB0aGUgc3BlY2lmaWVkIG9iamVjdCBuYW1lLlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBleHBpcnlgIF9udW1iZXJfOiBleHBpcnkgaW4gc2Vjb25kcyAob3B0aW9uYWwsIGRlZmF1bHQgNyBkYXlzKVxuICBwcmVzaWduZWRQdXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoYEludmFsaWQgYnVja2V0IG5hbWU6ICR7YnVja2V0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wcmVzaWduZWRVcmwoJ1BVVCcsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGV4cGlyZXMsIGNiKVxuICB9XG5cbiAgLy8gcmV0dXJuIFBvc3RQb2xpY3kgb2JqZWN0XG4gIG5ld1Bvc3RQb2xpY3koKSB7XG4gICAgcmV0dXJuIG5ldyBQb3N0UG9saWN5KClcbiAgfVxuXG4gIC8vIHByZXNpZ25lZFBvc3RQb2xpY3kgY2FuIGJlIHVzZWQgaW4gc2l0dWF0aW9ucyB3aGVyZSB3ZSB3YW50IG1vcmUgY29udHJvbCBvbiB0aGUgdXBsb2FkIHRoYW4gd2hhdFxuICAvLyBwcmVzaWduZWRQdXRPYmplY3QoKSBwcm92aWRlcy4gaS5lIFVzaW5nIHByZXNpZ25lZFBvc3RQb2xpY3kgd2Ugd2lsbCBiZSBhYmxlIHRvIHB1dCBwb2xpY3kgcmVzdHJpY3Rpb25zXG4gIC8vIG9uIHRoZSBvYmplY3QncyBgbmFtZWAgYGJ1Y2tldGAgYGV4cGlyeWAgYENvbnRlbnQtVHlwZWAgYENvbnRlbnQtRGlzcG9zaXRpb25gIGBtZXRhRGF0YWBcbiAgcHJlc2lnbmVkUG9zdFBvbGljeShwb3N0UG9saWN5LCBjYikge1xuICAgIGlmICh0aGlzLmFub255bW91cykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5Bbm9ueW1vdXNSZXF1ZXN0RXJyb3IoJ1ByZXNpZ25lZCBQT1NUIHBvbGljeSBjYW5ub3QgYmUgZ2VuZXJhdGVkIGZvciBhbm9ueW1vdXMgcmVxdWVzdHMnKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KHBvc3RQb2xpY3kpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwb3N0UG9saWN5IHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYiBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cbiAgICB0aGlzLmdldEJ1Y2tldFJlZ2lvbihwb3N0UG9saWN5LmZvcm1EYXRhLmJ1Y2tldCwgKGUsIHJlZ2lvbikgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKClcbiAgICAgIHZhciBkYXRlU3RyID0gbWFrZURhdGVMb25nKGRhdGUpXG5cbiAgICAgIHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuXG4gICAgICBpZiAoIXBvc3RQb2xpY3kucG9saWN5LmV4cGlyYXRpb24pIHtcbiAgICAgICAgLy8gJ2V4cGlyYXRpb24nIGlzIG1hbmRhdG9yeSBmaWVsZCBmb3IgUzMuXG4gICAgICAgIC8vIFNldCBkZWZhdWx0IGV4cGlyYXRpb24gZGF0ZSBvZiA3IGRheXMuXG4gICAgICAgIHZhciBleHBpcmVzID0gbmV3IERhdGUoKVxuICAgICAgICBleHBpcmVzLnNldFNlY29uZHMoMjQgKiA2MCAqIDYwICogNylcbiAgICAgICAgcG9zdFBvbGljeS5zZXRFeHBpcmVzKGV4cGlyZXMpXG4gICAgICB9XG5cbiAgICAgIHBvc3RQb2xpY3kucG9saWN5LmNvbmRpdGlvbnMucHVzaChbJ2VxJywgJyR4LWFtei1kYXRlJywgZGF0ZVN0cl0pXG4gICAgICBwb3N0UG9saWN5LmZvcm1EYXRhWyd4LWFtei1kYXRlJ10gPSBkYXRlU3RyXG5cbiAgICAgIHBvc3RQb2xpY3kucG9saWN5LmNvbmRpdGlvbnMucHVzaChbJ2VxJywgJyR4LWFtei1hbGdvcml0aG0nLCAnQVdTNC1ITUFDLVNIQTI1NiddKVxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YVsneC1hbXotYWxnb3JpdGhtJ10gPSAnQVdTNC1ITUFDLVNIQTI1NidcblxuICAgICAgcG9zdFBvbGljeS5wb2xpY3kuY29uZGl0aW9ucy5wdXNoKFsnZXEnLCAnJHgtYW16LWNyZWRlbnRpYWwnLCB0aGlzLmFjY2Vzc0tleSArICcvJyArIGdldFNjb3BlKHJlZ2lvbiwgZGF0ZSldKVxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YVsneC1hbXotY3JlZGVudGlhbCddID0gdGhpcy5hY2Nlc3NLZXkgKyAnLycgKyBnZXRTY29wZShyZWdpb24sIGRhdGUpXG5cbiAgICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbikge1xuICAgICAgICBwb3N0UG9saWN5LnBvbGljeS5jb25kaXRpb25zLnB1c2goWydlcScsICckeC1hbXotc2VjdXJpdHktdG9rZW4nLCB0aGlzLnNlc3Npb25Ub2tlbl0pXG4gICAgICAgIHBvc3RQb2xpY3kuZm9ybURhdGFbJ3gtYW16LXNlY3VyaXR5LXRva2VuJ10gPSB0aGlzLnNlc3Npb25Ub2tlblxuICAgICAgfVxuXG4gICAgICB2YXIgcG9saWN5QmFzZTY0ID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkocG9zdFBvbGljeS5wb2xpY3kpKS50b1N0cmluZygnYmFzZTY0JylcblxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YS5wb2xpY3kgPSBwb2xpY3lCYXNlNjRcblxuICAgICAgdmFyIHNpZ25hdHVyZSA9IHBvc3RQcmVzaWduU2lnbmF0dXJlVjQocmVnaW9uLCBkYXRlLCB0aGlzLnNlY3JldEtleSwgcG9saWN5QmFzZTY0KVxuXG4gICAgICBwb3N0UG9saWN5LmZvcm1EYXRhWyd4LWFtei1zaWduYXR1cmUnXSA9IHNpZ25hdHVyZVxuICAgICAgdmFyIG9wdHMgPSB7fVxuICAgICAgb3B0cy5yZWdpb24gPSByZWdpb25cbiAgICAgIG9wdHMuYnVja2V0TmFtZSA9IHBvc3RQb2xpY3kuZm9ybURhdGEuYnVja2V0XG4gICAgICB2YXIgcmVxT3B0aW9ucyA9IHRoaXMuZ2V0UmVxdWVzdE9wdGlvbnMob3B0cylcbiAgICAgIHZhciBwb3J0U3RyID0gdGhpcy5wb3J0ID09IDgwIHx8IHRoaXMucG9ydCA9PT0gNDQzID8gJycgOiBgOiR7dGhpcy5wb3J0LnRvU3RyaW5nKCl9YFxuICAgICAgdmFyIHVybFN0ciA9IGAke3JlcU9wdGlvbnMucHJvdG9jb2x9Ly8ke3JlcU9wdGlvbnMuaG9zdH0ke3BvcnRTdHJ9JHtyZXFPcHRpb25zLnBhdGh9YFxuICAgICAgY2IobnVsbCwgeyBwb3N0VVJMOiB1cmxTdHIsIGZvcm1EYXRhOiBwb3N0UG9saWN5LmZvcm1EYXRhIH0pXG4gICAgfSlcbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgdGhlIG5vdGlmaWNhdGlvbiBjb25maWd1cmF0aW9ucyBpbiB0aGUgUzMgcHJvdmlkZXJcbiAgc2V0QnVja2V0Tm90aWZpY2F0aW9uKGJ1Y2tldE5hbWUsIGNvbmZpZywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGNvbmZpZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ25vdGlmaWNhdGlvbiBjb25maWcgc2hvdWxkIGJlIG9mIHR5cGUgXCJPYmplY3RcIicpXG4gICAgfVxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuICAgIHZhciBtZXRob2QgPSAnUFVUJ1xuICAgIHZhciBxdWVyeSA9ICdub3RpZmljYXRpb24nXG4gICAgdmFyIGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdOb3RpZmljYXRpb25Db25maWd1cmF0aW9uJyxcbiAgICAgIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LFxuICAgICAgaGVhZGxlc3M6IHRydWUsXG4gICAgfSlcbiAgICB2YXIgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoY29uZmlnKVxuICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQsIFsyMDBdLCAnJywgZmFsc2UsIGNiKVxuICB9XG5cbiAgcmVtb3ZlQWxsQnVja2V0Tm90aWZpY2F0aW9uKGJ1Y2tldE5hbWUsIGNiKSB7XG4gICAgdGhpcy5zZXRCdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgbmV3IE5vdGlmaWNhdGlvbkNvbmZpZygpLCBjYilcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbGlzdCBvZiBub3RpZmljYXRpb24gY29uZmlndXJhdGlvbnMgc3RvcmVkXG4gIC8vIGluIHRoZSBTMyBwcm92aWRlclxuICBnZXRCdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgcXVlcnkgPSAnbm90aWZpY2F0aW9uJ1xuICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0QnVja2V0Tm90aWZpY2F0aW9uVHJhbnNmb3JtZXIoKVxuICAgICAgdmFyIGJ1Y2tldE5vdGlmaWNhdGlvblxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcilcbiAgICAgICAgLm9uKCdkYXRhJywgKHJlc3VsdCkgPT4gKGJ1Y2tldE5vdGlmaWNhdGlvbiA9IHJlc3VsdCkpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZW5kJywgKCkgPT4gY2IobnVsbCwgYnVja2V0Tm90aWZpY2F0aW9uKSlcbiAgICB9KVxuICB9XG5cbiAgLy8gTGlzdGVucyBmb3IgYnVja2V0IG5vdGlmaWNhdGlvbnMuIFJldHVybnMgYW4gRXZlbnRFbWl0dGVyLlxuICBsaXN0ZW5CdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgcHJlZml4LCBzdWZmaXgsIGV2ZW50cykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcihgSW52YWxpZCBidWNrZXQgbmFtZTogJHtidWNrZXROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZml4IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHN1ZmZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N1ZmZpeCBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGV2ZW50cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V2ZW50cyBtdXN0IGJlIG9mIHR5cGUgQXJyYXknKVxuICAgIH1cbiAgICBsZXQgbGlzdGVuZXIgPSBuZXcgTm90aWZpY2F0aW9uUG9sbGVyKHRoaXMsIGJ1Y2tldE5hbWUsIHByZWZpeCwgc3VmZml4LCBldmVudHMpXG4gICAgbGlzdGVuZXIuc3RhcnQoKVxuXG4gICAgcmV0dXJuIGxpc3RlbmVyXG4gIH1cblxuICBnZXRPYmplY3RSZXRlbnRpb24oYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZ2V0T3B0cywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGdldE9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9IGVsc2UgaWYgKGdldE9wdHMudmVyc2lvbklkICYmICFpc1N0cmluZyhnZXRPcHRzLnZlcnNpb25JZCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ1ZlcnNpb25JRCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKGNiICYmICFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBsZXQgcXVlcnkgPSAncmV0ZW50aW9uJ1xuICAgIGlmIChnZXRPcHRzLnZlcnNpb25JZCkge1xuICAgICAgcXVlcnkgKz0gYCZ2ZXJzaW9uSWQ9JHtnZXRPcHRzLnZlcnNpb25JZH1gXG4gICAgfVxuXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfSwgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gY2IoZSlcbiAgICAgIH1cblxuICAgICAgbGV0IHJldGVudGlvbkNvbmZpZyA9IEJ1ZmZlci5mcm9tKCcnKVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcnMub2JqZWN0UmV0ZW50aW9uVHJhbnNmb3JtZXIoKSlcbiAgICAgICAgLm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICAgICAgICByZXRlbnRpb25Db25maWcgPSBkYXRhXG4gICAgICAgIH0pXG4gICAgICAgIC5vbignZXJyb3InLCBjYilcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgY2IobnVsbCwgcmV0ZW50aW9uQ29uZmlnKVxuICAgICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHVwbG9hZCBhIHBhcnQgZHVyaW5nIGNvbXBvc2Ugb2JqZWN0LlxuICAgKiBAcGFyYW0gcGFydENvbmZpZyBfX29iamVjdF9fIGNvbnRhaW5zIHRoZSBmb2xsb3dpbmcuXG4gICAqICAgIGJ1Y2tldE5hbWUgX19zdHJpbmdfX1xuICAgKiAgICBvYmplY3ROYW1lIF9fc3RyaW5nX19cbiAgICogICAgdXBsb2FkSUQgX19zdHJpbmdfX1xuICAgKiAgICBwYXJ0TnVtYmVyIF9fbnVtYmVyX19cbiAgICogICAgaGVhZGVycyBfX29iamVjdF9fXG4gICAqIEBwYXJhbSBjYiBjYWxsZWQgd2l0aCBudWxsIGluY2FzZSBvZiBlcnJvci5cbiAgICovXG4gIHVwbG9hZFBhcnRDb3B5KHBhcnRDb25maWcsIGNiKSB7XG4gICAgY29uc3QgeyBidWNrZXROYW1lLCBvYmplY3ROYW1lLCB1cGxvYWRJRCwgcGFydE51bWJlciwgaGVhZGVycyB9ID0gcGFydENvbmZpZ1xuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBsZXQgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cGxvYWRJRH0mcGFydE51bWJlcj0ke3BhcnROdW1iZXJ9YFxuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0geyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWU6IG9iamVjdE5hbWUsIHF1ZXJ5LCBoZWFkZXJzIH1cbiAgICByZXR1cm4gdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBsZXQgcGFydENvcHlSZXN1bHQgPSBCdWZmZXIuZnJvbSgnJylcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKVxuICAgICAgfVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcnMudXBsb2FkUGFydFRyYW5zZm9ybWVyKCkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgcGFydENvcHlSZXN1bHQgPSBkYXRhXG4gICAgICAgIH0pXG4gICAgICAgIC5vbignZXJyb3InLCBjYilcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgbGV0IHVwbG9hZFBhcnRDb3B5UmVzID0ge1xuICAgICAgICAgICAgZXRhZzogc2FuaXRpemVFVGFnKHBhcnRDb3B5UmVzdWx0LkVUYWcpLFxuICAgICAgICAgICAga2V5OiBvYmplY3ROYW1lLFxuICAgICAgICAgICAgcGFydDogcGFydE51bWJlcixcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYihudWxsLCB1cGxvYWRQYXJ0Q29weVJlcylcbiAgICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgY29tcG9zZU9iamVjdChkZXN0T2JqQ29uZmlnID0ge30sIHNvdXJjZU9iakxpc3QgPSBbXSwgY2IpIHtcbiAgICBjb25zdCBtZSA9IHRoaXMgLy8gbWFueSBhc3luYyBmbG93cy4gc28gc3RvcmUgdGhlIHJlZi5cbiAgICBjb25zdCBzb3VyY2VGaWxlc0xlbmd0aCA9IHNvdXJjZU9iakxpc3QubGVuZ3RoXG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoc291cmNlT2JqTGlzdCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3NvdXJjZUNvbmZpZyBzaG91bGQgYW4gYXJyYXkgb2YgQ29weVNvdXJjZU9wdGlvbnMgJylcbiAgICB9XG4gICAgaWYgKCEoZGVzdE9iakNvbmZpZyBpbnN0YW5jZW9mIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdkZXN0Q29uZmlnIHNob3VsZCBvZiB0eXBlIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMgJylcbiAgICB9XG5cbiAgICBpZiAoc291cmNlRmlsZXNMZW5ndGggPCAxIHx8IHNvdXJjZUZpbGVzTGVuZ3RoID4gUEFSVF9DT05TVFJBSU5UUy5NQVhfUEFSVFNfQ09VTlQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgIGBcIlRoZXJlIG11c3QgYmUgYXMgbGVhc3Qgb25lIGFuZCB1cCB0byAke1BBUlRfQ09OU1RSQUlOVFMuTUFYX1BBUlRTX0NPVU5UfSBzb3VyY2Ugb2JqZWN0cy5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VGaWxlc0xlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXNvdXJjZU9iakxpc3RbaV0udmFsaWRhdGUoKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWRlc3RPYmpDb25maWcudmFsaWRhdGUoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgY29uc3QgZ2V0U3RhdE9wdGlvbnMgPSAoc3JjQ29uZmlnKSA9PiB7XG4gICAgICBsZXQgc3RhdE9wdHMgPSB7fVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc3JjQ29uZmlnLlZlcnNpb25JRCkpIHtcbiAgICAgICAgc3RhdE9wdHMgPSB7XG4gICAgICAgICAgdmVyc2lvbklkOiBzcmNDb25maWcuVmVyc2lvbklELFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdE9wdHNcbiAgICB9XG4gICAgY29uc3Qgc3JjT2JqZWN0U2l6ZXMgPSBbXVxuICAgIGxldCB0b3RhbFNpemUgPSAwXG4gICAgbGV0IHRvdGFsUGFydHMgPSAwXG5cbiAgICBjb25zdCBzb3VyY2VPYmpTdGF0cyA9IHNvdXJjZU9iakxpc3QubWFwKChzcmNJdGVtKSA9PlxuICAgICAgbWUuc3RhdE9iamVjdChzcmNJdGVtLkJ1Y2tldCwgc3JjSXRlbS5PYmplY3QsIGdldFN0YXRPcHRpb25zKHNyY0l0ZW0pKSxcbiAgICApXG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoc291cmNlT2JqU3RhdHMpXG4gICAgICAudGhlbigoc3JjT2JqZWN0SW5mb3MpID0+IHtcbiAgICAgICAgY29uc3QgdmFsaWRhdGVkU3RhdHMgPSBzcmNPYmplY3RJbmZvcy5tYXAoKHJlc0l0ZW1TdGF0LCBpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHNyY0NvbmZpZyA9IHNvdXJjZU9iakxpc3RbaW5kZXhdXG5cbiAgICAgICAgICBsZXQgc3JjQ29weVNpemUgPSByZXNJdGVtU3RhdC5zaXplXG4gICAgICAgICAgLy8gQ2hlY2sgaWYgYSBzZWdtZW50IGlzIHNwZWNpZmllZCwgYW5kIGlmIHNvLCBpcyB0aGVcbiAgICAgICAgICAvLyBzZWdtZW50IHdpdGhpbiBvYmplY3QgYm91bmRzP1xuICAgICAgICAgIGlmIChzcmNDb25maWcuTWF0Y2hSYW5nZSkge1xuICAgICAgICAgICAgLy8gU2luY2UgcmFuZ2UgaXMgc3BlY2lmaWVkLFxuICAgICAgICAgICAgLy8gICAgMCA8PSBzcmMuc3JjU3RhcnQgPD0gc3JjLnNyY0VuZFxuICAgICAgICAgICAgLy8gc28gb25seSBpbnZhbGlkIGNhc2UgdG8gY2hlY2sgaXM6XG4gICAgICAgICAgICBjb25zdCBzcmNTdGFydCA9IHNyY0NvbmZpZy5TdGFydFxuICAgICAgICAgICAgY29uc3Qgc3JjRW5kID0gc3JjQ29uZmlnLkVuZFxuICAgICAgICAgICAgaWYgKHNyY0VuZCA+PSBzcmNDb3B5U2l6ZSB8fCBzcmNTdGFydCA8IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgICAgICAgICBgQ29weVNyY09wdGlvbnMgJHtpbmRleH0gaGFzIGludmFsaWQgc2VnbWVudC10by1jb3B5IFske3NyY1N0YXJ0fSwgJHtzcmNFbmR9XSAoc2l6ZSBpcyAke3NyY0NvcHlTaXplfSlgLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzcmNDb3B5U2l6ZSA9IHNyY0VuZCAtIHNyY1N0YXJ0ICsgMVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE9ubHkgdGhlIGxhc3Qgc291cmNlIG1heSBiZSBsZXNzIHRoYW4gYGFic01pblBhcnRTaXplYFxuICAgICAgICAgIGlmIChzcmNDb3B5U2l6ZSA8IFBBUlRfQ09OU1RSQUlOVFMuQUJTX01JTl9QQVJUX1NJWkUgJiYgaW5kZXggPCBzb3VyY2VGaWxlc0xlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgICAgICAgIGBDb3B5U3JjT3B0aW9ucyAke2luZGV4fSBpcyB0b28gc21hbGwgKCR7c3JjQ29weVNpemV9KSBhbmQgaXQgaXMgbm90IHRoZSBsYXN0IHBhcnQuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJcyBkYXRhIHRvIGNvcHkgdG9vIGxhcmdlP1xuICAgICAgICAgIHRvdGFsU2l6ZSArPSBzcmNDb3B5U2l6ZVxuICAgICAgICAgIGlmICh0b3RhbFNpemUgPiBQQVJUX0NPTlNUUkFJTlRTLk1BWF9NVUxUSVBBUlRfUFVUX09CSkVDVF9TSVpFKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBDYW5ub3QgY29tcG9zZSBhbiBvYmplY3Qgb2Ygc2l6ZSAke3RvdGFsU2l6ZX0gKD4gNVRpQilgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHJlY29yZCBzb3VyY2Ugc2l6ZVxuICAgICAgICAgIHNyY09iamVjdFNpemVzW2luZGV4XSA9IHNyY0NvcHlTaXplXG5cbiAgICAgICAgICAvLyBjYWxjdWxhdGUgcGFydHMgbmVlZGVkIGZvciBjdXJyZW50IHNvdXJjZVxuICAgICAgICAgIHRvdGFsUGFydHMgKz0gcGFydHNSZXF1aXJlZChzcmNDb3B5U2l6ZSlcbiAgICAgICAgICAvLyBEbyB3ZSBuZWVkIG1vcmUgcGFydHMgdGhhbiB3ZSBhcmUgYWxsb3dlZD9cbiAgICAgICAgICBpZiAodG90YWxQYXJ0cyA+IFBBUlRfQ09OU1RSQUlOVFMuTUFYX1BBUlRTX0NPVU5UKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKFxuICAgICAgICAgICAgICBgWW91ciBwcm9wb3NlZCBjb21wb3NlIG9iamVjdCByZXF1aXJlcyBtb3JlIHRoYW4gJHtQQVJUX0NPTlNUUkFJTlRTLk1BWF9QQVJUU19DT1VOVH0gcGFydHNgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXNJdGVtU3RhdFxuICAgICAgICB9KVxuXG4gICAgICAgIGlmICgodG90YWxQYXJ0cyA9PT0gMSAmJiB0b3RhbFNpemUgPD0gUEFSVF9DT05TVFJBSU5UUy5NQVhfUEFSVF9TSVpFKSB8fCB0b3RhbFNpemUgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jb3B5T2JqZWN0KHNvdXJjZU9iakxpc3RbMF0sIGRlc3RPYmpDb25maWcsIGNiKSAvLyB1c2UgY29weU9iamVjdFYyXG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcmVzZXJ2ZSBldGFnIHRvIGF2b2lkIG1vZGlmaWNhdGlvbiBvZiBvYmplY3Qgd2hpbGUgY29weWluZy5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VGaWxlc0xlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgc291cmNlT2JqTGlzdFtpXS5NYXRjaEVUYWcgPSB2YWxpZGF0ZWRTdGF0c1tpXS5ldGFnXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcGxpdFBhcnRTaXplTGlzdCA9IHZhbGlkYXRlZFN0YXRzLm1hcCgocmVzSXRlbVN0YXQsIGlkeCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNhbFNpemUgPSBjYWxjdWxhdGVFdmVuU3BsaXRzKHNyY09iamVjdFNpemVzW2lkeF0sIHNvdXJjZU9iakxpc3RbaWR4XSlcbiAgICAgICAgICByZXR1cm4gY2FsU2l6ZVxuICAgICAgICB9KVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFVwbG9hZFBhcnRDb25maWdMaXN0KHVwbG9hZElkKSB7XG4gICAgICAgICAgY29uc3QgdXBsb2FkUGFydENvbmZpZ0xpc3QgPSBbXVxuXG4gICAgICAgICAgc3BsaXRQYXJ0U2l6ZUxpc3QuZm9yRWFjaCgoc3BsaXRTaXplLCBzcGxpdEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7IHN0YXJ0SW5kZXg6IHN0YXJ0SWR4LCBlbmRJbmRleDogZW5kSWR4LCBvYmpJbmZvOiBvYmpDb25maWcgfSA9IHNwbGl0U2l6ZVxuXG4gICAgICAgICAgICBsZXQgcGFydEluZGV4ID0gc3BsaXRJbmRleCArIDEgLy8gcGFydCBpbmRleCBzdGFydHMgZnJvbSAxLlxuICAgICAgICAgICAgY29uc3QgdG90YWxVcGxvYWRzID0gQXJyYXkuZnJvbShzdGFydElkeClcblxuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IHNvdXJjZU9iakxpc3Rbc3BsaXRJbmRleF0uZ2V0SGVhZGVycygpXG5cbiAgICAgICAgICAgIHRvdGFsVXBsb2Fkcy5mb3JFYWNoKChzcGxpdFN0YXJ0LCB1cGxkQ3RySWR4KSA9PiB7XG4gICAgICAgICAgICAgIGxldCBzcGxpdEVuZCA9IGVuZElkeFt1cGxkQ3RySWR4XVxuXG4gICAgICAgICAgICAgIGNvbnN0IHNvdXJjZU9iaiA9IGAke29iakNvbmZpZy5CdWNrZXR9LyR7b2JqQ29uZmlnLk9iamVjdH1gXG4gICAgICAgICAgICAgIGhlYWRlcnNbJ3gtYW16LWNvcHktc291cmNlJ10gPSBgJHtzb3VyY2VPYmp9YFxuICAgICAgICAgICAgICBoZWFkZXJzWyd4LWFtei1jb3B5LXNvdXJjZS1yYW5nZSddID0gYGJ5dGVzPSR7c3BsaXRTdGFydH0tJHtzcGxpdEVuZH1gXG5cbiAgICAgICAgICAgICAgY29uc3QgdXBsb2FkUGFydENvbmZpZyA9IHtcbiAgICAgICAgICAgICAgICBidWNrZXROYW1lOiBkZXN0T2JqQ29uZmlnLkJ1Y2tldCxcbiAgICAgICAgICAgICAgICBvYmplY3ROYW1lOiBkZXN0T2JqQ29uZmlnLk9iamVjdCxcbiAgICAgICAgICAgICAgICB1cGxvYWRJRDogdXBsb2FkSWQsXG4gICAgICAgICAgICAgICAgcGFydE51bWJlcjogcGFydEluZGV4LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgc291cmNlT2JqOiBzb3VyY2VPYmosXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB1cGxvYWRQYXJ0Q29uZmlnTGlzdC5wdXNoKHVwbG9hZFBhcnRDb25maWcpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICByZXR1cm4gdXBsb2FkUGFydENvbmZpZ0xpc3RcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBlcmZvcm1VcGxvYWRQYXJ0cyA9ICh1cGxvYWRJZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHVwbG9hZExpc3QgPSBnZXRVcGxvYWRQYXJ0Q29uZmlnTGlzdCh1cGxvYWRJZClcblxuICAgICAgICAgIGFzeW5jLm1hcCh1cGxvYWRMaXN0LCBtZS51cGxvYWRQYXJ0Q29weS5iaW5kKG1lKSwgKGVyciwgcmVzKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHRoaXMuYWJvcnRNdWx0aXBhcnRVcGxvYWQoZGVzdE9iakNvbmZpZy5CdWNrZXQsIGRlc3RPYmpDb25maWcuT2JqZWN0LCB1cGxvYWRJZCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiBjYigpLFxuICAgICAgICAgICAgICAgIChlcnIpID0+IGNiKGVyciksXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwYXJ0c0RvbmUgPSByZXMubWFwKChwYXJ0Q29weSkgPT4gKHsgZXRhZzogcGFydENvcHkuZXRhZywgcGFydDogcGFydENvcHkucGFydCB9KSlcbiAgICAgICAgICAgIHJldHVybiBtZS5jb21wbGV0ZU11bHRpcGFydFVwbG9hZChkZXN0T2JqQ29uZmlnLkJ1Y2tldCwgZGVzdE9iakNvbmZpZy5PYmplY3QsIHVwbG9hZElkLCBwYXJ0c0RvbmUpLnRoZW4oXG4gICAgICAgICAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAgICAgICAgIChlcnIpID0+IGNiKGVyciksXG4gICAgICAgICAgICApXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5ld1VwbG9hZEhlYWRlcnMgPSBkZXN0T2JqQ29uZmlnLmdldEhlYWRlcnMoKVxuXG4gICAgICAgIG1lLmluaXRpYXRlTmV3TXVsdGlwYXJ0VXBsb2FkKGRlc3RPYmpDb25maWcuQnVja2V0LCBkZXN0T2JqQ29uZmlnLk9iamVjdCwgbmV3VXBsb2FkSGVhZGVycykudGhlbihcbiAgICAgICAgICAodXBsb2FkSWQpID0+IHtcbiAgICAgICAgICAgIHBlcmZvcm1VcGxvYWRQYXJ0cyh1cGxvYWRJZClcbiAgICAgICAgICB9LFxuICAgICAgICAgIChlcnIpID0+IHtcbiAgICAgICAgICAgIGNiKGVyciwgbnVsbClcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICB9KVxuICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICBjYihlcnJvciwgbnVsbClcbiAgICAgIH0pXG4gIH1cbn1cblxuLy8gUHJvbWlzaWZ5IHZhcmlvdXMgcHVibGljLWZhY2luZyBBUElzIG9uIHRoZSBDbGllbnQgbW9kdWxlLlxuQ2xpZW50LnByb3RvdHlwZS5jb3B5T2JqZWN0ID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUuY29weU9iamVjdClcbkNsaWVudC5wcm90b3R5cGUucmVtb3ZlT2JqZWN0cyA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnJlbW92ZU9iamVjdHMpXG5cbkNsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkVXJsID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkVXJsKVxuQ2xpZW50LnByb3RvdHlwZS5wcmVzaWduZWRHZXRPYmplY3QgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5wcmVzaWduZWRHZXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFB1dE9iamVjdCA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFB1dE9iamVjdClcbkNsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkUG9zdFBvbGljeSA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFBvc3RQb2xpY3kpXG5DbGllbnQucHJvdG90eXBlLmdldEJ1Y2tldE5vdGlmaWNhdGlvbiA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLmdldEJ1Y2tldE5vdGlmaWNhdGlvbilcbkNsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0Tm90aWZpY2F0aW9uID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0Tm90aWZpY2F0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVBbGxCdWNrZXROb3RpZmljYXRpb24gPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVBbGxCdWNrZXROb3RpZmljYXRpb24pXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUluY29tcGxldGVVcGxvYWQgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVJbmNvbXBsZXRlVXBsb2FkKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RSZXRlbnRpb24gPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RSZXRlbnRpb24pXG5DbGllbnQucHJvdG90eXBlLmNvbXBvc2VPYmplY3QgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5jb21wb3NlT2JqZWN0KVxuXG4vLyByZWZhY3RvcmVkIEFQSSB1c2UgcHJvbWlzZSBpbnRlcm5hbGx5XG5DbGllbnQucHJvdG90eXBlLm1ha2VCdWNrZXQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLm1ha2VCdWNrZXQpXG5DbGllbnQucHJvdG90eXBlLmJ1Y2tldEV4aXN0cyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuYnVja2V0RXhpc3RzKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldClcbkNsaWVudC5wcm90b3R5cGUubGlzdEJ1Y2tldHMgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLmxpc3RCdWNrZXRzKVxuXG5DbGllbnQucHJvdG90eXBlLmdldE9iamVjdCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5mR2V0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5mR2V0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5nZXRQYXJ0aWFsT2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRQYXJ0aWFsT2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5zdGF0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zdGF0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5wdXRPYmplY3RSZXRlbnRpb24gPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnB1dE9iamVjdFJldGVudGlvbilcbkNsaWVudC5wcm90b3R5cGUucHV0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5wdXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLmZQdXRPYmplY3QgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLmZQdXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZU9iamVjdCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUucmVtb3ZlT2JqZWN0KVxuXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRSZXBsaWNhdGlvbilcbkNsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0UmVwbGljYXRpb24gPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldFJlcGxpY2F0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRSZXBsaWNhdGlvbiA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0UmVwbGljYXRpb24pXG5DbGllbnQucHJvdG90eXBlLmdldE9iamVjdExlZ2FsSG9sZCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TGVnYWxIb2xkKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RMZWdhbEhvbGQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldE9iamVjdExlZ2FsSG9sZClcbkNsaWVudC5wcm90b3R5cGUuc2V0T2JqZWN0TG9ja0NvbmZpZyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuc2V0T2JqZWN0TG9ja0NvbmZpZylcbkNsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TG9ja0NvbmZpZyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TG9ja0NvbmZpZylcbkNsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0UG9saWN5ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRQb2xpY3kpXG5DbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldFBvbGljeSA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0UG9saWN5KVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRWZXJzaW9uaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRWZXJzaW9uaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRWZXJzaW9uaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRWZXJzaW9uaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZWxlY3RPYmplY3RDb250ZW50ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZWxlY3RPYmplY3RDb250ZW50KVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRMaWZlY3ljbGUgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldExpZmVjeWNsZSlcbkNsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0TGlmZWN5Y2xlID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRMaWZlY3ljbGUpXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldExpZmVjeWNsZSA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUucmVtb3ZlQnVja2V0TGlmZWN5Y2xlKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRFbmNyeXB0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRFbmNyeXB0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRFbmNyeXB0aW9uKVxuIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBZ0JBLElBQUFBLE1BQUEsR0FBQUMsdUJBQUEsQ0FBQUMsT0FBQTtBQUVBLElBQUFDLE1BQUEsR0FBQUQsT0FBQTtBQUNBLElBQUFFLE9BQUEsR0FBQUYsT0FBQTtBQUNBLElBQUFHLFdBQUEsR0FBQUosdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFJLFlBQUEsR0FBQUosT0FBQTtBQUNBLElBQUFLLE9BQUEsR0FBQUwsT0FBQTtBQUVBLElBQUFNLE1BQUEsR0FBQVAsdUJBQUEsQ0FBQUMsT0FBQTtBQW1DQU8s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