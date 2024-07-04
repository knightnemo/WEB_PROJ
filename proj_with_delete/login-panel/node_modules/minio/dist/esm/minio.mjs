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

import * as Stream from "stream";
import async from 'async';
import _ from 'lodash';
import * as querystring from 'query-string';
import { TextEncoder } from 'web-encoding';
import xml2js from 'xml2js';
import * as errors from "./errors.mjs";
import { CopyDestinationOptions, CopySourceOptions } from "./helpers.mjs";
import { callbackify } from "./internal/callbackify.mjs";
import { TypedClient } from "./internal/client.mjs";
import { CopyConditions } from "./internal/copy-conditions.mjs";
import { calculateEvenSplits, extractMetadata, getScope, getSourceVersionId, getVersionId, isBoolean, isFunction, isNumber, isObject, isString, isValidBucketName, isValidDate, isValidObjectName, isValidPrefix, makeDateLong, PART_CONSTRAINTS, partsRequired, pipesetup, sanitizeETag, toMd5, uriEscape, uriResourceEscape } from "./internal/helper.mjs";
import { PostPolicy } from "./internal/post-policy.mjs";
import { NotificationConfig, NotificationPoller } from "./notification.mjs";
import { promisify } from "./promisify.mjs";
import { postPresignSignatureV4, presignSignatureV4 } from "./signing.mjs";
import * as transformers from "./transformers.mjs";
export * from "./errors.mjs";
export * from "./helpers.mjs";
export * from "./notification.mjs";
export { CopyConditions, PostPolicy };
export class Client extends TypedClient {
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
    if (!isString(appName)) {
      throw new TypeError(`Invalid appName: ${appName}`);
    }
    if (appName.trim() === '') {
      throw new errors.InvalidArgumentError('Input appName cannot be empty.');
    }
    if (!isString(appVersion)) {
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.IsValidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isFunction(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var removeUploadId;
    async.during(cb => {
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(srcObject)) {
      throw new TypeError('srcObject should be of type "string"');
    }
    if (srcObject === '') {
      throw new errors.InvalidPrefixError(`Empty source prefix`);
    }
    if (conditions !== null && !(conditions instanceof CopyConditions)) {
      throw new TypeError('conditions should be of type "CopyConditions"');
    }
    var headers = {};
    headers['x-amz-copy-source'] = uriResourceEscape(srcObject);
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
      pipesetup(response, transformer).on('error', e => cb(e)).on('data', data => cb(null, data));
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
    if (!(sourceConfig instanceof CopySourceOptions)) {
      throw new errors.InvalidArgumentError('sourceConfig should of type CopySourceOptions ');
    }
    if (!(destConfig instanceof CopyDestinationOptions)) {
      throw new errors.InvalidArgumentError('destConfig should of type CopyDestinationOptions ');
    }
    if (!destConfig.validate()) {
      return false;
    }
    if (!destConfig.validate()) {
      return false;
    }
    if (!isFunction(cb)) {
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
      pipesetup(response, transformer).on('error', e => cb(e)).on('data', data => {
        const resHeaders = response.headers;
        const copyObjResponse = {
          Bucket: destConfig.Bucket,
          Key: destConfig.Object,
          LastModified: data.LastModified,
          MetaData: extractMetadata(resHeaders),
          VersionId: getVersionId(resHeaders),
          SourceVersionId: getSourceVersionId(resHeaders),
          Etag: sanitizeETag(resHeaders.etag),
          Size: +resHeaders['content-length']
        };
        return cb(null, copyObjResponse);
      });
    });
  }

  // Backward compatibility for Copy Object API.
  copyObject(...allArgs) {
    if (allArgs[0] instanceof CopySourceOptions && allArgs[1] instanceof CopyDestinationOptions) {
      return this.copyObjectV2(...arguments);
    }
    return this.copyObjectV1(...arguments);
  }

  // list a batch of objects
  listObjectsQuery(bucketName, prefix, marker, listQueryOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!isString(marker)) {
      throw new TypeError('marker should be of type "string"');
    }
    let {
      Delimiter,
      MaxKeys,
      IncludeVersion
    } = listQueryOpts;
    if (!isObject(listQueryOpts)) {
      throw new TypeError('listQueryOpts should be of type "object"');
    }
    if (!isString(Delimiter)) {
      throw new TypeError('Delimiter should be of type "string"');
    }
    if (!isNumber(MaxKeys)) {
      throw new TypeError('MaxKeys should be of type "number"');
    }
    const queries = [];
    // escape every value in query string, except maxKeys
    queries.push(`prefix=${uriEscape(prefix)}`);
    queries.push(`delimiter=${uriEscape(Delimiter)}`);
    queries.push(`encoding-type=url`);
    if (IncludeVersion) {
      queries.push(`versions`);
    }
    if (marker) {
      marker = uriEscape(marker);
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
      pipesetup(response, transformer);
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidPrefix(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!isBoolean(recursive)) {
      throw new TypeError('recursive should be of type "boolean"');
    }
    if (!isObject(listOpts)) {
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!isString(continuationToken)) {
      throw new TypeError('continuationToken should be of type "string"');
    }
    if (!isString(delimiter)) {
      throw new TypeError('delimiter should be of type "string"');
    }
    if (!isNumber(maxKeys)) {
      throw new TypeError('maxKeys should be of type "number"');
    }
    if (!isString(startAfter)) {
      throw new TypeError('startAfter should be of type "string"');
    }
    var queries = [];

    // Call for listing objects v2 API
    queries.push(`list-type=2`);
    queries.push(`encoding-type=url`);

    // escape every value in query string, except maxKeys
    queries.push(`prefix=${uriEscape(prefix)}`);
    queries.push(`delimiter=${uriEscape(delimiter)}`);
    if (continuationToken) {
      continuationToken = uriEscape(continuationToken);
      queries.push(`continuation-token=${continuationToken}`);
    }
    // Set start-after
    if (startAfter) {
      startAfter = uriEscape(startAfter);
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
      pipesetup(response, transformer);
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidPrefix(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!isBoolean(recursive)) {
      throw new TypeError('recursive should be of type "boolean"');
    }
    if (!isString(startAfter)) {
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!Array.isArray(objectsList)) {
      throw new errors.InvalidArgumentError('objectsList should be a list');
    }
    if (!isFunction(cb)) {
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
    const encoder = new TextEncoder();
    const batchResults = [];
    async.eachSeries(result.listOfList, (list, batchCb) => {
      var objects = [];
      list.forEach(function (value) {
        if (isObject(value)) {
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
      const builder = new xml2js.Builder({
        headless: true
      });
      let payload = builder.buildObject(deleteObjects);
      payload = Buffer.from(encoder.encode(payload));
      const headers = {};
      headers['Content-MD5'] = toMd5(payload);
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
        pipesetup(response, transformers.removeObjectsTransformer()).on('data', data => {
          removeObjectsResult = data;
        }).on('error', e => {
          return batchCb(e, null);
        }).on('end', () => {
          batchResults.push(removeObjectsResult);
          return batchCb(null, removeObjectsResult);
        });
      });
    }, () => {
      cb(null, _.flatten(batchResults));
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
    if (isFunction(requestDate)) {
      cb = requestDate;
      requestDate = new Date();
    }
    if (isFunction(reqParams)) {
      cb = reqParams;
      reqParams = {};
      requestDate = new Date();
    }
    if (isFunction(expires)) {
      cb = expires;
      reqParams = {};
      expires = 24 * 60 * 60 * 7; // 7 days in seconds
      requestDate = new Date();
    }
    if (!isNumber(expires)) {
      throw new TypeError('expires should be of type "number"');
    }
    if (!isObject(reqParams)) {
      throw new TypeError('reqParams should be of type "object"');
    }
    if (!isValidDate(requestDate)) {
      throw new TypeError('requestDate should be of type "Date" and valid');
    }
    if (!isFunction(cb)) {
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
        url = presignSignatureV4(reqOptions, this.accessKey, this.secretKey, this.sessionToken, region, requestDate, expires);
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (isFunction(respHeaders)) {
      cb = respHeaders;
      respHeaders = {};
      requestDate = new Date();
    }
    var validRespHeaders = ['response-content-type', 'response-content-language', 'response-expires', 'response-cache-control', 'response-content-disposition', 'response-content-encoding'];
    validRespHeaders.forEach(header => {
      if (respHeaders !== undefined && respHeaders[header] !== undefined && !isString(respHeaders[header])) {
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    return this.presignedUrl('PUT', bucketName, objectName, expires, cb);
  }

  // return PostPolicy object
  newPostPolicy() {
    return new PostPolicy();
  }

  // presignedPostPolicy can be used in situations where we want more control on the upload than what
  // presignedPutObject() provides. i.e Using presignedPostPolicy we will be able to put policy restrictions
  // on the object's `name` `bucket` `expiry` `Content-Type` `Content-Disposition` `metaData`
  presignedPostPolicy(postPolicy, cb) {
    if (this.anonymous) {
      throw new errors.AnonymousRequestError('Presigned POST policy cannot be generated for anonymous requests');
    }
    if (!isObject(postPolicy)) {
      throw new TypeError('postPolicy should be of type "object"');
    }
    if (!isFunction(cb)) {
      throw new TypeError('cb should be of type "function"');
    }
    this.getBucketRegion(postPolicy.formData.bucket, (e, region) => {
      if (e) {
        return cb(e);
      }
      var date = new Date();
      var dateStr = makeDateLong(date);
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
      postPolicy.policy.conditions.push(['eq', '$x-amz-credential', this.accessKey + '/' + getScope(region, date)]);
      postPolicy.formData['x-amz-credential'] = this.accessKey + '/' + getScope(region, date);
      if (this.sessionToken) {
        postPolicy.policy.conditions.push(['eq', '$x-amz-security-token', this.sessionToken]);
        postPolicy.formData['x-amz-security-token'] = this.sessionToken;
      }
      var policyBase64 = Buffer.from(JSON.stringify(postPolicy.policy)).toString('base64');
      postPolicy.formData.policy = policyBase64;
      var signature = postPresignSignatureV4(region, date, this.secretKey, policyBase64);
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
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isObject(config)) {
      throw new TypeError('notification config should be of type "Object"');
    }
    if (!isFunction(cb)) {
      throw new TypeError('callback should be of type "function"');
    }
    var method = 'PUT';
    var query = 'notification';
    var builder = new xml2js.Builder({
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
    this.setBucketNotification(bucketName, new NotificationConfig(), cb);
  }

  // Return the list of notification configurations stored
  // in the S3 provider
  getBucketNotification(bucketName, cb) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isFunction(cb)) {
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
      pipesetup(response, transformer).on('data', result => bucketNotification = result).on('error', e => cb(e)).on('end', () => cb(null, bucketNotification));
    });
  }

  // Listens for bucket notifications. Returns an EventEmitter.
  listenBucketNotification(bucketName, prefix, suffix, events) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix must be of type string');
    }
    if (!isString(suffix)) {
      throw new TypeError('suffix must be of type string');
    }
    if (!Array.isArray(events)) {
      throw new TypeError('events must be of type Array');
    }
    let listener = new NotificationPoller(this, bucketName, prefix, suffix, events);
    listener.start();
    return listener;
  }
  getObjectRetention(bucketName, objectName, getOpts, cb) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(getOpts)) {
      throw new errors.InvalidArgumentError('callback should be of type "object"');
    } else if (getOpts.versionId && !isString(getOpts.versionId)) {
      throw new errors.InvalidArgumentError('VersionID should be of type "string"');
    }
    if (cb && !isFunction(cb)) {
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
      pipesetup(response, transformers.objectRetentionTransformer()).on('data', data => {
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
      pipesetup(response, transformers.uploadPartTransformer()).on('data', data => {
        partCopyResult = data;
      }).on('error', cb).on('end', () => {
        let uploadPartCopyRes = {
          etag: sanitizeETag(partCopyResult.ETag),
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
    if (!(destObjConfig instanceof CopyDestinationOptions)) {
      throw new errors.InvalidArgumentError('destConfig should of type CopyDestinationOptions ');
    }
    if (sourceFilesLength < 1 || sourceFilesLength > PART_CONSTRAINTS.MAX_PARTS_COUNT) {
      throw new errors.InvalidArgumentError(`"There must be as least one and up to ${PART_CONSTRAINTS.MAX_PARTS_COUNT} source objects.`);
    }
    if (!isFunction(cb)) {
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
      if (!_.isEmpty(srcConfig.VersionID)) {
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
        if (srcCopySize < PART_CONSTRAINTS.ABS_MIN_PART_SIZE && index < sourceFilesLength - 1) {
          throw new errors.InvalidArgumentError(`CopySrcOptions ${index} is too small (${srcCopySize}) and it is not the last part.`);
        }

        // Is data to copy too large?
        totalSize += srcCopySize;
        if (totalSize > PART_CONSTRAINTS.MAX_MULTIPART_PUT_OBJECT_SIZE) {
          throw new errors.InvalidArgumentError(`Cannot compose an object of size ${totalSize} (> 5TiB)`);
        }

        // record source size
        srcObjectSizes[index] = srcCopySize;

        // calculate parts needed for current source
        totalParts += partsRequired(srcCopySize);
        // Do we need more parts than we are allowed?
        if (totalParts > PART_CONSTRAINTS.MAX_PARTS_COUNT) {
          throw new errors.InvalidArgumentError(`Your proposed compose object requires more than ${PART_CONSTRAINTS.MAX_PARTS_COUNT} parts`);
        }
        return resItemStat;
      });
      if (totalParts === 1 && totalSize <= PART_CONSTRAINTS.MAX_PART_SIZE || totalSize === 0) {
        return this.copyObject(sourceObjList[0], destObjConfig, cb); // use copyObjectV2
      }

      // preserve etag to avoid modification of object while copying.
      for (let i = 0; i < sourceFilesLength; i++) {
        sourceObjList[i].MatchETag = validatedStats[i].etag;
      }
      const splitPartSizeList = validatedStats.map((resItemStat, idx) => {
        const calSize = calculateEvenSplits(srcObjectSizes[idx], sourceObjList[idx]);
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
        async.map(uploadList, me.uploadPartCopy.bind(me), (err, res) => {
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
Client.prototype.copyObject = promisify(Client.prototype.copyObject);
Client.prototype.removeObjects = promisify(Client.prototype.removeObjects);
Client.prototype.presignedUrl = promisify(Client.prototype.presignedUrl);
Client.prototype.presignedGetObject = promisify(Client.prototype.presignedGetObject);
Client.prototype.presignedPutObject = promisify(Client.prototype.presignedPutObject);
Client.prototype.presignedPostPolicy = promisify(Client.prototype.presignedPostPolicy);
Client.prototype.getBucketNotification = promisify(Client.prototype.getBucketNotification);
Client.prototype.setBucketNotification = promisify(Client.prototype.setBucketNotification);
Client.prototype.removeAllBucketNotification = promisify(Client.prototype.removeAllBucketNotification);
Client.prototype.removeIncompleteUpload = promisify(Client.prototype.removeIncompleteUpload);
Client.prototype.getObjectRetention = promisify(Client.prototype.getObjectRetention);
Client.prototype.composeObject = promisify(Client.prototype.composeObject);

// refactored API use promise internally
Client.prototype.makeBucket = callbackify(Client.prototype.makeBucket);
Client.prototype.bucketExists = callbackify(Client.prototype.bucketExists);
Client.prototype.removeBucket = callbackify(Client.prototype.removeBucket);
Client.prototype.listBuckets = callbackify(Client.prototype.listBuckets);
Client.prototype.getObject = callbackify(Client.prototype.getObject);
Client.prototype.fGetObject = callbackify(Client.prototype.fGetObject);
Client.prototype.getPartialObject = callbackify(Client.prototype.getPartialObject);
Client.prototype.statObject = callbackify(Client.prototype.statObject);
Client.prototype.putObjectRetention = callbackify(Client.prototype.putObjectRetention);
Client.prototype.putObject = callbackify(Client.prototype.putObject);
Client.prototype.fPutObject = callbackify(Client.prototype.fPutObject);
Client.prototype.removeObject = callbackify(Client.prototype.removeObject);
Client.prototype.removeBucketReplication = callbackify(Client.prototype.removeBucketReplication);
Client.prototype.setBucketReplication = callbackify(Client.prototype.setBucketReplication);
Client.prototype.getBucketReplication = callbackify(Client.prototype.getBucketReplication);
Client.prototype.getObjectLegalHold = callbackify(Client.prototype.getObjectLegalHold);
Client.prototype.setObjectLegalHold = callbackify(Client.prototype.setObjectLegalHold);
Client.prototype.setObjectLockConfig = callbackify(Client.prototype.setObjectLockConfig);
Client.prototype.getObjectLockConfig = callbackify(Client.prototype.getObjectLockConfig);
Client.prototype.getBucketPolicy = callbackify(Client.prototype.getBucketPolicy);
Client.prototype.setBucketPolicy = callbackify(Client.prototype.setBucketPolicy);
Client.prototype.getBucketTagging = callbackify(Client.prototype.getBucketTagging);
Client.prototype.getObjectTagging = callbackify(Client.prototype.getObjectTagging);
Client.prototype.setBucketTagging = callbackify(Client.prototype.setBucketTagging);
Client.prototype.removeBucketTagging = callbackify(Client.prototype.removeBucketTagging);
Client.prototype.setObjectTagging = callbackify(Client.prototype.setObjectTagging);
Client.prototype.removeObjectTagging = callbackify(Client.prototype.removeObjectTagging);
Client.prototype.getBucketVersioning = callbackify(Client.prototype.getBucketVersioning);
Client.prototype.setBucketVersioning = callbackify(Client.prototype.setBucketVersioning);
Client.prototype.selectObjectContent = callbackify(Client.prototype.selectObjectContent);
Client.prototype.setBucketLifecycle = callbackify(Client.prototype.setBucketLifecycle);
Client.prototype.getBucketLifecycle = callbackify(Client.prototype.getBucketLifecycle);
Client.prototype.removeBucketLifecycle = callbackify(Client.prototype.removeBucketLifecycle);
Client.prototype.setBucketEncryption = callbackify(Client.prototype.setBucketEncryption);
Client.prototype.getBucketEncryption = callbackify(Client.prototype.getBucketEncryption);
Client.prototype.removeBucketEncryption = callbackify(Client.prototype.removeBucketEncryption);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJTdHJlYW0iLCJhc3luYyIsIl8iLCJxdWVyeXN0cmluZyIsIlRleHRFbmNvZGVyIiwieG1sMmpzIiwiZXJyb3JzIiwiQ29weURlc3RpbmF0aW9uT3B0aW9ucyIsIkNvcHlTb3VyY2VPcHRpb25zIiwiY2FsbGJhY2tpZnkiLCJUeXBlZENsaWVudCIsIkNvcHlDb25kaXRpb25zIiwiY2FsY3VsYXRlRXZlblNwbGl0cyIsImV4dHJhY3RNZXRhZGF0YSIsImdldFNjb3BlIiwiZ2V0U291cmNlVmVyc2lvbklkIiwiZ2V0VmVyc2lvbklkIiwiaXNCb29sZWFuIiwiaXNGdW5jdGlvbiIsImlzTnVtYmVyIiwiaXNPYmplY3QiLCJpc1N0cmluZyIsImlzVmFsaWRCdWNrZXROYW1lIiwiaXNWYWxpZERhdGUiLCJpc1ZhbGlkT2JqZWN0TmFtZSIsImlzVmFsaWRQcmVmaXgiLCJtYWtlRGF0ZUxvbmciLCJQQVJUX0NPTlNUUkFJTlRTIiwicGFydHNSZXF1aXJlZCIsInBpcGVzZXR1cCIsInNhbml0aXplRVRhZyIsInRvTWQ1IiwidXJpRXNjYXBlIiwidXJpUmVzb3VyY2VFc2NhcGUiLCJQb3N0UG9saWN5IiwiTm90aWZpY2F0aW9uQ29uZmlnIiwiTm90aWZpY2F0aW9uUG9sbGVyIiwicHJvbWlzaWZ5IiwicG9zdFByZXNpZ25TaWduYXR1cmVWNCIsInByZXNpZ25TaWduYXR1cmVWNCIsInRyYW5zZm9ybWVycyIsIkNsaWVudCIsInNldEFwcEluZm8iLCJhcHBOYW1lIiwiYXBwVmVyc2lvbiIsIlR5cGVFcnJvciIsInRyaW0iLCJJbnZhbGlkQXJndW1lbnRFcnJvciIsInVzZXJBZ2VudCIsInJlbW92ZUluY29tcGxldGVVcGxvYWQiLCJidWNrZXROYW1lIiwib2JqZWN0TmFtZSIsImNiIiwiSXNWYWxpZEJ1Y2tldE5hbWVFcnJvciIsIkludmFsaWRPYmplY3ROYW1lRXJyb3IiLCJyZW1vdmVVcGxvYWRJZCIsImR1cmluZyIsImZpbmRVcGxvYWRJZCIsInRoZW4iLCJ1cGxvYWRJZCIsIm1ldGhvZCIsInF1ZXJ5IiwibWFrZVJlcXVlc3QiLCJlIiwiY29weU9iamVjdFYxIiwiYXJnMSIsImFyZzIiLCJhcmczIiwiYXJnNCIsImFyZzUiLCJzcmNPYmplY3QiLCJjb25kaXRpb25zIiwidW5kZWZpbmVkIiwiSW52YWxpZEJ1Y2tldE5hbWVFcnJvciIsIkludmFsaWRQcmVmaXhFcnJvciIsImhlYWRlcnMiLCJtb2RpZmllZCIsInVubW9kaWZpZWQiLCJtYXRjaEVUYWciLCJtYXRjaEV0YWdFeGNlcHQiLCJtYXRjaEVUYWdFeGNlcHQiLCJyZXNwb25zZSIsInRyYW5zZm9ybWVyIiwiZ2V0Q29weU9iamVjdFRyYW5zZm9ybWVyIiwib24iLCJkYXRhIiwiY29weU9iamVjdFYyIiwic291cmNlQ29uZmlnIiwiZGVzdENvbmZpZyIsInZhbGlkYXRlIiwiT2JqZWN0IiwiYXNzaWduIiwiZ2V0SGVhZGVycyIsIkJ1Y2tldCIsInJlc0hlYWRlcnMiLCJjb3B5T2JqUmVzcG9uc2UiLCJLZXkiLCJMYXN0TW9kaWZpZWQiLCJNZXRhRGF0YSIsIlZlcnNpb25JZCIsIlNvdXJjZVZlcnNpb25JZCIsIkV0YWciLCJldGFnIiwiU2l6ZSIsImNvcHlPYmplY3QiLCJhbGxBcmdzIiwiYXJndW1lbnRzIiwibGlzdE9iamVjdHNRdWVyeSIsInByZWZpeCIsIm1hcmtlciIsImxpc3RRdWVyeU9wdHMiLCJEZWxpbWl0ZXIiLCJNYXhLZXlzIiwiSW5jbHVkZVZlcnNpb24iLCJxdWVyaWVzIiwicHVzaCIsInNvcnQiLCJsZW5ndGgiLCJqb2luIiwiZ2V0TGlzdE9iamVjdHNUcmFuc2Zvcm1lciIsImVtaXQiLCJsaXN0T2JqZWN0cyIsInJlY3Vyc2l2ZSIsImxpc3RPcHRzIiwib2JqZWN0cyIsImVuZGVkIiwicmVhZFN0cmVhbSIsIlJlYWRhYmxlIiwib2JqZWN0TW9kZSIsIl9yZWFkIiwic2hpZnQiLCJyZXN1bHQiLCJpc1RydW5jYXRlZCIsIm5leHRNYXJrZXIiLCJ2ZXJzaW9uSWRNYXJrZXIiLCJsaXN0T2JqZWN0c1YyUXVlcnkiLCJjb250aW51YXRpb25Ub2tlbiIsImRlbGltaXRlciIsIm1heEtleXMiLCJzdGFydEFmdGVyIiwiZ2V0TGlzdE9iamVjdHNWMlRyYW5zZm9ybWVyIiwibGlzdE9iamVjdHNWMiIsIm5leHRDb250aW51YXRpb25Ub2tlbiIsInJlbW92ZU9iamVjdHMiLCJvYmplY3RzTGlzdCIsIkFycmF5IiwiaXNBcnJheSIsIm1heEVudHJpZXMiLCJyZWR1Y2UiLCJlbnRyeSIsImxpc3QiLCJsaXN0T2ZMaXN0IiwiZW5jb2RlciIsImJhdGNoUmVzdWx0cyIsImVhY2hTZXJpZXMiLCJiYXRjaENiIiwiZm9yRWFjaCIsInZhbHVlIiwibmFtZSIsInZlcnNpb25JZCIsImRlbGV0ZU9iamVjdHMiLCJEZWxldGUiLCJRdWlldCIsImJ1aWxkZXIiLCJCdWlsZGVyIiwiaGVhZGxlc3MiLCJwYXlsb2FkIiwiYnVpbGRPYmplY3QiLCJCdWZmZXIiLCJmcm9tIiwiZW5jb2RlIiwicmVtb3ZlT2JqZWN0c1Jlc3VsdCIsInJlbW92ZU9iamVjdHNUcmFuc2Zvcm1lciIsImZsYXR0ZW4iLCJwcmVzaWduZWRVcmwiLCJleHBpcmVzIiwicmVxUGFyYW1zIiwicmVxdWVzdERhdGUiLCJhbm9ueW1vdXMiLCJBbm9ueW1vdXNSZXF1ZXN0RXJyb3IiLCJEYXRlIiwic3RyaW5naWZ5IiwiZ2V0QnVja2V0UmVnaW9uIiwicmVnaW9uIiwidXJsIiwicmVxT3B0aW9ucyIsImdldFJlcXVlc3RPcHRpb25zIiwiY2hlY2tBbmRSZWZyZXNoQ3JlZHMiLCJhY2Nlc3NLZXkiLCJzZWNyZXRLZXkiLCJzZXNzaW9uVG9rZW4iLCJwZSIsInByZXNpZ25lZEdldE9iamVjdCIsInJlc3BIZWFkZXJzIiwidmFsaWRSZXNwSGVhZGVycyIsImhlYWRlciIsInByZXNpZ25lZFB1dE9iamVjdCIsIm5ld1Bvc3RQb2xpY3kiLCJwcmVzaWduZWRQb3N0UG9saWN5IiwicG9zdFBvbGljeSIsImZvcm1EYXRhIiwiYnVja2V0IiwiZGF0ZSIsImRhdGVTdHIiLCJwb2xpY3kiLCJleHBpcmF0aW9uIiwic2V0U2Vjb25kcyIsInNldEV4cGlyZXMiLCJwb2xpY3lCYXNlNjQiLCJKU09OIiwidG9TdHJpbmciLCJzaWduYXR1cmUiLCJvcHRzIiwicG9ydFN0ciIsInBvcnQiLCJ1cmxTdHIiLCJwcm90b2NvbCIsImhvc3QiLCJwYXRoIiwicG9zdFVSTCIsInNldEJ1Y2tldE5vdGlmaWNhdGlvbiIsImNvbmZpZyIsInJvb3ROYW1lIiwicmVuZGVyT3B0cyIsInByZXR0eSIsInJlbW92ZUFsbEJ1Y2tldE5vdGlmaWNhdGlvbiIsImdldEJ1Y2tldE5vdGlmaWNhdGlvbiIsImdldEJ1Y2tldE5vdGlmaWNhdGlvblRyYW5zZm9ybWVyIiwiYnVja2V0Tm90aWZpY2F0aW9uIiwibGlzdGVuQnVja2V0Tm90aWZpY2F0aW9uIiwic3VmZml4IiwiZXZlbnRzIiwibGlzdGVuZXIiLCJzdGFydCIsImdldE9iamVjdFJldGVudGlvbiIsImdldE9wdHMiLCJyZXRlbnRpb25Db25maWciLCJvYmplY3RSZXRlbnRpb25UcmFuc2Zvcm1lciIsInVwbG9hZFBhcnRDb3B5IiwicGFydENvbmZpZyIsInVwbG9hZElEIiwicGFydE51bWJlciIsInJlcXVlc3RPcHRpb25zIiwicGFydENvcHlSZXN1bHQiLCJ1cGxvYWRQYXJ0VHJhbnNmb3JtZXIiLCJ1cGxvYWRQYXJ0Q29weVJlcyIsIkVUYWciLCJrZXkiLCJwYXJ0IiwiY29tcG9zZU9iamVjdCIsImRlc3RPYmpDb25maWciLCJzb3VyY2VPYmpMaXN0IiwibWUiLCJzb3VyY2VGaWxlc0xlbmd0aCIsIk1BWF9QQVJUU19DT1VOVCIsImkiLCJnZXRTdGF0T3B0aW9ucyIsInNyY0NvbmZpZyIsInN0YXRPcHRzIiwiaXNFbXB0eSIsIlZlcnNpb25JRCIsInNyY09iamVjdFNpemVzIiwidG90YWxTaXplIiwidG90YWxQYXJ0cyIsInNvdXJjZU9ialN0YXRzIiwibWFwIiwic3JjSXRlbSIsInN0YXRPYmplY3QiLCJQcm9taXNlIiwiYWxsIiwic3JjT2JqZWN0SW5mb3MiLCJ2YWxpZGF0ZWRTdGF0cyIsInJlc0l0ZW1TdGF0IiwiaW5kZXgiLCJzcmNDb3B5U2l6ZSIsInNpemUiLCJNYXRjaFJhbmdlIiwic3JjU3RhcnQiLCJTdGFydCIsInNyY0VuZCIsIkVuZCIsIkFCU19NSU5fUEFSVF9TSVpFIiwiTUFYX01VTFRJUEFSVF9QVVRfT0JKRUNUX1NJWkUiLCJNQVhfUEFSVF9TSVpFIiwiTWF0Y2hFVGFnIiwic3BsaXRQYXJ0U2l6ZUxpc3QiLCJpZHgiLCJjYWxTaXplIiwiZ2V0VXBsb2FkUGFydENvbmZpZ0xpc3QiLCJ1cGxvYWRQYXJ0Q29uZmlnTGlzdCIsInNwbGl0U2l6ZSIsInNwbGl0SW5kZXgiLCJzdGFydEluZGV4Iiwic3RhcnRJZHgiLCJlbmRJbmRleCIsImVuZElkeCIsIm9iakluZm8iLCJvYmpDb25maWciLCJwYXJ0SW5kZXgiLCJ0b3RhbFVwbG9hZHMiLCJzcGxpdFN0YXJ0IiwidXBsZEN0cklkeCIsInNwbGl0RW5kIiwic291cmNlT2JqIiwidXBsb2FkUGFydENvbmZpZyIsInBlcmZvcm1VcGxvYWRQYXJ0cyIsInVwbG9hZExpc3QiLCJiaW5kIiwiZXJyIiwicmVzIiwiYWJvcnRNdWx0aXBhcnRVcGxvYWQiLCJwYXJ0c0RvbmUiLCJwYXJ0Q29weSIsImNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkIiwibmV3VXBsb2FkSGVhZGVycyIsImluaXRpYXRlTmV3TXVsdGlwYXJ0VXBsb2FkIiwiY2F0Y2giLCJlcnJvciIsInByb3RvdHlwZSIsIm1ha2VCdWNrZXQiLCJidWNrZXRFeGlzdHMiLCJyZW1vdmVCdWNrZXQiLCJsaXN0QnVja2V0cyIsImdldE9iamVjdCIsImZHZXRPYmplY3QiLCJnZXRQYXJ0aWFsT2JqZWN0IiwicHV0T2JqZWN0UmV0ZW50aW9uIiwicHV0T2JqZWN0IiwiZlB1dE9iamVjdCIsInJlbW92ZU9iamVjdCIsInJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uIiwic2V0QnVja2V0UmVwbGljYXRpb24iLCJnZXRCdWNrZXRSZXBsaWNhdGlvbiIsImdldE9iamVjdExlZ2FsSG9sZCIsInNldE9iamVjdExlZ2FsSG9sZCIsInNldE9iamVjdExvY2tDb25maWciLCJnZXRPYmplY3RMb2NrQ29uZmlnIiwiZ2V0QnVja2V0UG9saWN5Iiwic2V0QnVja2V0UG9saWN5IiwiZ2V0QnVja2V0VGFnZ2luZyIsImdldE9iamVjdFRhZ2dpbmciLCJzZXRCdWNrZXRUYWdnaW5nIiwicmVtb3ZlQnVja2V0VGFnZ2luZyIsInNldE9iamVjdFRhZ2dpbmciLCJyZW1vdmVPYmplY3RUYWdnaW5nIiwiZ2V0QnVja2V0VmVyc2lvbmluZyIsInNldEJ1Y2tldFZlcnNpb25pbmciLCJzZWxlY3RPYmplY3RDb250ZW50Iiwic2V0QnVja2V0TGlmZWN5Y2xlIiwiZ2V0QnVja2V0TGlmZWN5Y2xlIiwicmVtb3ZlQnVja2V0TGlmZWN5Y2xlIiwic2V0QnVja2V0RW5jcnlwdGlvbiIsImdldEJ1Y2tldEVuY3J5cHRpb24iLCJyZW1vdmVCdWNrZXRFbmNyeXB0aW9uIl0sInNvdXJjZXMiOlsibWluaW8uanMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIE1pbklPIEphdmFzY3JpcHQgTGlicmFyeSBmb3IgQW1hem9uIFMzIENvbXBhdGlibGUgQ2xvdWQgU3RvcmFnZSwgKEMpIDIwMTUgTWluSU8sIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0ICogYXMgU3RyZWFtIGZyb20gJ25vZGU6c3RyZWFtJ1xuXG5pbXBvcnQgYXN5bmMgZnJvbSAnYXN5bmMnXG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnXG5pbXBvcnQgKiBhcyBxdWVyeXN0cmluZyBmcm9tICdxdWVyeS1zdHJpbmcnXG5pbXBvcnQgeyBUZXh0RW5jb2RlciB9IGZyb20gJ3dlYi1lbmNvZGluZydcbmltcG9ydCB4bWwyanMgZnJvbSAneG1sMmpzJ1xuXG5pbXBvcnQgKiBhcyBlcnJvcnMgZnJvbSAnLi9lcnJvcnMudHMnXG5pbXBvcnQgeyBDb3B5RGVzdGluYXRpb25PcHRpb25zLCBDb3B5U291cmNlT3B0aW9ucyB9IGZyb20gJy4vaGVscGVycy50cydcbmltcG9ydCB7IGNhbGxiYWNraWZ5IH0gZnJvbSAnLi9pbnRlcm5hbC9jYWxsYmFja2lmeS5qcydcbmltcG9ydCB7IFR5cGVkQ2xpZW50IH0gZnJvbSAnLi9pbnRlcm5hbC9jbGllbnQudHMnXG5pbXBvcnQgeyBDb3B5Q29uZGl0aW9ucyB9IGZyb20gJy4vaW50ZXJuYWwvY29weS1jb25kaXRpb25zLnRzJ1xuaW1wb3J0IHtcbiAgY2FsY3VsYXRlRXZlblNwbGl0cyxcbiAgZXh0cmFjdE1ldGFkYXRhLFxuICBnZXRTY29wZSxcbiAgZ2V0U291cmNlVmVyc2lvbklkLFxuICBnZXRWZXJzaW9uSWQsXG4gIGlzQm9vbGVhbixcbiAgaXNGdW5jdGlvbixcbiAgaXNOdW1iZXIsXG4gIGlzT2JqZWN0LFxuICBpc1N0cmluZyxcbiAgaXNWYWxpZEJ1Y2tldE5hbWUsXG4gIGlzVmFsaWREYXRlLFxuICBpc1ZhbGlkT2JqZWN0TmFtZSxcbiAgaXNWYWxpZFByZWZpeCxcbiAgbWFrZURhdGVMb25nLFxuICBQQVJUX0NPTlNUUkFJTlRTLFxuICBwYXJ0c1JlcXVpcmVkLFxuICBwaXBlc2V0dXAsXG4gIHNhbml0aXplRVRhZyxcbiAgdG9NZDUsXG4gIHVyaUVzY2FwZSxcbiAgdXJpUmVzb3VyY2VFc2NhcGUsXG59IGZyb20gJy4vaW50ZXJuYWwvaGVscGVyLnRzJ1xuaW1wb3J0IHsgUG9zdFBvbGljeSB9IGZyb20gJy4vaW50ZXJuYWwvcG9zdC1wb2xpY3kudHMnXG5pbXBvcnQgeyBOb3RpZmljYXRpb25Db25maWcsIE5vdGlmaWNhdGlvblBvbGxlciB9IGZyb20gJy4vbm90aWZpY2F0aW9uLnRzJ1xuaW1wb3J0IHsgcHJvbWlzaWZ5IH0gZnJvbSAnLi9wcm9taXNpZnkuanMnXG5pbXBvcnQgeyBwb3N0UHJlc2lnblNpZ25hdHVyZVY0LCBwcmVzaWduU2lnbmF0dXJlVjQgfSBmcm9tICcuL3NpZ25pbmcudHMnXG5pbXBvcnQgKiBhcyB0cmFuc2Zvcm1lcnMgZnJvbSAnLi90cmFuc2Zvcm1lcnMuanMnXG5cbmV4cG9ydCAqIGZyb20gJy4vZXJyb3JzLnRzJ1xuZXhwb3J0ICogZnJvbSAnLi9oZWxwZXJzLnRzJ1xuZXhwb3J0ICogZnJvbSAnLi9ub3RpZmljYXRpb24udHMnXG5leHBvcnQgeyBDb3B5Q29uZGl0aW9ucywgUG9zdFBvbGljeSB9XG5cbmV4cG9ydCBjbGFzcyBDbGllbnQgZXh0ZW5kcyBUeXBlZENsaWVudCB7XG4gIC8vIFNldCBhcHBsaWNhdGlvbiBzcGVjaWZpYyBpbmZvcm1hdGlvbi5cbiAgLy9cbiAgLy8gR2VuZXJhdGVzIFVzZXItQWdlbnQgaW4gdGhlIGZvbGxvd2luZyBzdHlsZS5cbiAgLy9cbiAgLy8gICAgICAgTWluSU8gKE9TOyBBUkNIKSBMSUIvVkVSIEFQUC9WRVJcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBhcHBOYW1lYCBfc3RyaW5nXyAtIEFwcGxpY2F0aW9uIG5hbWUuXG4gIC8vICogYGFwcFZlcnNpb25gIF9zdHJpbmdfIC0gQXBwbGljYXRpb24gdmVyc2lvbi5cbiAgc2V0QXBwSW5mbyhhcHBOYW1lLCBhcHBWZXJzaW9uKSB7XG4gICAgaWYgKCFpc1N0cmluZyhhcHBOYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW52YWxpZCBhcHBOYW1lOiAke2FwcE5hbWV9YClcbiAgICB9XG4gICAgaWYgKGFwcE5hbWUudHJpbSgpID09PSAnJykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW5wdXQgYXBwTmFtZSBjYW5ub3QgYmUgZW1wdHkuJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhhcHBWZXJzaW9uKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgSW52YWxpZCBhcHBWZXJzaW9uOiAke2FwcFZlcnNpb259YClcbiAgICB9XG4gICAgaWYgKGFwcFZlcnNpb24udHJpbSgpID09PSAnJykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW5wdXQgYXBwVmVyc2lvbiBjYW5ub3QgYmUgZW1wdHkuJylcbiAgICB9XG4gICAgdGhpcy51c2VyQWdlbnQgPSBgJHt0aGlzLnVzZXJBZ2VudH0gJHthcHBOYW1lfS8ke2FwcFZlcnNpb259YFxuICB9XG5cbiAgLy8gUmVtb3ZlIHRoZSBwYXJ0aWFsbHkgdXBsb2FkZWQgb2JqZWN0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBjYWxsYmFjayhlcnIpYCBfZnVuY3Rpb25fOiBjYWxsYmFjayBmdW5jdGlvbiBpcyBjYWxsZWQgd2l0aCBub24gYG51bGxgIHZhbHVlIGluIGNhc2Ugb2YgZXJyb3JcbiAgcmVtb3ZlSW5jb21wbGV0ZVVwbG9hZChidWNrZXROYW1lLCBvYmplY3ROYW1lLCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSXNWYWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuICAgIHZhciByZW1vdmVVcGxvYWRJZFxuICAgIGFzeW5jLmR1cmluZyhcbiAgICAgIChjYikgPT4ge1xuICAgICAgICB0aGlzLmZpbmRVcGxvYWRJZChidWNrZXROYW1lLCBvYmplY3ROYW1lKS50aGVuKCh1cGxvYWRJZCkgPT4ge1xuICAgICAgICAgIHJlbW92ZVVwbG9hZElkID0gdXBsb2FkSWRcbiAgICAgICAgICBjYihudWxsLCB1cGxvYWRJZClcbiAgICAgICAgfSwgY2IpXG4gICAgICB9LFxuICAgICAgKGNiKSA9PiB7XG4gICAgICAgIHZhciBtZXRob2QgPSAnREVMRVRFJ1xuICAgICAgICB2YXIgcXVlcnkgPSBgdXBsb2FkSWQ9JHtyZW1vdmVVcGxvYWRJZH1gXG4gICAgICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSwgJycsIGZhbHNlLCAoZSkgPT4gY2IoZSkpXG4gICAgICB9LFxuICAgICAgY2IsXG4gICAgKVxuICB9XG5cbiAgLy8gQ29weSB0aGUgb2JqZWN0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBzcmNPYmplY3RgIF9zdHJpbmdfOiBwYXRoIG9mIHRoZSBzb3VyY2Ugb2JqZWN0IHRvIGJlIGNvcGllZFxuICAvLyAqIGBjb25kaXRpb25zYCBfQ29weUNvbmRpdGlvbnNfOiBjb3B5IGNvbmRpdGlvbnMgdGhhdCBuZWVkcyB0byBiZSBzYXRpc2ZpZWQgKG9wdGlvbmFsLCBkZWZhdWx0IGBudWxsYClcbiAgLy8gKiBgY2FsbGJhY2soZXJyLCB7ZXRhZywgbGFzdE1vZGlmaWVkfSlgIF9mdW5jdGlvbl86IG5vbiBudWxsIGBlcnJgIGluZGljYXRlcyBlcnJvciwgYGV0YWdgIF9zdHJpbmdfIGFuZCBgbGlzdE1vZGlmZWRgIF9EYXRlXyBhcmUgcmVzcGVjdGl2ZWx5IHRoZSBldGFnIGFuZCB0aGUgbGFzdCBtb2RpZmllZCBkYXRlIG9mIHRoZSBuZXdseSBjb3BpZWQgb2JqZWN0XG4gIGNvcHlPYmplY3RWMShhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1KSB7XG4gICAgdmFyIGJ1Y2tldE5hbWUgPSBhcmcxXG4gICAgdmFyIG9iamVjdE5hbWUgPSBhcmcyXG4gICAgdmFyIHNyY09iamVjdCA9IGFyZzNcbiAgICB2YXIgY29uZGl0aW9ucywgY2JcbiAgICBpZiAodHlwZW9mIGFyZzQgPT0gJ2Z1bmN0aW9uJyAmJiBhcmc1ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGNvbmRpdGlvbnMgPSBudWxsXG4gICAgICBjYiA9IGFyZzRcbiAgICB9IGVsc2Uge1xuICAgICAgY29uZGl0aW9ucyA9IGFyZzRcbiAgICAgIGNiID0gYXJnNVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHNyY09iamVjdCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3NyY09iamVjdCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKHNyY09iamVjdCA9PT0gJycpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBFbXB0eSBzb3VyY2UgcHJlZml4YClcbiAgICB9XG5cbiAgICBpZiAoY29uZGl0aW9ucyAhPT0gbnVsbCAmJiAhKGNvbmRpdGlvbnMgaW5zdGFuY2VvZiBDb3B5Q29uZGl0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbmRpdGlvbnMgc2hvdWxkIGJlIG9mIHR5cGUgXCJDb3B5Q29uZGl0aW9uc1wiJylcbiAgICB9XG5cbiAgICB2YXIgaGVhZGVycyA9IHt9XG4gICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UnXSA9IHVyaVJlc291cmNlRXNjYXBlKHNyY09iamVjdClcblxuICAgIGlmIChjb25kaXRpb25zICE9PSBudWxsKSB7XG4gICAgICBpZiAoY29uZGl0aW9ucy5tb2RpZmllZCAhPT0gJycpIHtcbiAgICAgICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UtaWYtbW9kaWZpZWQtc2luY2UnXSA9IGNvbmRpdGlvbnMubW9kaWZpZWRcbiAgICAgIH1cbiAgICAgIGlmIChjb25kaXRpb25zLnVubW9kaWZpZWQgIT09ICcnKSB7XG4gICAgICAgIGhlYWRlcnNbJ3gtYW16LWNvcHktc291cmNlLWlmLXVubW9kaWZpZWQtc2luY2UnXSA9IGNvbmRpdGlvbnMudW5tb2RpZmllZFxuICAgICAgfVxuICAgICAgaWYgKGNvbmRpdGlvbnMubWF0Y2hFVGFnICE9PSAnJykge1xuICAgICAgICBoZWFkZXJzWyd4LWFtei1jb3B5LXNvdXJjZS1pZi1tYXRjaCddID0gY29uZGl0aW9ucy5tYXRjaEVUYWdcbiAgICAgIH1cbiAgICAgIGlmIChjb25kaXRpb25zLm1hdGNoRXRhZ0V4Y2VwdCAhPT0gJycpIHtcbiAgICAgICAgaGVhZGVyc1sneC1hbXotY29weS1zb3VyY2UtaWYtbm9uZS1tYXRjaCddID0gY29uZGl0aW9ucy5tYXRjaEVUYWdFeGNlcHRcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbWV0aG9kID0gJ1BVVCdcbiAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzIH0sICcnLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0Q29weU9iamVjdFRyYW5zZm9ybWVyKClcbiAgICAgIHBpcGVzZXR1cChyZXNwb25zZSwgdHJhbnNmb3JtZXIpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiBjYihudWxsLCBkYXRhKSlcbiAgICB9KVxuICB9XG5cbiAgLyoqXG4gICAqIEludGVybmFsIE1ldGhvZCB0byBwZXJmb3JtIGNvcHkgb2YgYW4gb2JqZWN0LlxuICAgKiBAcGFyYW0gc291cmNlQ29uZmlnIF9fb2JqZWN0X18gICBpbnN0YW5jZSBvZiBDb3B5U291cmNlT3B0aW9ucyBAbGluayAuL2hlbHBlcnMvQ29weVNvdXJjZU9wdGlvbnNcbiAgICogQHBhcmFtIGRlc3RDb25maWcgIF9fb2JqZWN0X18gICBpbnN0YW5jZSBvZiBDb3B5RGVzdGluYXRpb25PcHRpb25zIEBsaW5rIC4vaGVscGVycy9Db3B5RGVzdGluYXRpb25PcHRpb25zXG4gICAqIEBwYXJhbSBjYiBfX2Z1bmN0aW9uX18gY2FsbGVkIHdpdGggbnVsbCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuICAgKiBAcmV0dXJucyBQcm9taXNlIGlmIG5vIGNhbGxhY2sgaXMgcGFzc2VkLlxuICAgKi9cbiAgY29weU9iamVjdFYyKHNvdXJjZUNvbmZpZywgZGVzdENvbmZpZywgY2IpIHtcbiAgICBpZiAoIShzb3VyY2VDb25maWcgaW5zdGFuY2VvZiBDb3B5U291cmNlT3B0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3NvdXJjZUNvbmZpZyBzaG91bGQgb2YgdHlwZSBDb3B5U291cmNlT3B0aW9ucyAnKVxuICAgIH1cbiAgICBpZiAoIShkZXN0Q29uZmlnIGluc3RhbmNlb2YgQ29weURlc3RpbmF0aW9uT3B0aW9ucykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ2Rlc3RDb25maWcgc2hvdWxkIG9mIHR5cGUgQ29weURlc3RpbmF0aW9uT3B0aW9ucyAnKVxuICAgIH1cbiAgICBpZiAoIWRlc3RDb25maWcudmFsaWRhdGUoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICAgIGlmICghZGVzdENvbmZpZy52YWxpZGF0ZSgpKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkZXJzID0gT2JqZWN0LmFzc2lnbih7fSwgc291cmNlQ29uZmlnLmdldEhlYWRlcnMoKSwgZGVzdENvbmZpZy5nZXRIZWFkZXJzKCkpXG5cbiAgICBjb25zdCBidWNrZXROYW1lID0gZGVzdENvbmZpZy5CdWNrZXRcbiAgICBjb25zdCBvYmplY3ROYW1lID0gZGVzdENvbmZpZy5PYmplY3RcblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycyB9LCAnJywgWzIwMF0sICcnLCB0cnVlLCAoZSwgcmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKVxuICAgICAgfVxuICAgICAgY29uc3QgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0Q29weU9iamVjdFRyYW5zZm9ybWVyKClcbiAgICAgIHBpcGVzZXR1cChyZXNwb25zZSwgdHJhbnNmb3JtZXIpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzSGVhZGVycyA9IHJlc3BvbnNlLmhlYWRlcnNcblxuICAgICAgICAgIGNvbnN0IGNvcHlPYmpSZXNwb25zZSA9IHtcbiAgICAgICAgICAgIEJ1Y2tldDogZGVzdENvbmZpZy5CdWNrZXQsXG4gICAgICAgICAgICBLZXk6IGRlc3RDb25maWcuT2JqZWN0LFxuICAgICAgICAgICAgTGFzdE1vZGlmaWVkOiBkYXRhLkxhc3RNb2RpZmllZCxcbiAgICAgICAgICAgIE1ldGFEYXRhOiBleHRyYWN0TWV0YWRhdGEocmVzSGVhZGVycyksXG4gICAgICAgICAgICBWZXJzaW9uSWQ6IGdldFZlcnNpb25JZChyZXNIZWFkZXJzKSxcbiAgICAgICAgICAgIFNvdXJjZVZlcnNpb25JZDogZ2V0U291cmNlVmVyc2lvbklkKHJlc0hlYWRlcnMpLFxuICAgICAgICAgICAgRXRhZzogc2FuaXRpemVFVGFnKHJlc0hlYWRlcnMuZXRhZyksXG4gICAgICAgICAgICBTaXplOiArcmVzSGVhZGVyc1snY29udGVudC1sZW5ndGgnXSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gY2IobnVsbCwgY29weU9ialJlc3BvbnNlKVxuICAgICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvLyBCYWNrd2FyZCBjb21wYXRpYmlsaXR5IGZvciBDb3B5IE9iamVjdCBBUEkuXG4gIGNvcHlPYmplY3QoLi4uYWxsQXJncykge1xuICAgIGlmIChhbGxBcmdzWzBdIGluc3RhbmNlb2YgQ29weVNvdXJjZU9wdGlvbnMgJiYgYWxsQXJnc1sxXSBpbnN0YW5jZW9mIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvcHlPYmplY3RWMiguLi5hcmd1bWVudHMpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLmNvcHlPYmplY3RWMSguLi5hcmd1bWVudHMpXG4gIH1cblxuICAvLyBsaXN0IGEgYmF0Y2ggb2Ygb2JqZWN0c1xuICBsaXN0T2JqZWN0c1F1ZXJ5KGJ1Y2tldE5hbWUsIHByZWZpeCwgbWFya2VyLCBsaXN0UXVlcnlPcHRzID0ge30pIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWZpeCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhtYXJrZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtYXJrZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGxldCB7IERlbGltaXRlciwgTWF4S2V5cywgSW5jbHVkZVZlcnNpb24gfSA9IGxpc3RRdWVyeU9wdHNcblxuICAgIGlmICghaXNPYmplY3QobGlzdFF1ZXJ5T3B0cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3RRdWVyeU9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgaWYgKCFpc1N0cmluZyhEZWxpbWl0ZXIpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdEZWxpbWl0ZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIoTWF4S2V5cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ01heEtleXMgc2hvdWxkIGJlIG9mIHR5cGUgXCJudW1iZXJcIicpXG4gICAgfVxuXG4gICAgY29uc3QgcXVlcmllcyA9IFtdXG4gICAgLy8gZXNjYXBlIGV2ZXJ5IHZhbHVlIGluIHF1ZXJ5IHN0cmluZywgZXhjZXB0IG1heEtleXNcbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoRGVsaW1pdGVyKX1gKVxuICAgIHF1ZXJpZXMucHVzaChgZW5jb2RpbmctdHlwZT11cmxgKVxuXG4gICAgaWYgKEluY2x1ZGVWZXJzaW9uKSB7XG4gICAgICBxdWVyaWVzLnB1c2goYHZlcnNpb25zYClcbiAgICB9XG5cbiAgICBpZiAobWFya2VyKSB7XG4gICAgICBtYXJrZXIgPSB1cmlFc2NhcGUobWFya2VyKVxuICAgICAgaWYgKEluY2x1ZGVWZXJzaW9uKSB7XG4gICAgICAgIHF1ZXJpZXMucHVzaChga2V5LW1hcmtlcj0ke21hcmtlcn1gKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcXVlcmllcy5wdXNoKGBtYXJrZXI9JHttYXJrZXJ9YClcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBubyBuZWVkIHRvIGVzY2FwZSBtYXhLZXlzXG4gICAgaWYgKE1heEtleXMpIHtcbiAgICAgIGlmIChNYXhLZXlzID49IDEwMDApIHtcbiAgICAgICAgTWF4S2V5cyA9IDEwMDBcbiAgICAgIH1cbiAgICAgIHF1ZXJpZXMucHVzaChgbWF4LWtleXM9JHtNYXhLZXlzfWApXG4gICAgfVxuICAgIHF1ZXJpZXMuc29ydCgpXG4gICAgdmFyIHF1ZXJ5ID0gJydcbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyeSA9IGAke3F1ZXJpZXMuam9pbignJicpfWBcbiAgICB9XG5cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0TGlzdE9iamVjdHNUcmFuc2Zvcm1lcigpXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSwgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gdHJhbnNmb3JtZXIuZW1pdCgnZXJyb3InLCBlKVxuICAgICAgfVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcilcbiAgICB9KVxuICAgIHJldHVybiB0cmFuc2Zvcm1lclxuICB9XG5cbiAgLy8gTGlzdCB0aGUgb2JqZWN0cyBpbiB0aGUgYnVja2V0LlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgcHJlZml4YCBfc3RyaW5nXzogdGhlIHByZWZpeCBvZiB0aGUgb2JqZWN0cyB0aGF0IHNob3VsZCBiZSBsaXN0ZWQgKG9wdGlvbmFsLCBkZWZhdWx0IGAnJ2ApXG4gIC8vICogYHJlY3Vyc2l2ZWAgX2Jvb2xfOiBgdHJ1ZWAgaW5kaWNhdGVzIHJlY3Vyc2l2ZSBzdHlsZSBsaXN0aW5nIGFuZCBgZmFsc2VgIGluZGljYXRlcyBkaXJlY3Rvcnkgc3R5bGUgbGlzdGluZyBkZWxpbWl0ZWQgYnkgJy8nLiAob3B0aW9uYWwsIGRlZmF1bHQgYGZhbHNlYClcbiAgLy8gKiBgbGlzdE9wdHMgX29iamVjdF86IHF1ZXJ5IHBhcmFtcyB0byBsaXN0IG9iamVjdCB3aXRoIGJlbG93IGtleXNcbiAgLy8gKiAgICBsaXN0T3B0cy5NYXhLZXlzIF9pbnRfIG1heGltdW0gbnVtYmVyIG9mIGtleXMgdG8gcmV0dXJuXG4gIC8vICogICAgbGlzdE9wdHMuSW5jbHVkZVZlcnNpb24gIF9ib29sXyB0cnVlfGZhbHNlIHRvIGluY2x1ZGUgdmVyc2lvbnMuXG4gIC8vIF9fUmV0dXJuIFZhbHVlX19cbiAgLy8gKiBgc3RyZWFtYCBfU3RyZWFtXzogc3RyZWFtIGVtaXR0aW5nIHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQsIHRoZSBvYmplY3QgaXMgb2YgdGhlIGZvcm1hdDpcbiAgLy8gKiBgb2JqLm5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLnByZWZpeGAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdCBwcmVmaXhcbiAgLy8gKiBgb2JqLnNpemVgIF9udW1iZXJfOiBzaXplIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLmV0YWdgIF9zdHJpbmdfOiBldGFnIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgb2JqLmxhc3RNb2RpZmllZGAgX0RhdGVfOiBtb2RpZmllZCB0aW1lIHN0YW1wXG4gIC8vICogYG9iai5pc0RlbGV0ZU1hcmtlcmAgX2Jvb2xlYW5fOiB0cnVlIGlmIGl0IGlzIGEgZGVsZXRlIG1hcmtlclxuICAvLyAqIGBvYmoudmVyc2lvbklkYCBfc3RyaW5nXzogdmVyc2lvbklkIG9mIHRoZSBvYmplY3RcbiAgbGlzdE9iamVjdHMoYnVja2V0TmFtZSwgcHJlZml4LCByZWN1cnNpdmUsIGxpc3RPcHRzID0ge30pIHtcbiAgICBpZiAocHJlZml4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHByZWZpeCA9ICcnXG4gICAgfVxuICAgIGlmIChyZWN1cnNpdmUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmVjdXJzaXZlID0gZmFsc2VcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkUHJlZml4KHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBJbnZhbGlkIHByZWZpeCA6ICR7cHJlZml4fWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZml4IHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzQm9vbGVhbihyZWN1cnNpdmUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWN1cnNpdmUgc2hvdWxkIGJlIG9mIHR5cGUgXCJib29sZWFuXCInKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGxpc3RPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbGlzdE9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuICAgIHZhciBtYXJrZXIgPSAnJ1xuICAgIGNvbnN0IGxpc3RRdWVyeU9wdHMgPSB7XG4gICAgICBEZWxpbWl0ZXI6IHJlY3Vyc2l2ZSA/ICcnIDogJy8nLCAvLyBpZiByZWN1cnNpdmUgaXMgZmFsc2Ugc2V0IGRlbGltaXRlciB0byAnLydcbiAgICAgIE1heEtleXM6IDEwMDAsXG4gICAgICBJbmNsdWRlVmVyc2lvbjogbGlzdE9wdHMuSW5jbHVkZVZlcnNpb24sXG4gICAgfVxuICAgIHZhciBvYmplY3RzID0gW11cbiAgICB2YXIgZW5kZWQgPSBmYWxzZVxuICAgIHZhciByZWFkU3RyZWFtID0gU3RyZWFtLlJlYWRhYmxlKHsgb2JqZWN0TW9kZTogdHJ1ZSB9KVxuICAgIHJlYWRTdHJlYW0uX3JlYWQgPSAoKSA9PiB7XG4gICAgICAvLyBwdXNoIG9uZSBvYmplY3QgcGVyIF9yZWFkKClcbiAgICAgIGlmIChvYmplY3RzLmxlbmd0aCkge1xuICAgICAgICByZWFkU3RyZWFtLnB1c2gob2JqZWN0cy5zaGlmdCgpKVxuICAgICAgICByZXR1cm5cbiAgICAgIH1cbiAgICAgIGlmIChlbmRlZCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKG51bGwpXG4gICAgICB9XG4gICAgICAvLyBpZiB0aGVyZSBhcmUgbm8gb2JqZWN0cyB0byBwdXNoIGRvIHF1ZXJ5IGZvciB0aGUgbmV4dCBiYXRjaCBvZiBvYmplY3RzXG4gICAgICB0aGlzLmxpc3RPYmplY3RzUXVlcnkoYnVja2V0TmFtZSwgcHJlZml4LCBtYXJrZXIsIGxpc3RRdWVyeU9wdHMpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gcmVhZFN0cmVhbS5lbWl0KCdlcnJvcicsIGUpKVxuICAgICAgICAub24oJ2RhdGEnLCAocmVzdWx0KSA9PiB7XG4gICAgICAgICAgaWYgKHJlc3VsdC5pc1RydW5jYXRlZCkge1xuICAgICAgICAgICAgbWFya2VyID0gcmVzdWx0Lm5leHRNYXJrZXIgfHwgcmVzdWx0LnZlcnNpb25JZE1hcmtlclxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgICAgb2JqZWN0cyA9IHJlc3VsdC5vYmplY3RzXG4gICAgICAgICAgcmVhZFN0cmVhbS5fcmVhZCgpXG4gICAgICAgIH0pXG4gICAgfVxuICAgIHJldHVybiByZWFkU3RyZWFtXG4gIH1cblxuICAvLyBsaXN0T2JqZWN0c1YyUXVlcnkgLSAoTGlzdCBPYmplY3RzIFYyKSAtIExpc3Qgc29tZSBvciBhbGwgKHVwIHRvIDEwMDApIG9mIHRoZSBvYmplY3RzIGluIGEgYnVja2V0LlxuICAvL1xuICAvLyBZb3UgY2FuIHVzZSB0aGUgcmVxdWVzdCBwYXJhbWV0ZXJzIGFzIHNlbGVjdGlvbiBjcml0ZXJpYSB0byByZXR1cm4gYSBzdWJzZXQgb2YgdGhlIG9iamVjdHMgaW4gYSBidWNrZXQuXG4gIC8vIHJlcXVlc3QgcGFyYW1ldGVycyA6LVxuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYHByZWZpeGAgX3N0cmluZ186IExpbWl0cyB0aGUgcmVzcG9uc2UgdG8ga2V5cyB0aGF0IGJlZ2luIHdpdGggdGhlIHNwZWNpZmllZCBwcmVmaXguXG4gIC8vICogYGNvbnRpbnVhdGlvbi10b2tlbmAgX3N0cmluZ186IFVzZWQgdG8gY29udGludWUgaXRlcmF0aW5nIG92ZXIgYSBzZXQgb2Ygb2JqZWN0cy5cbiAgLy8gKiBgZGVsaW1pdGVyYCBfc3RyaW5nXzogQSBkZWxpbWl0ZXIgaXMgYSBjaGFyYWN0ZXIgeW91IHVzZSB0byBncm91cCBrZXlzLlxuICAvLyAqIGBtYXgta2V5c2AgX251bWJlcl86IFNldHMgdGhlIG1heGltdW0gbnVtYmVyIG9mIGtleXMgcmV0dXJuZWQgaW4gdGhlIHJlc3BvbnNlIGJvZHkuXG4gIC8vICogYHN0YXJ0LWFmdGVyYCBfc3RyaW5nXzogU3BlY2lmaWVzIHRoZSBrZXkgdG8gc3RhcnQgYWZ0ZXIgd2hlbiBsaXN0aW5nIG9iamVjdHMgaW4gYSBidWNrZXQuXG4gIGxpc3RPYmplY3RzVjJRdWVyeShidWNrZXROYW1lLCBwcmVmaXgsIGNvbnRpbnVhdGlvblRva2VuLCBkZWxpbWl0ZXIsIG1heEtleXMsIHN0YXJ0QWZ0ZXIpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ByZWZpeCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhjb250aW51YXRpb25Ub2tlbikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NvbnRpbnVhdGlvblRva2VuIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKGRlbGltaXRlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2RlbGltaXRlciBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCFpc051bWJlcihtYXhLZXlzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbWF4S2V5cyBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhzdGFydEFmdGVyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhcnRBZnRlciBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgdmFyIHF1ZXJpZXMgPSBbXVxuXG4gICAgLy8gQ2FsbCBmb3IgbGlzdGluZyBvYmplY3RzIHYyIEFQSVxuICAgIHF1ZXJpZXMucHVzaChgbGlzdC10eXBlPTJgKVxuICAgIHF1ZXJpZXMucHVzaChgZW5jb2RpbmctdHlwZT11cmxgKVxuXG4gICAgLy8gZXNjYXBlIGV2ZXJ5IHZhbHVlIGluIHF1ZXJ5IHN0cmluZywgZXhjZXB0IG1heEtleXNcbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoZGVsaW1pdGVyKX1gKVxuXG4gICAgaWYgKGNvbnRpbnVhdGlvblRva2VuKSB7XG4gICAgICBjb250aW51YXRpb25Ub2tlbiA9IHVyaUVzY2FwZShjb250aW51YXRpb25Ub2tlbilcbiAgICAgIHF1ZXJpZXMucHVzaChgY29udGludWF0aW9uLXRva2VuPSR7Y29udGludWF0aW9uVG9rZW59YClcbiAgICB9XG4gICAgLy8gU2V0IHN0YXJ0LWFmdGVyXG4gICAgaWYgKHN0YXJ0QWZ0ZXIpIHtcbiAgICAgIHN0YXJ0QWZ0ZXIgPSB1cmlFc2NhcGUoc3RhcnRBZnRlcilcbiAgICAgIHF1ZXJpZXMucHVzaChgc3RhcnQtYWZ0ZXI9JHtzdGFydEFmdGVyfWApXG4gICAgfVxuICAgIC8vIG5vIG5lZWQgdG8gZXNjYXBlIG1heEtleXNcbiAgICBpZiAobWF4S2V5cykge1xuICAgICAgaWYgKG1heEtleXMgPj0gMTAwMCkge1xuICAgICAgICBtYXhLZXlzID0gMTAwMFxuICAgICAgfVxuICAgICAgcXVlcmllcy5wdXNoKGBtYXgta2V5cz0ke21heEtleXN9YClcbiAgICB9XG4gICAgcXVlcmllcy5zb3J0KClcbiAgICB2YXIgcXVlcnkgPSAnJ1xuICAgIGlmIChxdWVyaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcmllcy5qb2luKCcmJyl9YFxuICAgIH1cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0TGlzdE9iamVjdHNWMlRyYW5zZm9ybWVyKClcbiAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9LCAnJywgWzIwMF0sICcnLCB0cnVlLCAoZSwgcmVzcG9uc2UpID0+IHtcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1lci5lbWl0KCdlcnJvcicsIGUpXG4gICAgICB9XG4gICAgICBwaXBlc2V0dXAocmVzcG9uc2UsIHRyYW5zZm9ybWVyKVxuICAgIH0pXG4gICAgcmV0dXJuIHRyYW5zZm9ybWVyXG4gIH1cblxuICAvLyBMaXN0IHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQgdXNpbmcgUzMgTGlzdE9iamVjdHMgVjJcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYHByZWZpeGAgX3N0cmluZ186IHRoZSBwcmVmaXggb2YgdGhlIG9iamVjdHMgdGhhdCBzaG91bGQgYmUgbGlzdGVkIChvcHRpb25hbCwgZGVmYXVsdCBgJydgKVxuICAvLyAqIGByZWN1cnNpdmVgIF9ib29sXzogYHRydWVgIGluZGljYXRlcyByZWN1cnNpdmUgc3R5bGUgbGlzdGluZyBhbmQgYGZhbHNlYCBpbmRpY2F0ZXMgZGlyZWN0b3J5IHN0eWxlIGxpc3RpbmcgZGVsaW1pdGVkIGJ5ICcvJy4gKG9wdGlvbmFsLCBkZWZhdWx0IGBmYWxzZWApXG4gIC8vICogYHN0YXJ0QWZ0ZXJgIF9zdHJpbmdfOiBTcGVjaWZpZXMgdGhlIGtleSB0byBzdGFydCBhZnRlciB3aGVuIGxpc3Rpbmcgb2JqZWN0cyBpbiBhIGJ1Y2tldC4gKG9wdGlvbmFsLCBkZWZhdWx0IGAnJ2ApXG4gIC8vXG4gIC8vIF9fUmV0dXJuIFZhbHVlX19cbiAgLy8gKiBgc3RyZWFtYCBfU3RyZWFtXzogc3RyZWFtIGVtaXR0aW5nIHRoZSBvYmplY3RzIGluIHRoZSBidWNrZXQsIHRoZSBvYmplY3QgaXMgb2YgdGhlIGZvcm1hdDpcbiAgLy8gICAqIGBvYmoubmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAgICogYG9iai5wcmVmaXhgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3QgcHJlZml4XG4gIC8vICAgKiBgb2JqLnNpemVgIF9udW1iZXJfOiBzaXplIG9mIHRoZSBvYmplY3RcbiAgLy8gICAqIGBvYmouZXRhZ2AgX3N0cmluZ186IGV0YWcgb2YgdGhlIG9iamVjdFxuICAvLyAgICogYG9iai5sYXN0TW9kaWZpZWRgIF9EYXRlXzogbW9kaWZpZWQgdGltZSBzdGFtcFxuICBsaXN0T2JqZWN0c1YyKGJ1Y2tldE5hbWUsIHByZWZpeCwgcmVjdXJzaXZlLCBzdGFydEFmdGVyKSB7XG4gICAgaWYgKHByZWZpeCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwcmVmaXggPSAnJ1xuICAgIH1cbiAgICBpZiAocmVjdXJzaXZlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJlY3Vyc2l2ZSA9IGZhbHNlXG4gICAgfVxuICAgIGlmIChzdGFydEFmdGVyID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHN0YXJ0QWZ0ZXIgPSAnJ1xuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRQcmVmaXgocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkUHJlZml4RXJyb3IoYEludmFsaWQgcHJlZml4IDogJHtwcmVmaXh9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwcmVmaXgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVmaXggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHJlY3Vyc2l2ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3JlY3Vyc2l2ZSBzaG91bGQgYmUgb2YgdHlwZSBcImJvb2xlYW5cIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoc3RhcnRBZnRlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N0YXJ0QWZ0ZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIC8vIGlmIHJlY3Vyc2l2ZSBpcyBmYWxzZSBzZXQgZGVsaW1pdGVyIHRvICcvJ1xuICAgIHZhciBkZWxpbWl0ZXIgPSByZWN1cnNpdmUgPyAnJyA6ICcvJ1xuICAgIHZhciBjb250aW51YXRpb25Ub2tlbiA9ICcnXG4gICAgdmFyIG9iamVjdHMgPSBbXVxuICAgIHZhciBlbmRlZCA9IGZhbHNlXG4gICAgdmFyIHJlYWRTdHJlYW0gPSBTdHJlYW0uUmVhZGFibGUoeyBvYmplY3RNb2RlOiB0cnVlIH0pXG4gICAgcmVhZFN0cmVhbS5fcmVhZCA9ICgpID0+IHtcbiAgICAgIC8vIHB1c2ggb25lIG9iamVjdCBwZXIgX3JlYWQoKVxuICAgICAgaWYgKG9iamVjdHMubGVuZ3RoKSB7XG4gICAgICAgIHJlYWRTdHJlYW0ucHVzaChvYmplY3RzLnNoaWZ0KCkpXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgaWYgKGVuZGVkKSB7XG4gICAgICAgIHJldHVybiByZWFkU3RyZWFtLnB1c2gobnVsbClcbiAgICAgIH1cbiAgICAgIC8vIGlmIHRoZXJlIGFyZSBubyBvYmplY3RzIHRvIHB1c2ggZG8gcXVlcnkgZm9yIHRoZSBuZXh0IGJhdGNoIG9mIG9iamVjdHNcbiAgICAgIHRoaXMubGlzdE9iamVjdHNWMlF1ZXJ5KGJ1Y2tldE5hbWUsIHByZWZpeCwgY29udGludWF0aW9uVG9rZW4sIGRlbGltaXRlciwgMTAwMCwgc3RhcnRBZnRlcilcbiAgICAgICAgLm9uKCdlcnJvcicsIChlKSA9PiByZWFkU3RyZWFtLmVtaXQoJ2Vycm9yJywgZSkpXG4gICAgICAgIC5vbignZGF0YScsIChyZXN1bHQpID0+IHtcbiAgICAgICAgICBpZiAocmVzdWx0LmlzVHJ1bmNhdGVkKSB7XG4gICAgICAgICAgICBjb250aW51YXRpb25Ub2tlbiA9IHJlc3VsdC5uZXh0Q29udGludWF0aW9uVG9rZW5cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZW5kZWQgPSB0cnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIG9iamVjdHMgPSByZXN1bHQub2JqZWN0c1xuICAgICAgICAgIHJlYWRTdHJlYW0uX3JlYWQoKVxuICAgICAgICB9KVxuICAgIH1cbiAgICByZXR1cm4gcmVhZFN0cmVhbVxuICB9XG5cbiAgLy8gUmVtb3ZlIGFsbCB0aGUgb2JqZWN0cyByZXNpZGluZyBpbiB0aGUgb2JqZWN0c0xpc3QuXG4gIC8vXG4gIC8vIF9fQXJndW1lbnRzX19cbiAgLy8gKiBgYnVja2V0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIGJ1Y2tldFxuICAvLyAqIGBvYmplY3RzTGlzdGAgX2FycmF5XzogYXJyYXkgb2Ygb2JqZWN0cyBvZiBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbiAgLy8gKiAgICAgICAgIExpc3Qgb2YgT2JqZWN0IG5hbWVzIGFzIGFycmF5IG9mIHN0cmluZ3Mgd2hpY2ggYXJlIG9iamVjdCBrZXlzOiAgWydvYmplY3RuYW1lMScsJ29iamVjdG5hbWUyJ11cbiAgLy8gKiAgICAgICAgIExpc3Qgb2YgT2JqZWN0IG5hbWUgYW5kIHZlcnNpb25JZCBhcyBhbiBvYmplY3Q6ICBbe25hbWU6XCJvYmplY3RuYW1lXCIsdmVyc2lvbklkOlwibXktdmVyc2lvbi1pZFwifV1cblxuICByZW1vdmVPYmplY3RzKGJ1Y2tldE5hbWUsIG9iamVjdHNMaXN0LCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghQXJyYXkuaXNBcnJheShvYmplY3RzTGlzdCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ29iamVjdHNMaXN0IHNob3VsZCBiZSBhIGxpc3QnKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cblxuICAgIGNvbnN0IG1heEVudHJpZXMgPSAxMDAwXG4gICAgY29uc3QgcXVlcnkgPSAnZGVsZXRlJ1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuXG4gICAgbGV0IHJlc3VsdCA9IG9iamVjdHNMaXN0LnJlZHVjZShcbiAgICAgIChyZXN1bHQsIGVudHJ5KSA9PiB7XG4gICAgICAgIHJlc3VsdC5saXN0LnB1c2goZW50cnkpXG4gICAgICAgIGlmIChyZXN1bHQubGlzdC5sZW5ndGggPT09IG1heEVudHJpZXMpIHtcbiAgICAgICAgICByZXN1bHQubGlzdE9mTGlzdC5wdXNoKHJlc3VsdC5saXN0KVxuICAgICAgICAgIHJlc3VsdC5saXN0ID0gW11cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzdWx0XG4gICAgICB9LFxuICAgICAgeyBsaXN0T2ZMaXN0OiBbXSwgbGlzdDogW10gfSxcbiAgICApXG5cbiAgICBpZiAocmVzdWx0Lmxpc3QubGVuZ3RoID4gMCkge1xuICAgICAgcmVzdWx0Lmxpc3RPZkxpc3QucHVzaChyZXN1bHQubGlzdClcbiAgICB9XG5cbiAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKClcbiAgICBjb25zdCBiYXRjaFJlc3VsdHMgPSBbXVxuXG4gICAgYXN5bmMuZWFjaFNlcmllcyhcbiAgICAgIHJlc3VsdC5saXN0T2ZMaXN0LFxuICAgICAgKGxpc3QsIGJhdGNoQ2IpID0+IHtcbiAgICAgICAgdmFyIG9iamVjdHMgPSBbXVxuICAgICAgICBsaXN0LmZvckVhY2goZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgICAgICAgICAgb2JqZWN0cy5wdXNoKHsgS2V5OiB2YWx1ZS5uYW1lLCBWZXJzaW9uSWQ6IHZhbHVlLnZlcnNpb25JZCB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvYmplY3RzLnB1c2goeyBLZXk6IHZhbHVlIH0pXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBsZXQgZGVsZXRlT2JqZWN0cyA9IHsgRGVsZXRlOiB7IFF1aWV0OiB0cnVlLCBPYmplY3Q6IG9iamVjdHMgfSB9XG4gICAgICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyBoZWFkbGVzczogdHJ1ZSB9KVxuICAgICAgICBsZXQgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoZGVsZXRlT2JqZWN0cylcbiAgICAgICAgcGF5bG9hZCA9IEJ1ZmZlci5mcm9tKGVuY29kZXIuZW5jb2RlKHBheWxvYWQpKVxuICAgICAgICBjb25zdCBoZWFkZXJzID0ge31cblxuICAgICAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcblxuICAgICAgICBsZXQgcmVtb3ZlT2JqZWN0c1Jlc3VsdFxuICAgICAgICB0aGlzLm1ha2VSZXF1ZXN0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgICAgIGlmIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gYmF0Y2hDYihlKVxuICAgICAgICAgIH1cbiAgICAgICAgICBwaXBlc2V0dXAocmVzcG9uc2UsIHRyYW5zZm9ybWVycy5yZW1vdmVPYmplY3RzVHJhbnNmb3JtZXIoKSlcbiAgICAgICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgICAgIHJlbW92ZU9iamVjdHNSZXN1bHQgPSBkYXRhXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdlcnJvcicsIChlKSA9PiB7XG4gICAgICAgICAgICAgIHJldHVybiBiYXRjaENiKGUsIG51bGwpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgICAgIGJhdGNoUmVzdWx0cy5wdXNoKHJlbW92ZU9iamVjdHNSZXN1bHQpXG4gICAgICAgICAgICAgIHJldHVybiBiYXRjaENiKG51bGwsIHJlbW92ZU9iamVjdHNSZXN1bHQpXG4gICAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfSxcbiAgICAgICgpID0+IHtcbiAgICAgICAgY2IobnVsbCwgXy5mbGF0dGVuKGJhdGNoUmVzdWx0cykpXG4gICAgICB9LFxuICAgIClcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGEgZ2VuZXJpYyBwcmVzaWduZWQgVVJMIHdoaWNoIGNhbiBiZVxuICAvLyB1c2VkIGZvciBIVFRQIG1ldGhvZHMgR0VULCBQVVQsIEhFQUQgYW5kIERFTEVURVxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYG1ldGhvZGAgX3N0cmluZ186IG5hbWUgb2YgdGhlIEhUVFAgbWV0aG9kXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBleHBpcnlgIF9udW1iZXJfOiBleHBpcnkgaW4gc2Vjb25kcyAob3B0aW9uYWwsIGRlZmF1bHQgNyBkYXlzKVxuICAvLyAqIGByZXFQYXJhbXNgIF9vYmplY3RfOiByZXF1ZXN0IHBhcmFtZXRlcnMgKG9wdGlvbmFsKSBlLmcge3ZlcnNpb25JZDpcIjEwZmE5OTQ2LTNmNjQtNDEzNy1hNThmLTg4ODA2NWMwNzMyZVwifVxuICAvLyAqIGByZXF1ZXN0RGF0ZWAgX0RhdGVfOiBBIGRhdGUgb2JqZWN0LCB0aGUgdXJsIHdpbGwgYmUgaXNzdWVkIGF0IChvcHRpb25hbClcbiAgcHJlc2lnbmVkVXJsKG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgcmVxUGFyYW1zLCByZXF1ZXN0RGF0ZSwgY2IpIHtcbiAgICBpZiAodGhpcy5hbm9ueW1vdXMpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuQW5vbnltb3VzUmVxdWVzdEVycm9yKCdQcmVzaWduZWQgJyArIG1ldGhvZCArICcgdXJsIGNhbm5vdCBiZSBnZW5lcmF0ZWQgZm9yIGFub255bW91cyByZXF1ZXN0cycpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKHJlcXVlc3REYXRlKSkge1xuICAgICAgY2IgPSByZXF1ZXN0RGF0ZVxuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKHJlcVBhcmFtcykpIHtcbiAgICAgIGNiID0gcmVxUGFyYW1zXG4gICAgICByZXFQYXJhbXMgPSB7fVxuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmIChpc0Z1bmN0aW9uKGV4cGlyZXMpKSB7XG4gICAgICBjYiA9IGV4cGlyZXNcbiAgICAgIHJlcVBhcmFtcyA9IHt9XG4gICAgICBleHBpcmVzID0gMjQgKiA2MCAqIDYwICogNyAvLyA3IGRheXMgaW4gc2Vjb25kc1xuICAgICAgcmVxdWVzdERhdGUgPSBuZXcgRGF0ZSgpXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIoZXhwaXJlcykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V4cGlyZXMgc2hvdWxkIGJlIG9mIHR5cGUgXCJudW1iZXJcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QocmVxUGFyYW1zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxUGFyYW1zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWREYXRlKHJlcXVlc3REYXRlKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxdWVzdERhdGUgc2hvdWxkIGJlIG9mIHR5cGUgXCJEYXRlXCIgYW5kIHZhbGlkJylcbiAgICB9XG4gICAgaWYgKCFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG4gICAgdmFyIHF1ZXJ5ID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHJlcVBhcmFtcylcbiAgICB0aGlzLmdldEJ1Y2tldFJlZ2lvbihidWNrZXROYW1lLCAoZSwgcmVnaW9uKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gY2IoZSlcbiAgICAgIH1cbiAgICAgIC8vIFRoaXMgc3RhdGVtZW50IGlzIGFkZGVkIHRvIGVuc3VyZSB0aGF0IHdlIHNlbmQgZXJyb3IgdGhyb3VnaFxuICAgICAgLy8gY2FsbGJhY2sgb24gcHJlc2lnbiBmYWlsdXJlLlxuICAgICAgdmFyIHVybFxuICAgICAgdmFyIHJlcU9wdGlvbnMgPSB0aGlzLmdldFJlcXVlc3RPcHRpb25zKHsgbWV0aG9kLCByZWdpb24sIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0pXG5cbiAgICAgIHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuICAgICAgdHJ5IHtcbiAgICAgICAgdXJsID0gcHJlc2lnblNpZ25hdHVyZVY0KFxuICAgICAgICAgIHJlcU9wdGlvbnMsXG4gICAgICAgICAgdGhpcy5hY2Nlc3NLZXksXG4gICAgICAgICAgdGhpcy5zZWNyZXRLZXksXG4gICAgICAgICAgdGhpcy5zZXNzaW9uVG9rZW4sXG4gICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgIHJlcXVlc3REYXRlLFxuICAgICAgICAgIGV4cGlyZXMsXG4gICAgICAgIClcbiAgICAgIH0gY2F0Y2ggKHBlKSB7XG4gICAgICAgIHJldHVybiBjYihwZSlcbiAgICAgIH1cbiAgICAgIGNiKG51bGwsIHVybClcbiAgICB9KVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSBwcmVzaWduZWQgVVJMIGZvciBHRVRcbiAgLy9cbiAgLy8gX19Bcmd1bWVudHNfX1xuICAvLyAqIGBidWNrZXROYW1lYCBfc3RyaW5nXzogbmFtZSBvZiB0aGUgYnVja2V0XG4gIC8vICogYG9iamVjdE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBvYmplY3RcbiAgLy8gKiBgZXhwaXJ5YCBfbnVtYmVyXzogZXhwaXJ5IGluIHNlY29uZHMgKG9wdGlvbmFsLCBkZWZhdWx0IDcgZGF5cylcbiAgLy8gKiBgcmVzcEhlYWRlcnNgIF9vYmplY3RfOiByZXNwb25zZSBoZWFkZXJzIHRvIG92ZXJyaWRlIG9yIHJlcXVlc3QgcGFyYW1zIGZvciBxdWVyeSAob3B0aW9uYWwpIGUuZyB7dmVyc2lvbklkOlwiMTBmYTk5NDYtM2Y2NC00MTM3LWE1OGYtODg4MDY1YzA3MzJlXCJ9XG4gIC8vICogYHJlcXVlc3REYXRlYCBfRGF0ZV86IEEgZGF0ZSBvYmplY3QsIHRoZSB1cmwgd2lsbCBiZSBpc3N1ZWQgYXQgKG9wdGlvbmFsKVxuICBwcmVzaWduZWRHZXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgcmVzcEhlYWRlcnMsIHJlcXVlc3REYXRlLCBjYikge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuXG4gICAgaWYgKGlzRnVuY3Rpb24ocmVzcEhlYWRlcnMpKSB7XG4gICAgICBjYiA9IHJlc3BIZWFkZXJzXG4gICAgICByZXNwSGVhZGVycyA9IHt9XG4gICAgICByZXF1ZXN0RGF0ZSA9IG5ldyBEYXRlKClcbiAgICB9XG5cbiAgICB2YXIgdmFsaWRSZXNwSGVhZGVycyA9IFtcbiAgICAgICdyZXNwb25zZS1jb250ZW50LXR5cGUnLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtbGFuZ3VhZ2UnLFxuICAgICAgJ3Jlc3BvbnNlLWV4cGlyZXMnLFxuICAgICAgJ3Jlc3BvbnNlLWNhY2hlLWNvbnRyb2wnLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtZGlzcG9zaXRpb24nLFxuICAgICAgJ3Jlc3BvbnNlLWNvbnRlbnQtZW5jb2RpbmcnLFxuICAgIF1cbiAgICB2YWxpZFJlc3BIZWFkZXJzLmZvckVhY2goKGhlYWRlcikgPT4ge1xuICAgICAgaWYgKHJlc3BIZWFkZXJzICE9PSB1bmRlZmluZWQgJiYgcmVzcEhlYWRlcnNbaGVhZGVyXSAhPT0gdW5kZWZpbmVkICYmICFpc1N0cmluZyhyZXNwSGVhZGVyc1toZWFkZXJdKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGByZXNwb25zZSBoZWFkZXIgJHtoZWFkZXJ9IHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCJgKVxuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIHRoaXMucHJlc2lnbmVkVXJsKCdHRVQnLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBleHBpcmVzLCByZXNwSGVhZGVycywgcmVxdWVzdERhdGUsIGNiKVxuICB9XG5cbiAgLy8gR2VuZXJhdGUgYSBwcmVzaWduZWQgVVJMIGZvciBQVVQuIFVzaW5nIHRoaXMgVVJMLCB0aGUgYnJvd3NlciBjYW4gdXBsb2FkIHRvIFMzIG9ubHkgd2l0aCB0aGUgc3BlY2lmaWVkIG9iamVjdCBuYW1lLlxuICAvL1xuICAvLyBfX0FyZ3VtZW50c19fXG4gIC8vICogYGJ1Y2tldE5hbWVgIF9zdHJpbmdfOiBuYW1lIG9mIHRoZSBidWNrZXRcbiAgLy8gKiBgb2JqZWN0TmFtZWAgX3N0cmluZ186IG5hbWUgb2YgdGhlIG9iamVjdFxuICAvLyAqIGBleHBpcnlgIF9udW1iZXJfOiBleHBpcnkgaW4gc2Vjb25kcyAob3B0aW9uYWwsIGRlZmF1bHQgNyBkYXlzKVxuICBwcmVzaWduZWRQdXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZXhwaXJlcywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoYEludmFsaWQgYnVja2V0IG5hbWU6ICR7YnVja2V0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wcmVzaWduZWRVcmwoJ1BVVCcsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGV4cGlyZXMsIGNiKVxuICB9XG5cbiAgLy8gcmV0dXJuIFBvc3RQb2xpY3kgb2JqZWN0XG4gIG5ld1Bvc3RQb2xpY3koKSB7XG4gICAgcmV0dXJuIG5ldyBQb3N0UG9saWN5KClcbiAgfVxuXG4gIC8vIHByZXNpZ25lZFBvc3RQb2xpY3kgY2FuIGJlIHVzZWQgaW4gc2l0dWF0aW9ucyB3aGVyZSB3ZSB3YW50IG1vcmUgY29udHJvbCBvbiB0aGUgdXBsb2FkIHRoYW4gd2hhdFxuICAvLyBwcmVzaWduZWRQdXRPYmplY3QoKSBwcm92aWRlcy4gaS5lIFVzaW5nIHByZXNpZ25lZFBvc3RQb2xpY3kgd2Ugd2lsbCBiZSBhYmxlIHRvIHB1dCBwb2xpY3kgcmVzdHJpY3Rpb25zXG4gIC8vIG9uIHRoZSBvYmplY3QncyBgbmFtZWAgYGJ1Y2tldGAgYGV4cGlyeWAgYENvbnRlbnQtVHlwZWAgYENvbnRlbnQtRGlzcG9zaXRpb25gIGBtZXRhRGF0YWBcbiAgcHJlc2lnbmVkUG9zdFBvbGljeShwb3N0UG9saWN5LCBjYikge1xuICAgIGlmICh0aGlzLmFub255bW91cykge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5Bbm9ueW1vdXNSZXF1ZXN0RXJyb3IoJ1ByZXNpZ25lZCBQT1NUIHBvbGljeSBjYW5ub3QgYmUgZ2VuZXJhdGVkIGZvciBhbm9ueW1vdXMgcmVxdWVzdHMnKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KHBvc3RQb2xpY3kpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwb3N0UG9saWN5IHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYiBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cbiAgICB0aGlzLmdldEJ1Y2tldFJlZ2lvbihwb3N0UG9saWN5LmZvcm1EYXRhLmJ1Y2tldCwgKGUsIHJlZ2lvbikgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgZGF0ZSA9IG5ldyBEYXRlKClcbiAgICAgIHZhciBkYXRlU3RyID0gbWFrZURhdGVMb25nKGRhdGUpXG5cbiAgICAgIHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuXG4gICAgICBpZiAoIXBvc3RQb2xpY3kucG9saWN5LmV4cGlyYXRpb24pIHtcbiAgICAgICAgLy8gJ2V4cGlyYXRpb24nIGlzIG1hbmRhdG9yeSBmaWVsZCBmb3IgUzMuXG4gICAgICAgIC8vIFNldCBkZWZhdWx0IGV4cGlyYXRpb24gZGF0ZSBvZiA3IGRheXMuXG4gICAgICAgIHZhciBleHBpcmVzID0gbmV3IERhdGUoKVxuICAgICAgICBleHBpcmVzLnNldFNlY29uZHMoMjQgKiA2MCAqIDYwICogNylcbiAgICAgICAgcG9zdFBvbGljeS5zZXRFeHBpcmVzKGV4cGlyZXMpXG4gICAgICB9XG5cbiAgICAgIHBvc3RQb2xpY3kucG9saWN5LmNvbmRpdGlvbnMucHVzaChbJ2VxJywgJyR4LWFtei1kYXRlJywgZGF0ZVN0cl0pXG4gICAgICBwb3N0UG9saWN5LmZvcm1EYXRhWyd4LWFtei1kYXRlJ10gPSBkYXRlU3RyXG5cbiAgICAgIHBvc3RQb2xpY3kucG9saWN5LmNvbmRpdGlvbnMucHVzaChbJ2VxJywgJyR4LWFtei1hbGdvcml0aG0nLCAnQVdTNC1ITUFDLVNIQTI1NiddKVxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YVsneC1hbXotYWxnb3JpdGhtJ10gPSAnQVdTNC1ITUFDLVNIQTI1NidcblxuICAgICAgcG9zdFBvbGljeS5wb2xpY3kuY29uZGl0aW9ucy5wdXNoKFsnZXEnLCAnJHgtYW16LWNyZWRlbnRpYWwnLCB0aGlzLmFjY2Vzc0tleSArICcvJyArIGdldFNjb3BlKHJlZ2lvbiwgZGF0ZSldKVxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YVsneC1hbXotY3JlZGVudGlhbCddID0gdGhpcy5hY2Nlc3NLZXkgKyAnLycgKyBnZXRTY29wZShyZWdpb24sIGRhdGUpXG5cbiAgICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbikge1xuICAgICAgICBwb3N0UG9saWN5LnBvbGljeS5jb25kaXRpb25zLnB1c2goWydlcScsICckeC1hbXotc2VjdXJpdHktdG9rZW4nLCB0aGlzLnNlc3Npb25Ub2tlbl0pXG4gICAgICAgIHBvc3RQb2xpY3kuZm9ybURhdGFbJ3gtYW16LXNlY3VyaXR5LXRva2VuJ10gPSB0aGlzLnNlc3Npb25Ub2tlblxuICAgICAgfVxuXG4gICAgICB2YXIgcG9saWN5QmFzZTY0ID0gQnVmZmVyLmZyb20oSlNPTi5zdHJpbmdpZnkocG9zdFBvbGljeS5wb2xpY3kpKS50b1N0cmluZygnYmFzZTY0JylcblxuICAgICAgcG9zdFBvbGljeS5mb3JtRGF0YS5wb2xpY3kgPSBwb2xpY3lCYXNlNjRcblxuICAgICAgdmFyIHNpZ25hdHVyZSA9IHBvc3RQcmVzaWduU2lnbmF0dXJlVjQocmVnaW9uLCBkYXRlLCB0aGlzLnNlY3JldEtleSwgcG9saWN5QmFzZTY0KVxuXG4gICAgICBwb3N0UG9saWN5LmZvcm1EYXRhWyd4LWFtei1zaWduYXR1cmUnXSA9IHNpZ25hdHVyZVxuICAgICAgdmFyIG9wdHMgPSB7fVxuICAgICAgb3B0cy5yZWdpb24gPSByZWdpb25cbiAgICAgIG9wdHMuYnVja2V0TmFtZSA9IHBvc3RQb2xpY3kuZm9ybURhdGEuYnVja2V0XG4gICAgICB2YXIgcmVxT3B0aW9ucyA9IHRoaXMuZ2V0UmVxdWVzdE9wdGlvbnMob3B0cylcbiAgICAgIHZhciBwb3J0U3RyID0gdGhpcy5wb3J0ID09IDgwIHx8IHRoaXMucG9ydCA9PT0gNDQzID8gJycgOiBgOiR7dGhpcy5wb3J0LnRvU3RyaW5nKCl9YFxuICAgICAgdmFyIHVybFN0ciA9IGAke3JlcU9wdGlvbnMucHJvdG9jb2x9Ly8ke3JlcU9wdGlvbnMuaG9zdH0ke3BvcnRTdHJ9JHtyZXFPcHRpb25zLnBhdGh9YFxuICAgICAgY2IobnVsbCwgeyBwb3N0VVJMOiB1cmxTdHIsIGZvcm1EYXRhOiBwb3N0UG9saWN5LmZvcm1EYXRhIH0pXG4gICAgfSlcbiAgfVxuXG4gIC8vIFJlbW92ZSBhbGwgdGhlIG5vdGlmaWNhdGlvbiBjb25maWd1cmF0aW9ucyBpbiB0aGUgUzMgcHJvdmlkZXJcbiAgc2V0QnVja2V0Tm90aWZpY2F0aW9uKGJ1Y2tldE5hbWUsIGNvbmZpZywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGNvbmZpZykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ25vdGlmaWNhdGlvbiBjb25maWcgc2hvdWxkIGJlIG9mIHR5cGUgXCJPYmplY3RcIicpXG4gICAgfVxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuICAgIHZhciBtZXRob2QgPSAnUFVUJ1xuICAgIHZhciBxdWVyeSA9ICdub3RpZmljYXRpb24nXG4gICAgdmFyIGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdOb3RpZmljYXRpb25Db25maWd1cmF0aW9uJyxcbiAgICAgIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LFxuICAgICAgaGVhZGxlc3M6IHRydWUsXG4gICAgfSlcbiAgICB2YXIgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoY29uZmlnKVxuICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQsIFsyMDBdLCAnJywgZmFsc2UsIGNiKVxuICB9XG5cbiAgcmVtb3ZlQWxsQnVja2V0Tm90aWZpY2F0aW9uKGJ1Y2tldE5hbWUsIGNiKSB7XG4gICAgdGhpcy5zZXRCdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgbmV3IE5vdGlmaWNhdGlvbkNvbmZpZygpLCBjYilcbiAgfVxuXG4gIC8vIFJldHVybiB0aGUgbGlzdCBvZiBub3RpZmljYXRpb24gY29uZmlndXJhdGlvbnMgc3RvcmVkXG4gIC8vIGluIHRoZSBTMyBwcm92aWRlclxuICBnZXRCdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzRnVuY3Rpb24oY2IpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcImZ1bmN0aW9uXCInKVxuICAgIH1cbiAgICB2YXIgbWV0aG9kID0gJ0dFVCdcbiAgICB2YXIgcXVlcnkgPSAnbm90aWZpY2F0aW9uJ1xuICAgIHRoaXMubWFrZVJlcXVlc3QoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwXSwgJycsIHRydWUsIChlLCByZXNwb25zZSkgPT4ge1xuICAgICAgaWYgKGUpIHtcbiAgICAgICAgcmV0dXJuIGNiKGUpXG4gICAgICB9XG4gICAgICB2YXIgdHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lcnMuZ2V0QnVja2V0Tm90aWZpY2F0aW9uVHJhbnNmb3JtZXIoKVxuICAgICAgdmFyIGJ1Y2tldE5vdGlmaWNhdGlvblxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcilcbiAgICAgICAgLm9uKCdkYXRhJywgKHJlc3VsdCkgPT4gKGJ1Y2tldE5vdGlmaWNhdGlvbiA9IHJlc3VsdCkpXG4gICAgICAgIC5vbignZXJyb3InLCAoZSkgPT4gY2IoZSkpXG4gICAgICAgIC5vbignZW5kJywgKCkgPT4gY2IobnVsbCwgYnVja2V0Tm90aWZpY2F0aW9uKSlcbiAgICB9KVxuICB9XG5cbiAgLy8gTGlzdGVucyBmb3IgYnVja2V0IG5vdGlmaWNhdGlvbnMuIFJldHVybnMgYW4gRXZlbnRFbWl0dGVyLlxuICBsaXN0ZW5CdWNrZXROb3RpZmljYXRpb24oYnVja2V0TmFtZSwgcHJlZml4LCBzdWZmaXgsIGV2ZW50cykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcihgSW52YWxpZCBidWNrZXQgbmFtZTogJHtidWNrZXROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocHJlZml4KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncHJlZml4IG11c3QgYmUgb2YgdHlwZSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHN1ZmZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3N1ZmZpeCBtdXN0IGJlIG9mIHR5cGUgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGV2ZW50cykpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2V2ZW50cyBtdXN0IGJlIG9mIHR5cGUgQXJyYXknKVxuICAgIH1cbiAgICBsZXQgbGlzdGVuZXIgPSBuZXcgTm90aWZpY2F0aW9uUG9sbGVyKHRoaXMsIGJ1Y2tldE5hbWUsIHByZWZpeCwgc3VmZml4LCBldmVudHMpXG4gICAgbGlzdGVuZXIuc3RhcnQoKVxuXG4gICAgcmV0dXJuIGxpc3RlbmVyXG4gIH1cblxuICBnZXRPYmplY3RSZXRlbnRpb24oYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZ2V0T3B0cywgY2IpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGdldE9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdjYWxsYmFjayBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9IGVsc2UgaWYgKGdldE9wdHMudmVyc2lvbklkICYmICFpc1N0cmluZyhnZXRPcHRzLnZlcnNpb25JZCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ1ZlcnNpb25JRCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKGNiICYmICFpc0Z1bmN0aW9uKGNiKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignY2FsbGJhY2sgc2hvdWxkIGJlIG9mIHR5cGUgXCJmdW5jdGlvblwiJylcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBsZXQgcXVlcnkgPSAncmV0ZW50aW9uJ1xuICAgIGlmIChnZXRPcHRzLnZlcnNpb25JZCkge1xuICAgICAgcXVlcnkgKz0gYCZ2ZXJzaW9uSWQ9JHtnZXRPcHRzLnZlcnNpb25JZH1gXG4gICAgfVxuXG4gICAgdGhpcy5tYWtlUmVxdWVzdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfSwgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBpZiAoZSkge1xuICAgICAgICByZXR1cm4gY2IoZSlcbiAgICAgIH1cblxuICAgICAgbGV0IHJldGVudGlvbkNvbmZpZyA9IEJ1ZmZlci5mcm9tKCcnKVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcnMub2JqZWN0UmV0ZW50aW9uVHJhbnNmb3JtZXIoKSlcbiAgICAgICAgLm9uKCdkYXRhJywgKGRhdGEpID0+IHtcbiAgICAgICAgICByZXRlbnRpb25Db25maWcgPSBkYXRhXG4gICAgICAgIH0pXG4gICAgICAgIC5vbignZXJyb3InLCBjYilcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgY2IobnVsbCwgcmV0ZW50aW9uQ29uZmlnKVxuICAgICAgICB9KVxuICAgIH0pXG4gIH1cblxuICAvKipcbiAgICogSW50ZXJuYWwgbWV0aG9kIHRvIHVwbG9hZCBhIHBhcnQgZHVyaW5nIGNvbXBvc2Ugb2JqZWN0LlxuICAgKiBAcGFyYW0gcGFydENvbmZpZyBfX29iamVjdF9fIGNvbnRhaW5zIHRoZSBmb2xsb3dpbmcuXG4gICAqICAgIGJ1Y2tldE5hbWUgX19zdHJpbmdfX1xuICAgKiAgICBvYmplY3ROYW1lIF9fc3RyaW5nX19cbiAgICogICAgdXBsb2FkSUQgX19zdHJpbmdfX1xuICAgKiAgICBwYXJ0TnVtYmVyIF9fbnVtYmVyX19cbiAgICogICAgaGVhZGVycyBfX29iamVjdF9fXG4gICAqIEBwYXJhbSBjYiBjYWxsZWQgd2l0aCBudWxsIGluY2FzZSBvZiBlcnJvci5cbiAgICovXG4gIHVwbG9hZFBhcnRDb3B5KHBhcnRDb25maWcsIGNiKSB7XG4gICAgY29uc3QgeyBidWNrZXROYW1lLCBvYmplY3ROYW1lLCB1cGxvYWRJRCwgcGFydE51bWJlciwgaGVhZGVycyB9ID0gcGFydENvbmZpZ1xuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBsZXQgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cGxvYWRJRH0mcGFydE51bWJlcj0ke3BhcnROdW1iZXJ9YFxuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0geyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWU6IG9iamVjdE5hbWUsIHF1ZXJ5LCBoZWFkZXJzIH1cbiAgICByZXR1cm4gdGhpcy5tYWtlUmVxdWVzdChyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDBdLCAnJywgdHJ1ZSwgKGUsIHJlc3BvbnNlKSA9PiB7XG4gICAgICBsZXQgcGFydENvcHlSZXN1bHQgPSBCdWZmZXIuZnJvbSgnJylcbiAgICAgIGlmIChlKSB7XG4gICAgICAgIHJldHVybiBjYihlKVxuICAgICAgfVxuICAgICAgcGlwZXNldHVwKHJlc3BvbnNlLCB0cmFuc2Zvcm1lcnMudXBsb2FkUGFydFRyYW5zZm9ybWVyKCkpXG4gICAgICAgIC5vbignZGF0YScsIChkYXRhKSA9PiB7XG4gICAgICAgICAgcGFydENvcHlSZXN1bHQgPSBkYXRhXG4gICAgICAgIH0pXG4gICAgICAgIC5vbignZXJyb3InLCBjYilcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XG4gICAgICAgICAgbGV0IHVwbG9hZFBhcnRDb3B5UmVzID0ge1xuICAgICAgICAgICAgZXRhZzogc2FuaXRpemVFVGFnKHBhcnRDb3B5UmVzdWx0LkVUYWcpLFxuICAgICAgICAgICAga2V5OiBvYmplY3ROYW1lLFxuICAgICAgICAgICAgcGFydDogcGFydE51bWJlcixcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYihudWxsLCB1cGxvYWRQYXJ0Q29weVJlcylcbiAgICAgICAgfSlcbiAgICB9KVxuICB9XG5cbiAgY29tcG9zZU9iamVjdChkZXN0T2JqQ29uZmlnID0ge30sIHNvdXJjZU9iakxpc3QgPSBbXSwgY2IpIHtcbiAgICBjb25zdCBtZSA9IHRoaXMgLy8gbWFueSBhc3luYyBmbG93cy4gc28gc3RvcmUgdGhlIHJlZi5cbiAgICBjb25zdCBzb3VyY2VGaWxlc0xlbmd0aCA9IHNvdXJjZU9iakxpc3QubGVuZ3RoXG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoc291cmNlT2JqTGlzdCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3NvdXJjZUNvbmZpZyBzaG91bGQgYW4gYXJyYXkgb2YgQ29weVNvdXJjZU9wdGlvbnMgJylcbiAgICB9XG4gICAgaWYgKCEoZGVzdE9iakNvbmZpZyBpbnN0YW5jZW9mIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdkZXN0Q29uZmlnIHNob3VsZCBvZiB0eXBlIENvcHlEZXN0aW5hdGlvbk9wdGlvbnMgJylcbiAgICB9XG5cbiAgICBpZiAoc291cmNlRmlsZXNMZW5ndGggPCAxIHx8IHNvdXJjZUZpbGVzTGVuZ3RoID4gUEFSVF9DT05TVFJBSU5UUy5NQVhfUEFSVFNfQ09VTlQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgIGBcIlRoZXJlIG11c3QgYmUgYXMgbGVhc3Qgb25lIGFuZCB1cCB0byAke1BBUlRfQ09OU1RSQUlOVFMuTUFYX1BBUlRTX0NPVU5UfSBzb3VyY2Ugb2JqZWN0cy5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIGlmICghaXNGdW5jdGlvbihjYikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2NhbGxiYWNrIHNob3VsZCBiZSBvZiB0eXBlIFwiZnVuY3Rpb25cIicpXG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VGaWxlc0xlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoIXNvdXJjZU9iakxpc3RbaV0udmFsaWRhdGUoKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIWRlc3RPYmpDb25maWcudmFsaWRhdGUoKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgY29uc3QgZ2V0U3RhdE9wdGlvbnMgPSAoc3JjQ29uZmlnKSA9PiB7XG4gICAgICBsZXQgc3RhdE9wdHMgPSB7fVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc3JjQ29uZmlnLlZlcnNpb25JRCkpIHtcbiAgICAgICAgc3RhdE9wdHMgPSB7XG4gICAgICAgICAgdmVyc2lvbklkOiBzcmNDb25maWcuVmVyc2lvbklELFxuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gc3RhdE9wdHNcbiAgICB9XG4gICAgY29uc3Qgc3JjT2JqZWN0U2l6ZXMgPSBbXVxuICAgIGxldCB0b3RhbFNpemUgPSAwXG4gICAgbGV0IHRvdGFsUGFydHMgPSAwXG5cbiAgICBjb25zdCBzb3VyY2VPYmpTdGF0cyA9IHNvdXJjZU9iakxpc3QubWFwKChzcmNJdGVtKSA9PlxuICAgICAgbWUuc3RhdE9iamVjdChzcmNJdGVtLkJ1Y2tldCwgc3JjSXRlbS5PYmplY3QsIGdldFN0YXRPcHRpb25zKHNyY0l0ZW0pKSxcbiAgICApXG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoc291cmNlT2JqU3RhdHMpXG4gICAgICAudGhlbigoc3JjT2JqZWN0SW5mb3MpID0+IHtcbiAgICAgICAgY29uc3QgdmFsaWRhdGVkU3RhdHMgPSBzcmNPYmplY3RJbmZvcy5tYXAoKHJlc0l0ZW1TdGF0LCBpbmRleCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHNyY0NvbmZpZyA9IHNvdXJjZU9iakxpc3RbaW5kZXhdXG5cbiAgICAgICAgICBsZXQgc3JjQ29weVNpemUgPSByZXNJdGVtU3RhdC5zaXplXG4gICAgICAgICAgLy8gQ2hlY2sgaWYgYSBzZWdtZW50IGlzIHNwZWNpZmllZCwgYW5kIGlmIHNvLCBpcyB0aGVcbiAgICAgICAgICAvLyBzZWdtZW50IHdpdGhpbiBvYmplY3QgYm91bmRzP1xuICAgICAgICAgIGlmIChzcmNDb25maWcuTWF0Y2hSYW5nZSkge1xuICAgICAgICAgICAgLy8gU2luY2UgcmFuZ2UgaXMgc3BlY2lmaWVkLFxuICAgICAgICAgICAgLy8gICAgMCA8PSBzcmMuc3JjU3RhcnQgPD0gc3JjLnNyY0VuZFxuICAgICAgICAgICAgLy8gc28gb25seSBpbnZhbGlkIGNhc2UgdG8gY2hlY2sgaXM6XG4gICAgICAgICAgICBjb25zdCBzcmNTdGFydCA9IHNyY0NvbmZpZy5TdGFydFxuICAgICAgICAgICAgY29uc3Qgc3JjRW5kID0gc3JjQ29uZmlnLkVuZFxuICAgICAgICAgICAgaWYgKHNyY0VuZCA+PSBzcmNDb3B5U2l6ZSB8fCBzcmNTdGFydCA8IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgICAgICAgICBgQ29weVNyY09wdGlvbnMgJHtpbmRleH0gaGFzIGludmFsaWQgc2VnbWVudC10by1jb3B5IFske3NyY1N0YXJ0fSwgJHtzcmNFbmR9XSAoc2l6ZSBpcyAke3NyY0NvcHlTaXplfSlgLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBzcmNDb3B5U2l6ZSA9IHNyY0VuZCAtIHNyY1N0YXJ0ICsgMVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIE9ubHkgdGhlIGxhc3Qgc291cmNlIG1heSBiZSBsZXNzIHRoYW4gYGFic01pblBhcnRTaXplYFxuICAgICAgICAgIGlmIChzcmNDb3B5U2l6ZSA8IFBBUlRfQ09OU1RSQUlOVFMuQUJTX01JTl9QQVJUX1NJWkUgJiYgaW5kZXggPCBzb3VyY2VGaWxlc0xlbmd0aCAtIDEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgICAgICAgIGBDb3B5U3JjT3B0aW9ucyAke2luZGV4fSBpcyB0b28gc21hbGwgKCR7c3JjQ29weVNpemV9KSBhbmQgaXQgaXMgbm90IHRoZSBsYXN0IHBhcnQuYCxcbiAgICAgICAgICAgIClcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBJcyBkYXRhIHRvIGNvcHkgdG9vIGxhcmdlP1xuICAgICAgICAgIHRvdGFsU2l6ZSArPSBzcmNDb3B5U2l6ZVxuICAgICAgICAgIGlmICh0b3RhbFNpemUgPiBQQVJUX0NPTlNUUkFJTlRTLk1BWF9NVUxUSVBBUlRfUFVUX09CSkVDVF9TSVpFKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBDYW5ub3QgY29tcG9zZSBhbiBvYmplY3Qgb2Ygc2l6ZSAke3RvdGFsU2l6ZX0gKD4gNVRpQilgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIHJlY29yZCBzb3VyY2Ugc2l6ZVxuICAgICAgICAgIHNyY09iamVjdFNpemVzW2luZGV4XSA9IHNyY0NvcHlTaXplXG5cbiAgICAgICAgICAvLyBjYWxjdWxhdGUgcGFydHMgbmVlZGVkIGZvciBjdXJyZW50IHNvdXJjZVxuICAgICAgICAgIHRvdGFsUGFydHMgKz0gcGFydHNSZXF1aXJlZChzcmNDb3B5U2l6ZSlcbiAgICAgICAgICAvLyBEbyB3ZSBuZWVkIG1vcmUgcGFydHMgdGhhbiB3ZSBhcmUgYWxsb3dlZD9cbiAgICAgICAgICBpZiAodG90YWxQYXJ0cyA+IFBBUlRfQ09OU1RSQUlOVFMuTUFYX1BBUlRTX0NPVU5UKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKFxuICAgICAgICAgICAgICBgWW91ciBwcm9wb3NlZCBjb21wb3NlIG9iamVjdCByZXF1aXJlcyBtb3JlIHRoYW4gJHtQQVJUX0NPTlNUUkFJTlRTLk1BWF9QQVJUU19DT1VOVH0gcGFydHNgLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiByZXNJdGVtU3RhdFxuICAgICAgICB9KVxuXG4gICAgICAgIGlmICgodG90YWxQYXJ0cyA9PT0gMSAmJiB0b3RhbFNpemUgPD0gUEFSVF9DT05TVFJBSU5UUy5NQVhfUEFSVF9TSVpFKSB8fCB0b3RhbFNpemUgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5jb3B5T2JqZWN0KHNvdXJjZU9iakxpc3RbMF0sIGRlc3RPYmpDb25maWcsIGNiKSAvLyB1c2UgY29weU9iamVjdFYyXG4gICAgICAgIH1cblxuICAgICAgICAvLyBwcmVzZXJ2ZSBldGFnIHRvIGF2b2lkIG1vZGlmaWNhdGlvbiBvZiBvYmplY3Qgd2hpbGUgY29weWluZy5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzb3VyY2VGaWxlc0xlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgc291cmNlT2JqTGlzdFtpXS5NYXRjaEVUYWcgPSB2YWxpZGF0ZWRTdGF0c1tpXS5ldGFnXG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBzcGxpdFBhcnRTaXplTGlzdCA9IHZhbGlkYXRlZFN0YXRzLm1hcCgocmVzSXRlbVN0YXQsIGlkeCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGNhbFNpemUgPSBjYWxjdWxhdGVFdmVuU3BsaXRzKHNyY09iamVjdFNpemVzW2lkeF0sIHNvdXJjZU9iakxpc3RbaWR4XSlcbiAgICAgICAgICByZXR1cm4gY2FsU2l6ZVxuICAgICAgICB9KVxuXG4gICAgICAgIGZ1bmN0aW9uIGdldFVwbG9hZFBhcnRDb25maWdMaXN0KHVwbG9hZElkKSB7XG4gICAgICAgICAgY29uc3QgdXBsb2FkUGFydENvbmZpZ0xpc3QgPSBbXVxuXG4gICAgICAgICAgc3BsaXRQYXJ0U2l6ZUxpc3QuZm9yRWFjaCgoc3BsaXRTaXplLCBzcGxpdEluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB7IHN0YXJ0SW5kZXg6IHN0YXJ0SWR4LCBlbmRJbmRleDogZW5kSWR4LCBvYmpJbmZvOiBvYmpDb25maWcgfSA9IHNwbGl0U2l6ZVxuXG4gICAgICAgICAgICBsZXQgcGFydEluZGV4ID0gc3BsaXRJbmRleCArIDEgLy8gcGFydCBpbmRleCBzdGFydHMgZnJvbSAxLlxuICAgICAgICAgICAgY29uc3QgdG90YWxVcGxvYWRzID0gQXJyYXkuZnJvbShzdGFydElkeClcblxuICAgICAgICAgICAgY29uc3QgaGVhZGVycyA9IHNvdXJjZU9iakxpc3Rbc3BsaXRJbmRleF0uZ2V0SGVhZGVycygpXG5cbiAgICAgICAgICAgIHRvdGFsVXBsb2Fkcy5mb3JFYWNoKChzcGxpdFN0YXJ0LCB1cGxkQ3RySWR4KSA9PiB7XG4gICAgICAgICAgICAgIGxldCBzcGxpdEVuZCA9IGVuZElkeFt1cGxkQ3RySWR4XVxuXG4gICAgICAgICAgICAgIGNvbnN0IHNvdXJjZU9iaiA9IGAke29iakNvbmZpZy5CdWNrZXR9LyR7b2JqQ29uZmlnLk9iamVjdH1gXG4gICAgICAgICAgICAgIGhlYWRlcnNbJ3gtYW16LWNvcHktc291cmNlJ10gPSBgJHtzb3VyY2VPYmp9YFxuICAgICAgICAgICAgICBoZWFkZXJzWyd4LWFtei1jb3B5LXNvdXJjZS1yYW5nZSddID0gYGJ5dGVzPSR7c3BsaXRTdGFydH0tJHtzcGxpdEVuZH1gXG5cbiAgICAgICAgICAgICAgY29uc3QgdXBsb2FkUGFydENvbmZpZyA9IHtcbiAgICAgICAgICAgICAgICBidWNrZXROYW1lOiBkZXN0T2JqQ29uZmlnLkJ1Y2tldCxcbiAgICAgICAgICAgICAgICBvYmplY3ROYW1lOiBkZXN0T2JqQ29uZmlnLk9iamVjdCxcbiAgICAgICAgICAgICAgICB1cGxvYWRJRDogdXBsb2FkSWQsXG4gICAgICAgICAgICAgICAgcGFydE51bWJlcjogcGFydEluZGV4LFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IGhlYWRlcnMsXG4gICAgICAgICAgICAgICAgc291cmNlT2JqOiBzb3VyY2VPYmosXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB1cGxvYWRQYXJ0Q29uZmlnTGlzdC5wdXNoKHVwbG9hZFBhcnRDb25maWcpXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICByZXR1cm4gdXBsb2FkUGFydENvbmZpZ0xpc3RcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBlcmZvcm1VcGxvYWRQYXJ0cyA9ICh1cGxvYWRJZCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHVwbG9hZExpc3QgPSBnZXRVcGxvYWRQYXJ0Q29uZmlnTGlzdCh1cGxvYWRJZClcblxuICAgICAgICAgIGFzeW5jLm1hcCh1cGxvYWRMaXN0LCBtZS51cGxvYWRQYXJ0Q29weS5iaW5kKG1lKSwgKGVyciwgcmVzKSA9PiB7XG4gICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgIHRoaXMuYWJvcnRNdWx0aXBhcnRVcGxvYWQoZGVzdE9iakNvbmZpZy5CdWNrZXQsIGRlc3RPYmpDb25maWcuT2JqZWN0LCB1cGxvYWRJZCkudGhlbihcbiAgICAgICAgICAgICAgICAoKSA9PiBjYigpLFxuICAgICAgICAgICAgICAgIChlcnIpID0+IGNiKGVyciksXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgcmV0dXJuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCBwYXJ0c0RvbmUgPSByZXMubWFwKChwYXJ0Q29weSkgPT4gKHsgZXRhZzogcGFydENvcHkuZXRhZywgcGFydDogcGFydENvcHkucGFydCB9KSlcbiAgICAgICAgICAgIHJldHVybiBtZS5jb21wbGV0ZU11bHRpcGFydFVwbG9hZChkZXN0T2JqQ29uZmlnLkJ1Y2tldCwgZGVzdE9iakNvbmZpZy5PYmplY3QsIHVwbG9hZElkLCBwYXJ0c0RvbmUpLnRoZW4oXG4gICAgICAgICAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAgICAgICAgIChlcnIpID0+IGNiKGVyciksXG4gICAgICAgICAgICApXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG5ld1VwbG9hZEhlYWRlcnMgPSBkZXN0T2JqQ29uZmlnLmdldEhlYWRlcnMoKVxuXG4gICAgICAgIG1lLmluaXRpYXRlTmV3TXVsdGlwYXJ0VXBsb2FkKGRlc3RPYmpDb25maWcuQnVja2V0LCBkZXN0T2JqQ29uZmlnLk9iamVjdCwgbmV3VXBsb2FkSGVhZGVycykudGhlbihcbiAgICAgICAgICAodXBsb2FkSWQpID0+IHtcbiAgICAgICAgICAgIHBlcmZvcm1VcGxvYWRQYXJ0cyh1cGxvYWRJZClcbiAgICAgICAgICB9LFxuICAgICAgICAgIChlcnIpID0+IHtcbiAgICAgICAgICAgIGNiKGVyciwgbnVsbClcbiAgICAgICAgICB9LFxuICAgICAgICApXG4gICAgICB9KVxuICAgICAgLmNhdGNoKChlcnJvcikgPT4ge1xuICAgICAgICBjYihlcnJvciwgbnVsbClcbiAgICAgIH0pXG4gIH1cbn1cblxuLy8gUHJvbWlzaWZ5IHZhcmlvdXMgcHVibGljLWZhY2luZyBBUElzIG9uIHRoZSBDbGllbnQgbW9kdWxlLlxuQ2xpZW50LnByb3RvdHlwZS5jb3B5T2JqZWN0ID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUuY29weU9iamVjdClcbkNsaWVudC5wcm90b3R5cGUucmVtb3ZlT2JqZWN0cyA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnJlbW92ZU9iamVjdHMpXG5cbkNsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkVXJsID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkVXJsKVxuQ2xpZW50LnByb3RvdHlwZS5wcmVzaWduZWRHZXRPYmplY3QgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5wcmVzaWduZWRHZXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFB1dE9iamVjdCA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFB1dE9iamVjdClcbkNsaWVudC5wcm90b3R5cGUucHJlc2lnbmVkUG9zdFBvbGljeSA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLnByZXNpZ25lZFBvc3RQb2xpY3kpXG5DbGllbnQucHJvdG90eXBlLmdldEJ1Y2tldE5vdGlmaWNhdGlvbiA9IHByb21pc2lmeShDbGllbnQucHJvdG90eXBlLmdldEJ1Y2tldE5vdGlmaWNhdGlvbilcbkNsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0Tm90aWZpY2F0aW9uID0gcHJvbWlzaWZ5KENsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0Tm90aWZpY2F0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVBbGxCdWNrZXROb3RpZmljYXRpb24gPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVBbGxCdWNrZXROb3RpZmljYXRpb24pXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUluY29tcGxldGVVcGxvYWQgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVJbmNvbXBsZXRlVXBsb2FkKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RSZXRlbnRpb24gPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RSZXRlbnRpb24pXG5DbGllbnQucHJvdG90eXBlLmNvbXBvc2VPYmplY3QgPSBwcm9taXNpZnkoQ2xpZW50LnByb3RvdHlwZS5jb21wb3NlT2JqZWN0KVxuXG4vLyByZWZhY3RvcmVkIEFQSSB1c2UgcHJvbWlzZSBpbnRlcm5hbGx5XG5DbGllbnQucHJvdG90eXBlLm1ha2VCdWNrZXQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLm1ha2VCdWNrZXQpXG5DbGllbnQucHJvdG90eXBlLmJ1Y2tldEV4aXN0cyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuYnVja2V0RXhpc3RzKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldClcbkNsaWVudC5wcm90b3R5cGUubGlzdEJ1Y2tldHMgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLmxpc3RCdWNrZXRzKVxuXG5DbGllbnQucHJvdG90eXBlLmdldE9iamVjdCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5mR2V0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5mR2V0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5nZXRQYXJ0aWFsT2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRQYXJ0aWFsT2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5zdGF0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zdGF0T2JqZWN0KVxuQ2xpZW50LnByb3RvdHlwZS5wdXRPYmplY3RSZXRlbnRpb24gPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnB1dE9iamVjdFJldGVudGlvbilcbkNsaWVudC5wcm90b3R5cGUucHV0T2JqZWN0ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5wdXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLmZQdXRPYmplY3QgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLmZQdXRPYmplY3QpXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZU9iamVjdCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUucmVtb3ZlT2JqZWN0KVxuXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRSZXBsaWNhdGlvbilcbkNsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0UmVwbGljYXRpb24gPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldFJlcGxpY2F0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRSZXBsaWNhdGlvbiA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0UmVwbGljYXRpb24pXG5DbGllbnQucHJvdG90eXBlLmdldE9iamVjdExlZ2FsSG9sZCA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TGVnYWxIb2xkKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RMZWdhbEhvbGQgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldE9iamVjdExlZ2FsSG9sZClcbkNsaWVudC5wcm90b3R5cGUuc2V0T2JqZWN0TG9ja0NvbmZpZyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuc2V0T2JqZWN0TG9ja0NvbmZpZylcbkNsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TG9ja0NvbmZpZyA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuZ2V0T2JqZWN0TG9ja0NvbmZpZylcbkNsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0UG9saWN5ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRQb2xpY3kpXG5DbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldFBvbGljeSA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUuc2V0QnVja2V0UG9saWN5KVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVPYmplY3RUYWdnaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVPYmplY3RUYWdnaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRWZXJzaW9uaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRWZXJzaW9uaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRWZXJzaW9uaW5nID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRWZXJzaW9uaW5nKVxuQ2xpZW50LnByb3RvdHlwZS5zZWxlY3RPYmplY3RDb250ZW50ID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZWxlY3RPYmplY3RDb250ZW50KVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRMaWZlY3ljbGUgPSBjYWxsYmFja2lmeShDbGllbnQucHJvdG90eXBlLnNldEJ1Y2tldExpZmVjeWNsZSlcbkNsaWVudC5wcm90b3R5cGUuZ2V0QnVja2V0TGlmZWN5Y2xlID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRMaWZlY3ljbGUpXG5DbGllbnQucHJvdG90eXBlLnJlbW92ZUJ1Y2tldExpZmVjeWNsZSA9IGNhbGxiYWNraWZ5KENsaWVudC5wcm90b3R5cGUucmVtb3ZlQnVja2V0TGlmZWN5Y2xlKVxuQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5zZXRCdWNrZXRFbmNyeXB0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5nZXRCdWNrZXRFbmNyeXB0aW9uKVxuQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRFbmNyeXB0aW9uID0gY2FsbGJhY2tpZnkoQ2xpZW50LnByb3RvdHlwZS5yZW1vdmVCdWNrZXRFbmNyeXB0aW9uKVxuIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsT0FBTyxLQUFLQSxNQUFNO0FBRWxCLE9BQU9DLEtBQUssTUFBTSxPQUFPO0FBQ3pCLE9BQU9DLENBQUMsTUFBTSxRQUFRO0FBQ3RCLE9BQU8sS0FBS0MsV0FBVyxNQUFNLGNBQWM7QUFDM0MsU0FBU0MsV0FBVyxRQUFRLGNBQWM7QUFDMUMsT0FBT0MsTUFBTSxNQUFNLFFBQVE7QUFFM0IsT0FBTyxLQUFLQyxNQUFNLE1BQU0sY0FBYTtBQUNyQyxTQUFTQyxzQkFBc0IsRUFBRUMsaUJBQWlCLFFBQVEsZUFBYztBQUN4RSxTQUFTQyxXQUFXLFFBQVEsNEJBQTJCO0FBQ3ZELFNBQVNDLFdBQVcsUUFBUSx1QkFBc0I7QUFDbEQsU0FBU0MsY0FBYyxRQUFRLGdDQUErQjtBQUM5RCxTQUNFQyxtQkFBbUIsRUFDbkJDLGVBQWUsRUFDZkMsUUFBUSxFQUNSQyxrQkFBa0IsRUFDbEJDLFlBQVksRUFDWkMsU0FBUyxFQUNUQyxVQUFVLEVBQ1ZDLFFBQVEsRUFDUkMsUUFBUSxFQUNSQyxRQUFRLEVBQ1JDLGlCQUFpQixFQUNqQkMsV0FBVyxFQUNYQyxpQkFBaUIsRUFDakJDLGFBQWEsRUFDYkMsWUFBWSxFQUNaQyxnQkFBZ0IsRUFDaEJDLGFBQWEsRUFDYkMsU0FBUyxFQUNUQyxZQUFZLEVBQ1pDLEtBQUssRUFDTEMsU0FBUyxFQUNUQyxpQkFBaUIsUUFDWix1QkFBc0I7QUFDN0IsU0FBU0MsVUFBVSxRQUFRLDRCQUEyQjtBQUN0RCxTQUFTQyxrQkFBa0IsRUFB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