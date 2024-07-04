import * as crypto from "crypto";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as stream from "stream";
import * as async from 'async';
import BlockStream2 from 'block-stream2';
import { isBrowser } from 'browser-or-node';
import _ from 'lodash';
import * as qs from 'query-string';
import xml2js from 'xml2js';
import { CredentialProvider } from "../CredentialProvider.mjs";
import * as errors from "../errors.mjs";
import { DEFAULT_REGION, LEGAL_HOLD_STATUS, RETENTION_MODES, RETENTION_VALIDITY_UNITS } from "../helpers.mjs";
import { signV4 } from "../signing.mjs";
import { fsp, streamPromise } from "./async.mjs";
import { Extensions } from "./extensions.mjs";
import { extractMetadata, getContentLength, getVersionId, hashBinary, insertContentType, isAmazonEndpoint, isBoolean, isDefined, isEmpty, isNumber, isObject, isReadableStream, isString, isValidBucketName, isValidEndpoint, isValidObjectName, isValidPort, isValidPrefix, isVirtualHostStyle, makeDateLong, prependXAMZMeta, readableStream, sanitizeETag, toMd5, toSha256, uriEscape, uriResourceEscape } from "./helper.mjs";
import { joinHostPort } from "./join-host-port.mjs";
import { request } from "./request.mjs";
import { drainResponse, readAsBuffer, readAsString } from "./response.mjs";
import { getS3Endpoint } from "./s3-endpoints.mjs";
import { parseCompleteMultipart, parseInitiateMultipart, parseObjectLegalHoldConfig, parseSelectObjectContentResponse } from "./xml-parser.mjs";
import * as xmlParsers from "./xml-parser.mjs";
const xml = new xml2js.Builder({
  renderOpts: {
    pretty: false
  },
  headless: true
});

// will be replaced by bundler.
const Package = {
  version: "7.1.4" || 'development'
};
const requestOptionProperties = ['agent', 'ca', 'cert', 'ciphers', 'clientCertEngine', 'crl', 'dhparam', 'ecdhCurve', 'family', 'honorCipherOrder', 'key', 'passphrase', 'pfx', 'rejectUnauthorized', 'secureOptions', 'secureProtocol', 'servername', 'sessionIdContext'];
export class TypedClient {
  partSize = 64 * 1024 * 1024;
  maximumPartSize = 5 * 1024 * 1024 * 1024;
  maxObjectSize = 5 * 1024 * 1024 * 1024 * 1024;
  constructor(params) {
    // @ts-expect-error deprecated property
    if (params.secure !== undefined) {
      throw new Error('"secure" option deprecated, "useSSL" should be used instead');
    }
    // Default values if not specified.
    if (params.useSSL === undefined) {
      params.useSSL = true;
    }
    if (!params.port) {
      params.port = 0;
    }
    // Validate input params.
    if (!isValidEndpoint(params.endPoint)) {
      throw new errors.InvalidEndpointError(`Invalid endPoint : ${params.endPoint}`);
    }
    if (!isValidPort(params.port)) {
      throw new errors.InvalidArgumentError(`Invalid port : ${params.port}`);
    }
    if (!isBoolean(params.useSSL)) {
      throw new errors.InvalidArgumentError(`Invalid useSSL flag type : ${params.useSSL}, expected to be of type "boolean"`);
    }

    // Validate region only if its set.
    if (params.region) {
      if (!isString(params.region)) {
        throw new errors.InvalidArgumentError(`Invalid region : ${params.region}`);
      }
    }
    const host = params.endPoint.toLowerCase();
    let port = params.port;
    let protocol;
    let transport;
    let transportAgent;
    // Validate if configuration is not using SSL
    // for constructing relevant endpoints.
    if (params.useSSL) {
      // Defaults to secure.
      transport = https;
      protocol = 'https:';
      port = port || 443;
      transportAgent = https.globalAgent;
    } else {
      transport = http;
      protocol = 'http:';
      port = port || 80;
      transportAgent = http.globalAgent;
    }

    // if custom transport is set, use it.
    if (params.transport) {
      if (!isObject(params.transport)) {
        throw new errors.InvalidArgumentError(`Invalid transport type : ${params.transport}, expected to be type "object"`);
      }
      transport = params.transport;
    }

    // if custom transport agent is set, use it.
    if (params.transportAgent) {
      if (!isObject(params.transportAgent)) {
        throw new errors.InvalidArgumentError(`Invalid transportAgent type: ${params.transportAgent}, expected to be type "object"`);
      }
      transportAgent = params.transportAgent;
    }

    // User Agent should always following the below style.
    // Please open an issue to discuss any new changes here.
    //
    //       MinIO (OS; ARCH) LIB/VER APP/VER
    //
    const libraryComments = `(${process.platform}; ${process.arch})`;
    const libraryAgent = `MinIO ${libraryComments} minio-js/${Package.version}`;
    // User agent block ends.

    this.transport = transport;
    this.transportAgent = transportAgent;
    this.host = host;
    this.port = port;
    this.protocol = protocol;
    this.userAgent = `${libraryAgent}`;

    // Default path style is true
    if (params.pathStyle === undefined) {
      this.pathStyle = true;
    } else {
      this.pathStyle = params.pathStyle;
    }
    this.accessKey = params.accessKey ?? '';
    this.secretKey = params.secretKey ?? '';
    this.sessionToken = params.sessionToken;
    this.anonymous = !this.accessKey || !this.secretKey;
    if (params.credentialsProvider) {
      this.credentialsProvider = params.credentialsProvider;
    }
    this.regionMap = {};
    if (params.region) {
      this.region = params.region;
    }
    if (params.partSize) {
      this.partSize = params.partSize;
      this.overRidePartSize = true;
    }
    if (this.partSize < 5 * 1024 * 1024) {
      throw new errors.InvalidArgumentError(`Part size should be greater than 5MB`);
    }
    if (this.partSize > 5 * 1024 * 1024 * 1024) {
      throw new errors.InvalidArgumentError(`Part size should be less than 5GB`);
    }

    // SHA256 is enabled only for authenticated http requests. If the request is authenticated
    // and the connection is https we use x-amz-content-sha256=UNSIGNED-PAYLOAD
    // header for signature calculation.
    this.enableSHA256 = !this.anonymous && !params.useSSL;
    this.s3AccelerateEndpoint = params.s3AccelerateEndpoint || undefined;
    this.reqOptions = {};
    this.clientExtensions = new Extensions(this);
  }

  /**
   * Minio extensions that aren't necessary present for Amazon S3 compatible storage servers
   */
  get extensions() {
    return this.clientExtensions;
  }

  /**
   * @param endPoint - valid S3 acceleration end point
   */
  setS3TransferAccelerate(endPoint) {
    this.s3AccelerateEndpoint = endPoint;
  }

  /**
   * Sets the supported request options.
   */
  setRequestOptions(options) {
    if (!isObject(options)) {
      throw new TypeError('request options should be of type "object"');
    }
    this.reqOptions = _.pick(options, requestOptionProperties);
  }

  /**
   *  This is s3 Specific and does not hold validity in any other Object storage.
   */
  getAccelerateEndPointIfSet(bucketName, objectName) {
    if (!isEmpty(this.s3AccelerateEndpoint) && !isEmpty(bucketName) && !isEmpty(objectName)) {
      // http://docs.aws.amazon.com/AmazonS3/latest/dev/transfer-acceleration.html
      // Disable transfer acceleration for non-compliant bucket names.
      if (bucketName.includes('.')) {
        throw new Error(`Transfer Acceleration is not supported for non compliant bucket:${bucketName}`);
      }
      // If transfer acceleration is requested set new host.
      // For more details about enabling transfer acceleration read here.
      // http://docs.aws.amazon.com/AmazonS3/latest/dev/transfer-acceleration.html
      return this.s3AccelerateEndpoint;
    }
    return false;
  }

  /**
   * returns options object that can be used with http.request()
   * Takes care of constructing virtual-host-style or path-style hostname
   */
  getRequestOptions(opts) {
    const method = opts.method;
    const region = opts.region;
    const bucketName = opts.bucketName;
    let objectName = opts.objectName;
    const headers = opts.headers;
    const query = opts.query;
    let reqOptions = {
      method,
      headers: {},
      protocol: this.protocol,
      // If custom transportAgent was supplied earlier, we'll inject it here
      agent: this.transportAgent
    };

    // Verify if virtual host supported.
    let virtualHostStyle;
    if (bucketName) {
      virtualHostStyle = isVirtualHostStyle(this.host, this.protocol, bucketName, this.pathStyle);
    }
    let path = '/';
    let host = this.host;
    let port;
    if (this.port) {
      port = this.port;
    }
    if (objectName) {
      objectName = uriResourceEscape(objectName);
    }

    // For Amazon S3 endpoint, get endpoint based on region.
    if (isAmazonEndpoint(host)) {
      const accelerateEndPoint = this.getAccelerateEndPointIfSet(bucketName, objectName);
      if (accelerateEndPoint) {
        host = `${accelerateEndPoint}`;
      } else {
        host = getS3Endpoint(region);
      }
    }
    if (virtualHostStyle && !opts.pathStyle) {
      // For all hosts which support virtual host style, `bucketName`
      // is part of the hostname in the following format:
      //
      //  var host = 'bucketName.example.com'
      //
      if (bucketName) {
        host = `${bucketName}.${host}`;
      }
      if (objectName) {
        path = `/${objectName}`;
      }
    } else {
      // For all S3 compatible storage services we will fallback to
      // path style requests, where `bucketName` is part of the URI
      // path.
      if (bucketName) {
        path = `/${bucketName}`;
      }
      if (objectName) {
        path = `/${bucketName}/${objectName}`;
      }
    }
    if (query) {
      path += `?${query}`;
    }
    reqOptions.headers.host = host;
    if (reqOptions.protocol === 'http:' && port !== 80 || reqOptions.protocol === 'https:' && port !== 443) {
      reqOptions.headers.host = joinHostPort(host, port);
    }
    reqOptions.headers['user-agent'] = this.userAgent;
    if (headers) {
      // have all header keys in lower case - to make signing easy
      for (const [k, v] of Object.entries(headers)) {
        reqOptions.headers[k.toLowerCase()] = v;
      }
    }

    // Use any request option specified in minioClient.setRequestOptions()
    reqOptions = Object.assign({}, this.reqOptions, reqOptions);
    return {
      ...reqOptions,
      headers: _.mapValues(_.pickBy(reqOptions.headers, isDefined), v => v.toString()),
      host,
      port,
      path
    };
  }
  async setCredentialsProvider(credentialsProvider) {
    if (!(credentialsProvider instanceof CredentialProvider)) {
      throw new Error('Unable to get credentials. Expected instance of CredentialProvider');
    }
    this.credentialsProvider = credentialsProvider;
    await this.checkAndRefreshCreds();
  }
  async checkAndRefreshCreds() {
    if (this.credentialsProvider) {
      try {
        const credentialsConf = await this.credentialsProvider.getCredentials();
        this.accessKey = credentialsConf.getAccessKey();
        this.secretKey = credentialsConf.getSecretKey();
        this.sessionToken = credentialsConf.getSessionToken();
      } catch (e) {
        throw new Error(`Unable to get credentials: ${e}`, {
          cause: e
        });
      }
    }
  }
  /**
   * log the request, response, error
   */
  logHTTP(reqOptions, response, err) {
    // if no logStream available return.
    if (!this.logStream) {
      return;
    }
    if (!isObject(reqOptions)) {
      throw new TypeError('reqOptions should be of type "object"');
    }
    if (response && !isReadableStream(response)) {
      throw new TypeError('response should be of type "Stream"');
    }
    if (err && !(err instanceof Error)) {
      throw new TypeError('err should be of type "Error"');
    }
    const logStream = this.logStream;
    const logHeaders = headers => {
      Object.entries(headers).forEach(([k, v]) => {
        if (k == 'authorization') {
          if (isString(v)) {
            const redactor = new RegExp('Signature=([0-9a-f]+)');
            v = v.replace(redactor, 'Signature=**REDACTED**');
          }
        }
        logStream.write(`${k}: ${v}\n`);
      });
      logStream.write('\n');
    };
    logStream.write(`REQUEST: ${reqOptions.method} ${reqOptions.path}\n`);
    logHeaders(reqOptions.headers);
    if (response) {
      this.logStream.write(`RESPONSE: ${response.statusCode}\n`);
      logHeaders(response.headers);
    }
    if (err) {
      logStream.write('ERROR BODY:\n');
      const errJSON = JSON.stringify(err, null, '\t');
      logStream.write(`${errJSON}\n`);
    }
  }

  /**
   * Enable tracing
   */
  traceOn(stream) {
    if (!stream) {
      stream = process.stdout;
    }
    this.logStream = stream;
  }

  /**
   * Disable tracing
   */
  traceOff() {
    this.logStream = undefined;
  }

  /**
   * makeRequest is the primitive used by the apis for making S3 requests.
   * payload can be empty string in case of no payload.
   * statusCode is the expected statusCode. If response.statusCode does not match
   * we parse the XML error and call the callback with the error message.
   *
   * A valid region is passed by the calls - listBuckets, makeBucket and getBucketRegion.
   *
   * @internal
   */
  async makeRequestAsync(options, payload = '', expectedCodes = [200], region = '') {
    if (!isObject(options)) {
      throw new TypeError('options should be of type "object"');
    }
    if (!isString(payload) && !isObject(payload)) {
      // Buffer is of type 'object'
      throw new TypeError('payload should be of type "string" or "Buffer"');
    }
    expectedCodes.forEach(statusCode => {
      if (!isNumber(statusCode)) {
        throw new TypeError('statusCode should be of type "number"');
      }
    });
    if (!isString(region)) {
      throw new TypeError('region should be of type "string"');
    }
    if (!options.headers) {
      options.headers = {};
    }
    if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      options.headers['content-length'] = payload.length.toString();
    }
    const sha256sum = this.enableSHA256 ? toSha256(payload) : '';
    return this.makeRequestStreamAsync(options, payload, sha256sum, expectedCodes, region);
  }

  /**
   * new request with promise
   *
   * No need to drain response, response body is not valid
   */
  async makeRequestAsyncOmit(options, payload = '', statusCodes = [200], region = '') {
    const res = await this.makeRequestAsync(options, payload, statusCodes, region);
    await drainResponse(res);
    return res;
  }

  /**
   * makeRequestStream will be used directly instead of makeRequest in case the payload
   * is available as a stream. for ex. putObject
   *
   * @internal
   */
  async makeRequestStreamAsync(options, body, sha256sum, statusCodes, region) {
    if (!isObject(options)) {
      throw new TypeError('options should be of type "object"');
    }
    if (!(Buffer.isBuffer(body) || typeof body === 'string' || isReadableStream(body))) {
      throw new errors.InvalidArgumentError(`stream should be a Buffer, string or readable Stream, got ${typeof body} instead`);
    }
    if (!isString(sha256sum)) {
      throw new TypeError('sha256sum should be of type "string"');
    }
    statusCodes.forEach(statusCode => {
      if (!isNumber(statusCode)) {
        throw new TypeError('statusCode should be of type "number"');
      }
    });
    if (!isString(region)) {
      throw new TypeError('region should be of type "string"');
    }
    // sha256sum will be empty for anonymous or https requests
    if (!this.enableSHA256 && sha256sum.length !== 0) {
      throw new errors.InvalidArgumentError(`sha256sum expected to be empty for anonymous or https requests`);
    }
    // sha256sum should be valid for non-anonymous http requests.
    if (this.enableSHA256 && sha256sum.length !== 64) {
      throw new errors.InvalidArgumentError(`Invalid sha256sum : ${sha256sum}`);
    }
    await this.checkAndRefreshCreds();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    region = region || (await this.getBucketRegionAsync(options.bucketName));
    const reqOptions = this.getRequestOptions({
      ...options,
      region
    });
    if (!this.anonymous) {
      // For non-anonymous https requests sha256sum is 'UNSIGNED-PAYLOAD' for signature calculation.
      if (!this.enableSHA256) {
        sha256sum = 'UNSIGNED-PAYLOAD';
      }
      const date = new Date();
      reqOptions.headers['x-amz-date'] = makeDateLong(date);
      reqOptions.headers['x-amz-content-sha256'] = sha256sum;
      if (this.sessionToken) {
        reqOptions.headers['x-amz-security-token'] = this.sessionToken;
      }
      reqOptions.headers.authorization = signV4(reqOptions, this.accessKey, this.secretKey, region, date, sha256sum);
    }
    const response = await request(this.transport, reqOptions, body);
    if (!response.statusCode) {
      throw new Error("BUG: response doesn't have a statusCode");
    }
    if (!statusCodes.includes(response.statusCode)) {
      // For an incorrect region, S3 server always sends back 400.
      // But we will do cache invalidation for all errors so that,
      // in future, if AWS S3 decides to send a different status code or
      // XML error code we will still work fine.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      delete this.regionMap[options.bucketName];
      const err = await xmlParsers.parseResponseError(response);
      this.logHTTP(reqOptions, response, err);
      throw err;
    }
    this.logHTTP(reqOptions, response);
    return response;
  }

  /**
   * gets the region of the bucket
   *
   * @param bucketName
   *
   * @internal
   */
  async getBucketRegionAsync(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name : ${bucketName}`);
    }

    // Region is set with constructor, return the region right here.
    if (this.region) {
      return this.region;
    }
    const cached = this.regionMap[bucketName];
    if (cached) {
      return cached;
    }
    const extractRegionAsync = async response => {
      const body = await readAsString(response);
      const region = xmlParsers.parseBucketRegion(body) || DEFAULT_REGION;
      this.regionMap[bucketName] = region;
      return region;
    };
    const method = 'GET';
    const query = 'location';
    // `getBucketLocation` behaves differently in following ways for
    // different environments.
    //
    // - For nodejs env we default to path style requests.
    // - For browser env path style requests on buckets yields CORS
    //   error. To circumvent this problem we make a virtual host
    //   style request signed with 'us-east-1'. This request fails
    //   with an error 'AuthorizationHeaderMalformed', additionally
    //   the error XML also provides Region of the bucket. To validate
    //   this region is proper we retry the same request with the newly
    //   obtained region.
    const pathStyle = this.pathStyle && !isBrowser;
    let region;
    try {
      const res = await this.makeRequestAsync({
        method,
        bucketName,
        query,
        pathStyle
      }, '', [200], DEFAULT_REGION);
      return extractRegionAsync(res);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (!(e.name === 'AuthorizationHeaderMalformed')) {
        throw e;
      }
      // @ts-expect-error we set extra properties on error object
      region = e.Region;
      if (!region) {
        throw e;
      }
    }
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query,
      pathStyle
    }, '', [200], region);
    return await extractRegionAsync(res);
  }

  /**
   * makeRequest is the primitive used by the apis for making S3 requests.
   * payload can be empty string in case of no payload.
   * statusCode is the expected statusCode. If response.statusCode does not match
   * we parse the XML error and call the callback with the error message.
   * A valid region is passed by the calls - listBuckets, makeBucket and
   * getBucketRegion.
   *
   * @deprecated use `makeRequestAsync` instead
   */
  makeRequest(options, payload = '', expectedCodes = [200], region = '', returnResponse, cb) {
    let prom;
    if (returnResponse) {
      prom = this.makeRequestAsync(options, payload, expectedCodes, region);
    } else {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error compatible for old behaviour
      prom = this.makeRequestAsyncOmit(options, payload, expectedCodes, region);
    }
    prom.then(result => cb(null, result), err => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      cb(err);
    });
  }

  /**
   * makeRequestStream will be used directly instead of makeRequest in case the payload
   * is available as a stream. for ex. putObject
   *
   * @deprecated use `makeRequestStreamAsync` instead
   */
  makeRequestStream(options, stream, sha256sum, statusCodes, region, returnResponse, cb) {
    const executor = async () => {
      const res = await this.makeRequestStreamAsync(options, stream, sha256sum, statusCodes, region);
      if (!returnResponse) {
        await drainResponse(res);
      }
      return res;
    };
    executor().then(result => cb(null, result),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    err => cb(err));
  }

  /**
   * @deprecated use `getBucketRegionAsync` instead
   */
  getBucketRegion(bucketName, cb) {
    return this.getBucketRegionAsync(bucketName).then(result => cb(null, result),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    err => cb(err));
  }

  // Bucket operations

  /**
   * Creates the bucket `bucketName`.
   *
   */
  async makeBucket(bucketName, region = '', makeOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    // Backward Compatibility
    if (isObject(region)) {
      makeOpts = region;
      region = '';
    }
    if (!isString(region)) {
      throw new TypeError('region should be of type "string"');
    }
    if (!isObject(makeOpts)) {
      throw new TypeError('makeOpts should be of type "object"');
    }
    let payload = '';

    // Region already set in constructor, validate if
    // caller requested bucket location is same.
    if (region && this.region) {
      if (region !== this.region) {
        throw new errors.InvalidArgumentError(`Configured region ${this.region}, requested ${region}`);
      }
    }
    // sending makeBucket request with XML containing 'us-east-1' fails. For
    // default region server expects the request without body
    if (region && region !== DEFAULT_REGION) {
      payload = xml.buildObject({
        CreateBucketConfiguration: {
          $: {
            xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/'
          },
          LocationConstraint: region
        }
      });
    }
    const method = 'PUT';
    const headers = {};
    if (makeOpts.ObjectLocking) {
      headers['x-amz-bucket-object-lock-enabled'] = true;
    }
    if (!region) {
      region = DEFAULT_REGION;
    }
    const finalRegion = region; // type narrow
    const requestOpt = {
      method,
      bucketName,
      headers
    };
    try {
      await this.makeRequestAsyncOmit(requestOpt, payload, [200], finalRegion);
    } catch (err) {
      if (region === '' || region === DEFAULT_REGION) {
        if (err instanceof errors.S3Error) {
          const errCode = err.code;
          const errRegion = err.region;
          if (errCode === 'AuthorizationHeaderMalformed' && errRegion !== '') {
            // Retry with region returned as part of error
            await this.makeRequestAsyncOmit(requestOpt, payload, [200], errCode);
          }
        }
      }
      throw err;
    }
  }

  /**
   * To check if a bucket already exists.
   */
  async bucketExists(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'HEAD';
    try {
      await this.makeRequestAsyncOmit({
        method,
        bucketName
      });
    } catch (err) {
      // @ts-ignore
      if (err.code === 'NoSuchBucket' || err.code === 'NotFound') {
        return false;
      }
      throw err;
    }
    return true;
  }

  /**
   * @deprecated use promise style API
   */

  async removeBucket(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'DELETE';
    await this.makeRequestAsyncOmit({
      method,
      bucketName
    }, '', [204]);
    delete this.regionMap[bucketName];
  }

  /**
   * Callback is called with readable stream of the object content.
   */
  async getObject(bucketName, objectName, getOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    return this.getPartialObject(bucketName, objectName, 0, 0, getOpts);
  }

  /**
   * Callback is called with readable stream of the partial object content.
   * @param bucketName
   * @param objectName
   * @param offset
   * @param length - length of the object that will be read in the stream (optional, if not specified we read the rest of the file from the offset)
   * @param getOpts
   */
  async getPartialObject(bucketName, objectName, offset, length = 0, getOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isNumber(offset)) {
      throw new TypeError('offset should be of type "number"');
    }
    if (!isNumber(length)) {
      throw new TypeError('length should be of type "number"');
    }
    let range = '';
    if (offset || length) {
      if (offset) {
        range = `bytes=${+offset}-`;
      } else {
        range = 'bytes=0-';
        offset = 0;
      }
      if (length) {
        range += `${+length + offset - 1}`;
      }
    }
    const headers = {};
    if (range !== '') {
      headers.range = range;
    }
    const expectedStatusCodes = [200];
    if (range) {
      expectedStatusCodes.push(206);
    }
    const method = 'GET';
    const query = qs.stringify(getOpts);
    return await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      headers,
      query
    }, '', expectedStatusCodes);
  }

  /**
   * download object content to a file.
   * This method will create a temp file named `${filename}.${etag}.part.minio` when downloading.
   *
   * @param bucketName - name of the bucket
   * @param objectName - name of the object
   * @param filePath - path to which the object data will be written to
   * @param getOpts - Optional object get option
   */
  async fGetObject(bucketName, objectName, filePath, getOpts = {}) {
    // Input validation.
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(filePath)) {
      throw new TypeError('filePath should be of type "string"');
    }
    const downloadToTmpFile = async () => {
      let partFileStream;
      const objStat = await this.statObject(bucketName, objectName, getOpts);
      const partFile = `${filePath}.${objStat.etag}.part.minio`;
      await fsp.mkdir(path.dirname(filePath), {
        recursive: true
      });
      let offset = 0;
      try {
        const stats = await fsp.stat(partFile);
        if (objStat.size === stats.size) {
          return partFile;
        }
        offset = stats.size;
        partFileStream = fs.createWriteStream(partFile, {
          flags: 'a'
        });
      } catch (e) {
        if (e instanceof Error && e.code === 'ENOENT') {
          // file not exist
          partFileStream = fs.createWriteStream(partFile, {
            flags: 'w'
          });
        } else {
          // other error, maybe access deny
          throw e;
        }
      }
      const downloadStream = await this.getPartialObject(bucketName, objectName, offset, 0, getOpts);
      await streamPromise.pipeline(downloadStream, partFileStream);
      const stats = await fsp.stat(partFile);
      if (stats.size === objStat.size) {
        return partFile;
      }
      throw new Error('Size mismatch between downloaded file and the object');
    };
    const partFile = await downloadToTmpFile();
    await fsp.rename(partFile, filePath);
  }

  /**
   * Stat information of the object.
   */
  async statObject(bucketName, objectName, statOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(statOpts)) {
      throw new errors.InvalidArgumentError('statOpts should be of type "object"');
    }
    const query = qs.stringify(statOpts);
    const method = 'HEAD';
    const res = await this.makeRequestAsyncOmit({
      method,
      bucketName,
      objectName,
      query
    });
    return {
      size: parseInt(res.headers['content-length']),
      metaData: extractMetadata(res.headers),
      lastModified: new Date(res.headers['last-modified']),
      versionId: getVersionId(res.headers),
      etag: sanitizeETag(res.headers.etag)
    };
  }

  /**
   * Remove the specified object.
   * @deprecated use new promise style API
   */

  /**
   * @deprecated use new promise style API
   */ // @ts-ignore
  async removeObject(bucketName, objectName, removeOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(removeOpts)) {
      throw new errors.InvalidArgumentError('removeOpts should be of type "object"');
    }
    const method = 'DELETE';
    const headers = {};
    if (removeOpts.governanceBypass) {
      headers['X-Amz-Bypass-Governance-Retention'] = true;
    }
    if (removeOpts.forceDelete) {
      headers['x-minio-force-delete'] = true;
    }
    const queryParams = {};
    if (removeOpts.versionId) {
      queryParams.versionId = `${removeOpts.versionId}`;
    }
    const query = qs.stringify(queryParams);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      objectName,
      headers,
      query
    }, '', [200, 204]);
  }

  // Calls implemented below are related to multipart.

  listIncompleteUploads(bucket, prefix, recursive) {
    if (prefix === undefined) {
      prefix = '';
    }
    if (recursive === undefined) {
      recursive = false;
    }
    if (!isValidBucketName(bucket)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucket);
    }
    if (!isValidPrefix(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!isBoolean(recursive)) {
      throw new TypeError('recursive should be of type "boolean"');
    }
    const delimiter = recursive ? '' : '/';
    let keyMarker = '';
    let uploadIdMarker = '';
    const uploads = [];
    let ended = false;

    // TODO: refactor this with async/await and `stream.Readable.from`
    const readStream = new stream.Readable({
      objectMode: true
    });
    readStream._read = () => {
      // push one upload info per _read()
      if (uploads.length) {
        return readStream.push(uploads.shift());
      }
      if (ended) {
        return readStream.push(null);
      }
      this.listIncompleteUploadsQuery(bucket, prefix, keyMarker, uploadIdMarker, delimiter).then(result => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        result.prefixes.forEach(prefix => uploads.push(prefix));
        async.eachSeries(result.uploads, (upload, cb) => {
          // for each incomplete upload add the sizes of its uploaded parts
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.listParts(bucket, upload.key, upload.uploadId).then(parts => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            upload.size = parts.reduce((acc, item) => acc + item.size, 0);
            uploads.push(upload);
            cb();
          }, err => cb(err));
        }, err => {
          if (err) {
            readStream.emit('error', err);
            return;
          }
          if (result.isTruncated) {
            keyMarker = result.nextKeyMarker;
            uploadIdMarker = result.nextUploadIdMarker;
          } else {
            ended = true;
          }

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          readStream._read();
        });
      }, e => {
        readStream.emit('error', e);
      });
    };
    return readStream;
  }

  /**
   * Called by listIncompleteUploads to fetch a batch of incomplete uploads.
   */
  async listIncompleteUploadsQuery(bucketName, prefix, keyMarker, uploadIdMarker, delimiter) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isString(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!isString(keyMarker)) {
      throw new TypeError('keyMarker should be of type "string"');
    }
    if (!isString(uploadIdMarker)) {
      throw new TypeError('uploadIdMarker should be of type "string"');
    }
    if (!isString(delimiter)) {
      throw new TypeError('delimiter should be of type "string"');
    }
    const queries = [];
    queries.push(`prefix=${uriEscape(prefix)}`);
    queries.push(`delimiter=${uriEscape(delimiter)}`);
    if (keyMarker) {
      queries.push(`key-marker=${uriEscape(keyMarker)}`);
    }
    if (uploadIdMarker) {
      queries.push(`upload-id-marker=${uploadIdMarker}`);
    }
    const maxUploads = 1000;
    queries.push(`max-uploads=${maxUploads}`);
    queries.sort();
    queries.unshift('uploads');
    let query = '';
    if (queries.length > 0) {
      query = `${queries.join('&')}`;
    }
    const method = 'GET';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const body = await readAsString(res);
    return xmlParsers.parseListMultipart(body);
  }

  /**
   * Initiate a new multipart upload.
   * @internal
   */
  async initiateNewMultipartUpload(bucketName, objectName, headers) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(headers)) {
      throw new errors.InvalidObjectNameError('contentType should be of type "object"');
    }
    const method = 'POST';
    const query = 'uploads';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      query,
      headers
    });
    const body = await readAsBuffer(res);
    return parseInitiateMultipart(body.toString());
  }

  /**
   * Internal Method to abort a multipart upload request in case of any errors.
   *
   * @param bucketName - Bucket Name
   * @param objectName - Object Name
   * @param uploadId - id of a multipart upload to cancel during compose object sequence.
   */
  async abortMultipartUpload(bucketName, objectName, uploadId) {
    const method = 'DELETE';
    const query = `uploadId=${uploadId}`;
    const requestOptions = {
      method,
      bucketName,
      objectName: objectName,
      query
    };
    await this.makeRequestAsyncOmit(requestOptions, '', [204]);
  }
  async findUploadId(bucketName, objectName) {
    var _latestUpload;
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    let latestUpload;
    let keyMarker = '';
    let uploadIdMarker = '';
    for (;;) {
      const result = await this.listIncompleteUploadsQuery(bucketName, objectName, keyMarker, uploadIdMarker, '');
      for (const upload of result.uploads) {
        if (upload.key === objectName) {
          if (!latestUpload || upload.initiated.getTime() > latestUpload.initiated.getTime()) {
            latestUpload = upload;
          }
        }
      }
      if (result.isTruncated) {
        keyMarker = result.nextKeyMarker;
        uploadIdMarker = result.nextUploadIdMarker;
        continue;
      }
      break;
    }
    return (_latestUpload = latestUpload) === null || _latestUpload === void 0 ? void 0 : _latestUpload.uploadId;
  }

  /**
   * this call will aggregate the parts on the server into a single object.
   */
  async completeMultipartUpload(bucketName, objectName, uploadId, etags) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(uploadId)) {
      throw new TypeError('uploadId should be of type "string"');
    }
    if (!isObject(etags)) {
      throw new TypeError('etags should be of type "Array"');
    }
    if (!uploadId) {
      throw new errors.InvalidArgumentError('uploadId cannot be empty');
    }
    const method = 'POST';
    const query = `uploadId=${uriEscape(uploadId)}`;
    const builder = new xml2js.Builder();
    const payload = builder.buildObject({
      CompleteMultipartUpload: {
        $: {
          xmlns: 'http://s3.amazonaws.com/doc/2006-03-01/'
        },
        Part: etags.map(etag => {
          return {
            PartNumber: etag.part,
            ETag: etag.etag
          };
        })
      }
    });
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      query
    }, payload);
    const body = await readAsBuffer(res);
    const result = parseCompleteMultipart(body.toString());
    if (!result) {
      throw new Error('BUG: failed to parse server response');
    }
    if (result.errCode) {
      // Multipart Complete API returns an error XML after a 200 http status
      throw new errors.S3Error(result.errMessage);
    }
    return {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      etag: result.etag,
      versionId: getVersionId(res.headers)
    };
  }

  /**
   * Get part-info of all parts of an incomplete upload specified by uploadId.
   */
  async listParts(bucketName, objectName, uploadId) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(uploadId)) {
      throw new TypeError('uploadId should be of type "string"');
    }
    if (!uploadId) {
      throw new errors.InvalidArgumentError('uploadId cannot be empty');
    }
    const parts = [];
    let marker = 0;
    let result;
    do {
      result = await this.listPartsQuery(bucketName, objectName, uploadId, marker);
      marker = result.marker;
      parts.push(...result.parts);
    } while (result.isTruncated);
    return parts;
  }

  /**
   * Called by listParts to fetch a batch of part-info
   */
  async listPartsQuery(bucketName, objectName, uploadId, marker) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(uploadId)) {
      throw new TypeError('uploadId should be of type "string"');
    }
    if (!isNumber(marker)) {
      throw new TypeError('marker should be of type "number"');
    }
    if (!uploadId) {
      throw new errors.InvalidArgumentError('uploadId cannot be empty');
    }
    let query = `uploadId=${uriEscape(uploadId)}`;
    if (marker) {
      query += `&part-number-marker=${marker}`;
    }
    const method = 'GET';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      query
    });
    return xmlParsers.parseListParts(await readAsString(res));
  }
  async listBuckets() {
    const method = 'GET';
    const httpRes = await this.makeRequestAsync({
      method
    }, '', [200], this.region ?? '');
    const xmlResult = await readAsString(httpRes);
    return xmlParsers.parseListBucket(xmlResult);
  }

  /**
   * Calculate part size given the object size. Part size will be atleast this.partSize
   */
  calculatePartSize(size) {
    if (!isNumber(size)) {
      throw new TypeError('size should be of type "number"');
    }
    if (size > this.maxObjectSize) {
      throw new TypeError(`size should not be more than ${this.maxObjectSize}`);
    }
    if (this.overRidePartSize) {
      return this.partSize;
    }
    let partSize = this.partSize;
    for (;;) {
      // while(true) {...} throws linting error.
      // If partSize is big enough to accomodate the object size, then use it.
      if (partSize * 10000 > size) {
        return partSize;
      }
      // Try part sizes as 64MB, 80MB, 96MB etc.
      partSize += 16 * 1024 * 1024;
    }
  }

  /**
   * Uploads the object using contents from a file
   */
  async fPutObject(bucketName, objectName, filePath, metaData = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isString(filePath)) {
      throw new TypeError('filePath should be of type "string"');
    }
    if (!isObject(metaData)) {
      throw new TypeError('metaData should be of type "object"');
    }

    // Inserts correct `content-type` attribute based on metaData and filePath
    metaData = insertContentType(metaData, filePath);
    const stat = await fsp.lstat(filePath);
    await this.putObject(bucketName, objectName, fs.createReadStream(filePath), stat.size, metaData);
  }

  /**
   *  Uploading a stream, "Buffer" or "string".
   *  It's recommended to pass `size` argument with stream.
   */
  async putObject(bucketName, objectName, stream, size, metaData) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }

    // We'll need to shift arguments to the left because of metaData
    // and size being optional.
    if (isObject(size)) {
      metaData = size;
    }
    // Ensures Metadata has appropriate prefix for A3 API
    const headers = prependXAMZMeta(metaData);
    if (typeof stream === 'string' || stream instanceof Buffer) {
      // Adapts the non-stream interface into a stream.
      size = stream.length;
      stream = readableStream(stream);
    } else if (!isReadableStream(stream)) {
      throw new TypeError('third argument should be of type "stream.Readable" or "Buffer" or "string"');
    }
    if (isNumber(size) && size < 0) {
      throw new errors.InvalidArgumentError(`size cannot be negative, given size: ${size}`);
    }

    // Get the part size and forward that to the BlockStream. Default to the
    // largest block size possible if necessary.
    if (!isNumber(size)) {
      size = this.maxObjectSize;
    }

    // Get the part size and forward that to the BlockStream. Default to the
    // largest block size possible if necessary.
    if (size === undefined) {
      const statSize = await getContentLength(stream);
      if (statSize !== null) {
        size = statSize;
      }
    }
    if (!isNumber(size)) {
      // Backward compatibility
      size = this.maxObjectSize;
    }
    const partSize = this.calculatePartSize(size);
    if (typeof stream === 'string' || Buffer.isBuffer(stream) || size <= partSize) {
      const buf = isReadableStream(stream) ? await readAsBuffer(stream) : Buffer.from(stream);
      return this.uploadBuffer(bucketName, objectName, headers, buf);
    }
    return this.uploadStream(bucketName, objectName, headers, stream, partSize);
  }

  /**
   * method to upload buffer in one call
   * @private
   */
  async uploadBuffer(bucketName, objectName, headers, buf) {
    const {
      md5sum,
      sha256sum
    } = hashBinary(buf, this.enableSHA256);
    headers['Content-Length'] = buf.length;
    if (!this.enableSHA256) {
      headers['Content-MD5'] = md5sum;
    }
    const res = await this.makeRequestStreamAsync({
      method: 'PUT',
      bucketName,
      objectName,
      headers
    }, buf, sha256sum, [200], '');
    await drainResponse(res);
    return {
      etag: sanitizeETag(res.headers.etag),
      versionId: getVersionId(res.headers)
    };
  }

  /**
   * upload stream with MultipartUpload
   * @private
   */
  async uploadStream(bucketName, objectName, headers, body, partSize) {
    // A map of the previously uploaded chunks, for resuming a file upload. This
    // will be null if we aren't resuming an upload.
    const oldParts = {};

    // Keep track of the etags for aggregating the chunks together later. Each
    // etag represents a single chunk of the file.
    const eTags = [];
    const previousUploadId = await this.findUploadId(bucketName, objectName);
    let uploadId;
    if (!previousUploadId) {
      uploadId = await this.initiateNewMultipartUpload(bucketName, objectName, headers);
    } else {
      uploadId = previousUploadId;
      const oldTags = await this.listParts(bucketName, objectName, previousUploadId);
      oldTags.forEach(e => {
        oldTags[e.part] = e;
      });
    }
    const chunkier = new BlockStream2({
      size: partSize,
      zeroPadding: false
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, o] = await Promise.all([new Promise((resolve, reject) => {
      body.pipe(chunkier).on('error', reject);
      chunkier.on('end', resolve).on('error', reject);
    }), (async () => {
      let partNumber = 1;
      for await (const chunk of chunkier) {
        const md5 = crypto.createHash('md5').update(chunk).digest();
        const oldPart = oldParts[partNumber];
        if (oldPart) {
          if (oldPart.etag === md5.toString('hex')) {
            eTags.push({
              part: partNumber,
              etag: oldPart.etag
            });
            partNumber++;
            continue;
          }
        }
        partNumber++;

        // now start to upload missing part
        const options = {
          method: 'PUT',
          query: qs.stringify({
            partNumber,
            uploadId
          }),
          headers: {
            'Content-Length': chunk.length,
            'Content-MD5': md5.toString('base64')
          },
          bucketName,
          objectName
        };
        const response = await this.makeRequestAsyncOmit(options, chunk);
        let etag = response.headers.etag;
        if (etag) {
          etag = etag.replace(/^"/, '').replace(/"$/, '');
        } else {
          etag = '';
        }
        eTags.push({
          part: partNumber,
          etag
        });
      }
      return await this.completeMultipartUpload(bucketName, objectName, uploadId, eTags);
    })()]);
    return o;
  }
  async removeBucketReplication(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'DELETE';
    const query = 'replication';
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query
    }, '', [200, 204], '');
  }
  async setBucketReplication(bucketName, replicationConfig) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isObject(replicationConfig)) {
      throw new errors.InvalidArgumentError('replicationConfig should be of type "object"');
    } else {
      if (_.isEmpty(replicationConfig.role)) {
        throw new errors.InvalidArgumentError('Role cannot be empty');
      } else if (replicationConfig.role && !isString(replicationConfig.role)) {
        throw new errors.InvalidArgumentError('Invalid value for role', replicationConfig.role);
      }
      if (_.isEmpty(replicationConfig.rules)) {
        throw new errors.InvalidArgumentError('Minimum one replication rule must be specified');
      }
    }
    const method = 'PUT';
    const query = 'replication';
    const headers = {};
    const replicationParamsConfig = {
      ReplicationConfiguration: {
        Role: replicationConfig.role,
        Rule: replicationConfig.rules
      }
    };
    const builder = new xml2js.Builder({
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(replicationParamsConfig);
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketReplication(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'replication';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    }, '', [200, 204]);
    const xmlResult = await readAsString(httpRes);
    return xmlParsers.parseReplicationConfig(xmlResult);
  }
  async getObjectLegalHold(bucketName, objectName, getOpts) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (getOpts) {
      if (!isObject(getOpts)) {
        throw new TypeError('getOpts should be of type "Object"');
      } else if (Object.keys(getOpts).length > 0 && getOpts.versionId && !isString(getOpts.versionId)) {
        throw new TypeError('versionId should be of type string.:', getOpts.versionId);
      }
    }
    const method = 'GET';
    let query = 'legal-hold';
    if (getOpts !== null && getOpts !== void 0 && getOpts.versionId) {
      query += `&versionId=${getOpts.versionId}`;
    }
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      query
    }, '', [200]);
    const strRes = await readAsString(httpRes);
    return parseObjectLegalHoldConfig(strRes);
  }
  async setObjectLegalHold(bucketName, objectName, setOpts = {
    status: LEGAL_HOLD_STATUS.ENABLED
  }) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(setOpts)) {
      throw new TypeError('setOpts should be of type "Object"');
    } else {
      if (![LEGAL_HOLD_STATUS.ENABLED, LEGAL_HOLD_STATUS.DISABLED].includes(setOpts === null || setOpts === void 0 ? void 0 : setOpts.status)) {
        throw new TypeError('Invalid status: ' + setOpts.status);
      }
      if (setOpts.versionId && !setOpts.versionId.length) {
        throw new TypeError('versionId should be of type string.:' + setOpts.versionId);
      }
    }
    const method = 'PUT';
    let query = 'legal-hold';
    if (setOpts.versionId) {
      query += `&versionId=${setOpts.versionId}`;
    }
    const config = {
      Status: setOpts.status
    };
    const builder = new xml2js.Builder({
      rootName: 'LegalHold',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(config);
    const headers = {};
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      objectName,
      query,
      headers
    }, payload);
  }

  /**
   * Get Tags associated with a Bucket
   */
  async getBucketTagging(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    const method = 'GET';
    const query = 'tagging';
    const requestOptions = {
      method,
      bucketName,
      query
    };
    const response = await this.makeRequestAsync(requestOptions);
    const body = await readAsString(response);
    return xmlParsers.parseTagging(body);
  }

  /**
   *  Get the tags associated with a bucket OR an object
   */
  async getObjectTagging(bucketName, objectName, getOpts = {}) {
    const method = 'GET';
    let query = 'tagging';
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (!isObject(getOpts)) {
      throw new errors.InvalidArgumentError('getOpts should be of type "object"');
    }
    if (getOpts && getOpts.versionId) {
      query = `${query}&versionId=${getOpts.versionId}`;
    }
    const requestOptions = {
      method,
      bucketName,
      query
    };
    if (objectName) {
      requestOptions['objectName'] = objectName;
    }
    const response = await this.makeRequestAsync(requestOptions);
    const body = await readAsString(response);
    return xmlParsers.parseTagging(body);
  }

  /**
   *  Set the policy on a bucket or an object prefix.
   */
  async setBucketPolicy(bucketName, policy) {
    // Validate arguments.
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isString(policy)) {
      throw new errors.InvalidBucketPolicyError(`Invalid bucket policy: ${policy} - must be "string"`);
    }
    const query = 'policy';
    let method = 'DELETE';
    if (policy) {
      method = 'PUT';
    }
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query
    }, policy, [204], '');
  }

  /**
   * Get the policy on a bucket or an object prefix.
   */
  async getBucketPolicy(bucketName) {
    // Validate arguments.
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    const method = 'GET';
    const query = 'policy';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    return await readAsString(res);
  }
  async putObjectRetention(bucketName, objectName, retentionOpts = {}) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!isObject(retentionOpts)) {
      throw new errors.InvalidArgumentError('retentionOpts should be of type "object"');
    } else {
      if (retentionOpts.governanceBypass && !isBoolean(retentionOpts.governanceBypass)) {
        throw new errors.InvalidArgumentError(`Invalid value for governanceBypass: ${retentionOpts.governanceBypass}`);
      }
      if (retentionOpts.mode && ![RETENTION_MODES.COMPLIANCE, RETENTION_MODES.GOVERNANCE].includes(retentionOpts.mode)) {
        throw new errors.InvalidArgumentError(`Invalid object retention mode: ${retentionOpts.mode}`);
      }
      if (retentionOpts.retainUntilDate && !isString(retentionOpts.retainUntilDate)) {
        throw new errors.InvalidArgumentError(`Invalid value for retainUntilDate: ${retentionOpts.retainUntilDate}`);
      }
      if (retentionOpts.versionId && !isString(retentionOpts.versionId)) {
        throw new errors.InvalidArgumentError(`Invalid value for versionId: ${retentionOpts.versionId}`);
      }
    }
    const method = 'PUT';
    let query = 'retention';
    const headers = {};
    if (retentionOpts.governanceBypass) {
      headers['X-Amz-Bypass-Governance-Retention'] = true;
    }
    const builder = new xml2js.Builder({
      rootName: 'Retention',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const params = {};
    if (retentionOpts.mode) {
      params.Mode = retentionOpts.mode;
    }
    if (retentionOpts.retainUntilDate) {
      params.RetainUntilDate = retentionOpts.retainUntilDate;
    }
    if (retentionOpts.versionId) {
      query += `&versionId=${retentionOpts.versionId}`;
    }
    const payload = builder.buildObject(params);
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      objectName,
      query,
      headers
    }, payload, [200, 204]);
  }
  async getObjectLockConfig(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'object-lock';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const xmlResult = await readAsString(httpRes);
    return xmlParsers.parseObjectLockConfig(xmlResult);
  }
  async setObjectLockConfig(bucketName, lockConfigOpts) {
    const retentionModes = [RETENTION_MODES.COMPLIANCE, RETENTION_MODES.GOVERNANCE];
    const validUnits = [RETENTION_VALIDITY_UNITS.DAYS, RETENTION_VALIDITY_UNITS.YEARS];
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (lockConfigOpts.mode && !retentionModes.includes(lockConfigOpts.mode)) {
      throw new TypeError(`lockConfigOpts.mode should be one of ${retentionModes}`);
    }
    if (lockConfigOpts.unit && !validUnits.includes(lockConfigOpts.unit)) {
      throw new TypeError(`lockConfigOpts.unit should be one of ${validUnits}`);
    }
    if (lockConfigOpts.validity && !isNumber(lockConfigOpts.validity)) {
      throw new TypeError(`lockConfigOpts.validity should be a number`);
    }
    const method = 'PUT';
    const query = 'object-lock';
    const config = {
      ObjectLockEnabled: 'Enabled'
    };
    const configKeys = Object.keys(lockConfigOpts);
    const isAllKeysSet = ['unit', 'mode', 'validity'].every(lck => configKeys.includes(lck));
    // Check if keys are present and all keys are present.
    if (configKeys.length > 0) {
      if (!isAllKeysSet) {
        throw new TypeError(`lockConfigOpts.mode,lockConfigOpts.unit,lockConfigOpts.validity all the properties should be specified.`);
      } else {
        config.Rule = {
          DefaultRetention: {}
        };
        if (lockConfigOpts.mode) {
          config.Rule.DefaultRetention.Mode = lockConfigOpts.mode;
        }
        if (lockConfigOpts.unit === RETENTION_VALIDITY_UNITS.DAYS) {
          config.Rule.DefaultRetention.Days = lockConfigOpts.validity;
        } else if (lockConfigOpts.unit === RETENTION_VALIDITY_UNITS.YEARS) {
          config.Rule.DefaultRetention.Years = lockConfigOpts.validity;
        }
      }
    }
    const builder = new xml2js.Builder({
      rootName: 'ObjectLockConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(config);
    const headers = {};
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketVersioning(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'versioning';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const xmlResult = await readAsString(httpRes);
    return await xmlParsers.parseBucketVersioningConfig(xmlResult);
  }
  async setBucketVersioning(bucketName, versionConfig) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!Object.keys(versionConfig).length) {
      throw new errors.InvalidArgumentError('versionConfig should be of type "object"');
    }
    const method = 'PUT';
    const query = 'versioning';
    const builder = new xml2js.Builder({
      rootName: 'VersioningConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(versionConfig);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query
    }, payload);
  }
  async setTagging(taggingParams) {
    const {
      bucketName,
      objectName,
      tags,
      putOpts
    } = taggingParams;
    const method = 'PUT';
    let query = 'tagging';
    if (putOpts && putOpts !== null && putOpts !== void 0 && putOpts.versionId) {
      query = `${query}&versionId=${putOpts.versionId}`;
    }
    const tagsList = [];
    for (const [key, value] of Object.entries(tags)) {
      tagsList.push({
        Key: key,
        Value: value
      });
    }
    const taggingConfig = {
      Tagging: {
        TagSet: {
          Tag: tagsList
        }
      }
    };
    const headers = {};
    const builder = new xml2js.Builder({
      headless: true,
      renderOpts: {
        pretty: false
      }
    });
    const payloadBuf = Buffer.from(builder.buildObject(taggingConfig));
    const requestOptions = {
      method,
      bucketName,
      query,
      headers,
      ...(objectName && {
        objectName: objectName
      })
    };
    headers['Content-MD5'] = toMd5(payloadBuf);
    await this.makeRequestAsyncOmit(requestOptions, payloadBuf);
  }
  async removeTagging({
    bucketName,
    objectName,
    removeOpts
  }) {
    const method = 'DELETE';
    let query = 'tagging';
    if (removeOpts && Object.keys(removeOpts).length && removeOpts.versionId) {
      query = `${query}&versionId=${removeOpts.versionId}`;
    }
    const requestOptions = {
      method,
      bucketName,
      objectName,
      query
    };
    if (objectName) {
      requestOptions['objectName'] = objectName;
    }
    await this.makeRequestAsync(requestOptions, '', [200, 204]);
  }
  async setBucketTagging(bucketName, tags) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isObject(tags)) {
      throw new errors.InvalidArgumentError('tags should be of type "object"');
    }
    if (Object.keys(tags).length > 10) {
      throw new errors.InvalidArgumentError('maximum tags allowed is 10"');
    }
    await this.setTagging({
      bucketName,
      tags
    });
  }
  async removeBucketTagging(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    await this.removeTagging({
      bucketName
    });
  }
  async setObjectTagging(bucketName, objectName, tags, putOpts) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (!isObject(tags)) {
      throw new errors.InvalidArgumentError('tags should be of type "object"');
    }
    if (Object.keys(tags).length > 10) {
      throw new errors.InvalidArgumentError('Maximum tags allowed is 10"');
    }
    await this.setTagging({
      bucketName,
      objectName,
      tags,
      putOpts
    });
  }
  async removeObjectTagging(bucketName, objectName, removeOpts) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (removeOpts && Object.keys(removeOpts).length && !isObject(removeOpts)) {
      throw new errors.InvalidArgumentError('removeOpts should be of type "object"');
    }
    await this.removeTagging({
      bucketName,
      objectName,
      removeOpts
    });
  }
  async selectObjectContent(bucketName, objectName, selectOpts) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!isValidObjectName(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!_.isEmpty(selectOpts)) {
      if (!isString(selectOpts.expression)) {
        throw new TypeError('sqlExpression should be of type "string"');
      }
      if (!_.isEmpty(selectOpts.inputSerialization)) {
        if (!isObject(selectOpts.inputSerialization)) {
          throw new TypeError('inputSerialization should be of type "object"');
        }
      } else {
        throw new TypeError('inputSerialization is required');
      }
      if (!_.isEmpty(selectOpts.outputSerialization)) {
        if (!isObject(selectOpts.outputSerialization)) {
          throw new TypeError('outputSerialization should be of type "object"');
        }
      } else {
        throw new TypeError('outputSerialization is required');
      }
    } else {
      throw new TypeError('valid select configuration is required');
    }
    const method = 'POST';
    const query = `select&select-type=2`;
    const config = [{
      Expression: selectOpts.expression
    }, {
      ExpressionType: selectOpts.expressionType || 'SQL'
    }, {
      InputSerialization: [selectOpts.inputSerialization]
    }, {
      OutputSerialization: [selectOpts.outputSerialization]
    }];

    // Optional
    if (selectOpts.requestProgress) {
      config.push({
        RequestProgress: selectOpts === null || selectOpts === void 0 ? void 0 : selectOpts.requestProgress
      });
    }
    // Optional
    if (selectOpts.scanRange) {
      config.push({
        ScanRange: selectOpts.scanRange
      });
    }
    const builder = new xml2js.Builder({
      rootName: 'SelectObjectContentRequest',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(config);
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      objectName,
      query
    }, payload);
    const body = await readAsBuffer(res);
    return parseSelectObjectContentResponse(body);
  }
  async applyBucketLifecycle(bucketName, policyConfig) {
    const method = 'PUT';
    const query = 'lifecycle';
    const headers = {};
    const builder = new xml2js.Builder({
      rootName: 'LifecycleConfiguration',
      headless: true,
      renderOpts: {
        pretty: false
      }
    });
    const payload = builder.buildObject(policyConfig);
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async removeBucketLifecycle(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'DELETE';
    const query = 'lifecycle';
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query
    }, '', [204]);
  }
  async setBucketLifecycle(bucketName, lifeCycleConfig) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (_.isEmpty(lifeCycleConfig)) {
      await this.removeBucketLifecycle(bucketName);
    } else {
      await this.applyBucketLifecycle(bucketName, lifeCycleConfig);
    }
  }
  async getBucketLifecycle(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'lifecycle';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const body = await readAsString(res);
    return xmlParsers.parseLifecycleConfig(body);
  }
  async setBucketEncryption(bucketName, encryptionConfig) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!_.isEmpty(encryptionConfig) && encryptionConfig.Rule.length > 1) {
      throw new errors.InvalidArgumentError('Invalid Rule length. Only one rule is allowed.: ' + encryptionConfig.Rule);
    }
    let encryptionObj = encryptionConfig;
    if (_.isEmpty(encryptionConfig)) {
      encryptionObj = {
        // Default MinIO Server Supported Rule
        Rule: [{
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256'
          }
        }]
      };
    }
    const method = 'PUT';
    const query = 'encryption';
    const builder = new xml2js.Builder({
      rootName: 'ServerSideEncryptionConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(encryptionObj);
    const headers = {};
    headers['Content-MD5'] = toMd5(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketEncryption(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'encryption';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const body = await readAsString(res);
    return xmlParsers.parseBucketEncryptionConfig(body);
  }
  async removeBucketEncryption(bucketName) {
    if (!isValidBucketName(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'DELETE';
    const query = 'encryption';
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query
    }, '', [204]);
  }
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjcnlwdG8iLCJmcyIsImh0dHAiLCJodHRwcyIsInBhdGgiLCJzdHJlYW0iLCJhc3luYyIsIkJsb2NrU3RyZWFtMiIsImlzQnJvd3NlciIsIl8iLCJxcyIsInhtbDJqcyIsIkNyZWRlbnRpYWxQcm92aWRlciIsImVycm9ycyIsIkRFRkFVTFRfUkVHSU9OIiwiTEVHQUxfSE9MRF9TVEFUVVMiLCJSRVRFTlRJT05fTU9ERVMiLCJSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMiLCJzaWduVjQiLCJmc3AiLCJzdHJlYW1Qcm9taXNlIiwiRXh0ZW5zaW9ucyIsImV4dHJhY3RNZXRhZGF0YSIsImdldENvbnRlbnRMZW5ndGgiLCJnZXRWZXJzaW9uSWQiLCJoYXNoQmluYXJ5IiwiaW5zZXJ0Q29udGVudFR5cGUiLCJpc0FtYXpvbkVuZHBvaW50IiwiaXNCb29sZWFuIiwiaXNEZWZpbmVkIiwiaXNFbXB0eSIsImlzTnVtYmVyIiwiaXNPYmplY3QiLCJpc1JlYWRhYmxlU3RyZWFtIiwiaXNTdHJpbmciLCJpc1ZhbGlkQnVja2V0TmFtZSIsImlzVmFsaWRFbmRwb2ludCIsImlzVmFsaWRPYmplY3ROYW1lIiwiaXNWYWxpZFBvcnQiLCJpc1ZhbGlkUHJlZml4IiwiaXNWaXJ0dWFsSG9zdFN0eWxlIiwibWFrZURhdGVMb25nIiwicHJlcGVuZFhBTVpNZXRhIiwicmVhZGFibGVTdHJlYW0iLCJzYW5pdGl6ZUVUYWciLCJ0b01kNSIsInRvU2hhMjU2IiwidXJpRXNjYXBlIiwidXJpUmVzb3VyY2VFc2NhcGUiLCJqb2luSG9zdFBvcnQiLCJyZXF1ZXN0IiwiZHJhaW5SZXNwb25zZSIsInJlYWRBc0J1ZmZlciIsInJlYWRBc1N0cmluZyIsImdldFMzRW5kcG9pbnQiLCJwYXJzZUNvbXBsZXRlTXVsdGlwYXJ0IiwicGFyc2VJbml0aWF0ZU11bHRpcGFydCIsInBhcnNlT2JqZWN0TGVnYWxIb2xkQ29uZmlnIiwicGFyc2VTZWxlY3RPYmplY3RDb250ZW50UmVzcG9uc2UiLCJ4bWxQYXJzZXJzIiwieG1sIiwiQnVpbGRlciIsInJlbmRlck9wdHMiLCJwcmV0dHkiLCJoZWFkbGVzcyIsIlBhY2thZ2UiLCJ2ZXJzaW9uIiwicmVxdWVzdE9wdGlvblByb3BlcnRpZXMiLCJUeXBlZENsaWVudCIsInBhcnRTaXplIiwibWF4aW11bVBhcnRTaXplIiwibWF4T2JqZWN0U2l6ZSIsImNvbnN0cnVjdG9yIiwicGFyYW1zIiwic2VjdXJlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJ1c2VTU0wiLCJwb3J0IiwiZW5kUG9pbnQiLCJJbnZhbGlkRW5kcG9pbnRFcnJvciIsIkludmFsaWRBcmd1bWVudEVycm9yIiwicmVnaW9uIiwiaG9zdCIsInRvTG93ZXJDYXNlIiwicHJvdG9jb2wiLCJ0cmFuc3BvcnQiLCJ0cmFuc3BvcnRBZ2VudCIsImdsb2JhbEFnZW50IiwibGlicmFyeUNvbW1lbnRzIiwicHJvY2VzcyIsInBsYXRmb3JtIiwiYXJjaCIsImxpYnJhcnlBZ2VudCIsInVzZXJBZ2VudCIsInBhdGhTdHlsZSIsImFjY2Vzc0tleSIsInNlY3JldEtleSIsInNlc3Npb25Ub2tlbiIsImFub255bW91cyIsImNyZWRlbnRpYWxzUHJvdmlkZXIiLCJyZWdpb25NYXAiLCJvdmVyUmlkZVBhcnRTaXplIiwiZW5hYmxlU0hBMjU2IiwiczNBY2NlbGVyYXRlRW5kcG9pbnQiLCJyZXFPcHRpb25zIiwiY2xpZW50RXh0ZW5zaW9ucyIsImV4dGVuc2lvbnMiLCJzZXRTM1RyYW5zZmVyQWNjZWxlcmF0ZSIsInNldFJlcXVlc3RPcHRpb25zIiwib3B0aW9ucyIsIlR5cGVFcnJvciIsInBpY2siLCJnZXRBY2NlbGVyYXRlRW5kUG9pbnRJZlNldCIsImJ1Y2tldE5hbWUiLCJvYmplY3ROYW1lIiwiaW5jbHVkZXMiLCJnZXRSZXF1ZXN0T3B0aW9ucyIsIm9wdHMiLCJtZXRob2QiLCJoZWFkZXJzIiwicXVlcnkiLCJhZ2VudCIsInZpcnR1YWxIb3N0U3R5bGUiLCJhY2NlbGVyYXRlRW5kUG9pbnQiLCJrIiwidiIsIk9iamVjdCIsImVudHJpZXMiLCJhc3NpZ24iLCJtYXBWYWx1ZXMiLCJwaWNrQnkiLCJ0b1N0cmluZyIsInNldENyZWRlbnRpYWxzUHJvdmlkZXIiLCJjaGVja0FuZFJlZnJlc2hDcmVkcyIsImNyZWRlbnRpYWxzQ29uZiIsImdldENyZWRlbnRpYWxzIiwiZ2V0QWNjZXNzS2V5IiwiZ2V0U2VjcmV0S2V5IiwiZ2V0U2Vzc2lvblRva2VuIiwiZSIsImNhdXNlIiwibG9nSFRUUCIsInJlc3BvbnNlIiwiZXJyIiwibG9nU3RyZWFtIiwibG9nSGVhZGVycyIsImZvckVhY2giLCJyZWRhY3RvciIsIlJlZ0V4cCIsInJlcGxhY2UiLCJ3cml0ZSIsInN0YXR1c0NvZGUiLCJlcnJKU09OIiwiSlNPTiIsInN0cmluZ2lmeSIsInRyYWNlT24iLCJzdGRvdXQiLCJ0cmFjZU9mZiIsIm1ha2VSZXF1ZXN0QXN5bmMiLCJwYXlsb2FkIiwiZXhwZWN0ZWRDb2RlcyIsImxlbmd0aCIsInNoYTI1NnN1bSIsIm1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMiLCJtYWtlUmVxdWVzdEFzeW5jT21pdCIsInN0YXR1c0NvZGVzIiwicmVzIiwiYm9keSIsIkJ1ZmZlciIsImlzQnVmZmVyIiwiZ2V0QnVja2V0UmVnaW9uQXN5bmMiLCJkYXRlIiwiRGF0ZSIsImF1dGhvcml6YXRpb24iLCJwYXJzZVJlc3BvbnNlRXJyb3IiLCJJbnZhbGlkQnVja2V0TmFtZUVycm9yIiwiY2FjaGVkIiwiZXh0cmFjdFJlZ2lvbkFzeW5jIiwicGFyc2VCdWNrZXRSZWdpb24iLCJuYW1lIiwiUmVnaW9uIiwibWFrZVJlcXVlc3QiLCJyZXR1cm5SZXNwb25zZSIsImNiIiwicHJvbSIsInRoZW4iLCJyZXN1bHQiLCJtYWtlUmVxdWVzdFN0cmVhbSIsImV4ZWN1dG9yIiwiZ2V0QnVja2V0UmVnaW9uIiwibWFrZUJ1Y2tldCIsIm1ha2VPcHRzIiwiYnVpbGRPYmplY3QiLCJDcmVhdGVCdWNrZXRDb25maWd1cmF0aW9uIiwiJCIsInhtbG5zIiwiTG9jYXRpb25Db25zdHJhaW50IiwiT2JqZWN0TG9ja2luZyIsImZpbmFsUmVnaW9uIiwicmVxdWVzdE9wdCIsIlMzRXJyb3IiLCJlcnJDb2RlIiwiY29kZSIsImVyclJlZ2lvbiIsImJ1Y2tldEV4aXN0cyIsInJlbW92ZUJ1Y2tldCIsImdldE9iamVjdCIsImdldE9wdHMiLCJJbnZhbGlkT2JqZWN0TmFtZUVycm9yIiwiZ2V0UGFydGlhbE9iamVjdCIsIm9mZnNldCIsInJhbmdlIiwiZXhwZWN0ZWRTdGF0dXNDb2RlcyIsInB1c2giLCJmR2V0T2JqZWN0IiwiZmlsZVBhdGgiLCJkb3dubG9hZFRvVG1wRmlsZSIsInBhcnRGaWxlU3RyZWFtIiwib2JqU3RhdCIsInN0YXRPYmplY3QiLCJwYXJ0RmlsZSIsImV0YWciLCJta2RpciIsImRpcm5hbWUiLCJyZWN1cnNpdmUiLCJzdGF0cyIsInN0YXQiLCJzaXplIiwiY3JlYXRlV3JpdGVTdHJlYW0iLCJmbGFncyIsImRvd25sb2FkU3RyZWFtIiwicGlwZWxpbmUiLCJyZW5hbWUiLCJzdGF0T3B0cyIsInBhcnNlSW50IiwibWV0YURhdGEiLCJsYXN0TW9kaWZpZWQiLCJ2ZXJzaW9uSWQiLCJyZW1vdmVPYmplY3QiLCJyZW1vdmVPcHRzIiwiZ292ZXJuYW5jZUJ5cGFzcyIsImZvcmNlRGVsZXRlIiwicXVlcnlQYXJhbXMiLCJsaXN0SW5jb21wbGV0ZVVwbG9hZHMiLCJidWNrZXQiLCJwcmVmaXgiLCJJbnZhbGlkUHJlZml4RXJyb3IiLCJkZWxpbWl0ZXIiLCJrZXlNYXJrZXIiLCJ1cGxvYWRJZE1hcmtlciIsInVwbG9hZHMiLCJlbmRlZCIsInJlYWRTdHJlYW0iLCJSZWFkYWJsZSIsIm9iamVjdE1vZGUiLCJfcmVhZCIsInNoaWZ0IiwibGlzdEluY29tcGxldGVVcGxvYWRzUXVlcnkiLCJwcmVmaXhlcyIsImVhY2hTZXJpZXMiLCJ1cGxvYWQiLCJsaXN0UGFydHMiLCJrZXkiLCJ1cGxvYWRJZCIsInBhcnRzIiwicmVkdWNlIiwiYWNjIiwiaXRlbSIsImVtaXQiLCJpc1RydW5jYXRlZCIsIm5leHRLZXlNYXJrZXIiLCJuZXh0VXBsb2FkSWRNYXJrZXIiLCJxdWVyaWVzIiwibWF4VXBsb2FkcyIsInNvcnQiLCJ1bnNoaWZ0Iiwiam9pbiIsInBhcnNlTGlzdE11bHRpcGFydCIsImluaXRpYXRlTmV3TXVsdGlwYXJ0VXBsb2FkIiwiYWJvcnRNdWx0aXBhcnRVcGxvYWQiLCJyZXF1ZXN0T3B0aW9ucyIsImZpbmRVcGxvYWRJZCIsIl9sYXRlc3RVcGxvYWQiLCJsYXRlc3RVcGxvYWQiLCJpbml0aWF0ZWQiLCJnZXRUaW1lIiwiY29tcGxldGVNdWx0aXBhcnRVcGxvYWQiLCJldGFncyIsImJ1aWxkZXIiLCJDb21wbGV0ZU11bHRpcGFydFVwbG9hZCIsIlBhcnQiLCJtYXAiLCJQYXJ0TnVtYmVyIiwicGFydCIsIkVUYWciLCJlcnJNZXNzYWdlIiwibWFya2VyIiwibGlzdFBhcnRzUXVlcnkiLCJwYXJzZUxpc3RQYXJ0cyIsImxpc3RCdWNrZXRzIiwiaHR0cFJlcyIsInhtbFJlc3VsdCIsInBhcnNlTGlzdEJ1Y2tldCIsImNhbGN1bGF0ZVBhcnRTaXplIiwiZlB1dE9iamVjdCIsImxzdGF0IiwicHV0T2JqZWN0IiwiY3JlYXRlUmVhZFN0cmVhbSIsInN0YXRTaXplIiwiYnVmIiwiZnJvbSIsInVwbG9hZEJ1ZmZlciIsInVwbG9hZFN0cmVhbSIsIm1kNXN1bSIsIm9sZFBhcnRzIiwiZVRhZ3MiLCJwcmV2aW91c1VwbG9hZElkIiwib2xkVGFncyIsImNodW5raWVyIiwiemVyb1BhZGRpbmciLCJvIiwiUHJvbWlzZSIsImFsbCIsInJlc29sdmUiLCJyZWplY3QiLCJwaXBlIiwib24iLCJwYXJ0TnVtYmVyIiwiY2h1bmsiLCJtZDUiLCJjcmVhdGVIYXNoIiwidXBkYXRlIiwiZGlnZXN0Iiwib2xkUGFydCIsInJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uIiwic2V0QnVja2V0UmVwbGljYXRpb24iLCJyZXBsaWNhdGlvbkNvbmZpZyIsInJvbGUiLCJydWxlcyIsInJlcGxpY2F0aW9uUGFyYW1zQ29uZmlnIiwiUmVwbGljYXRpb25Db25maWd1cmF0aW9uIiwiUm9sZSIsIlJ1bGUiLCJnZXRCdWNrZXRSZXBsaWNhdGlvbiIsInBhcnNlUmVwbGljYXRpb25Db25maWciLCJnZXRPYmplY3RMZWdhbEhvbGQiLCJrZXlzIiwic3RyUmVzIiwic2V0T2JqZWN0TGVnYWxIb2xkIiwic2V0T3B0cyIsInN0YXR1cyIsIkVOQUJMRUQiLCJESVNBQkxFRCIsImNvbmZpZyIsIlN0YXR1cyIsInJvb3ROYW1lIiwiZ2V0QnVja2V0VGFnZ2luZyIsInBhcnNlVGFnZ2luZyIsImdldE9iamVjdFRhZ2dpbmciLCJzZXRCdWNrZXRQb2xpY3kiLCJwb2xpY3kiLCJJbnZhbGlkQnVja2V0UG9saWN5RXJyb3IiLCJnZXRCdWNrZXRQb2xpY3kiLCJwdXRPYmplY3RSZXRlbnRpb24iLCJyZXRlbnRpb25PcHRzIiwibW9kZSIsIkNPTVBMSUFOQ0UiLCJHT1ZFUk5BTkNFIiwicmV0YWluVW50aWxEYXRlIiwiTW9kZSIsIlJldGFpblVudGlsRGF0ZSIsImdldE9iamVjdExvY2tDb25maWciLCJwYXJzZU9iamVjdExvY2tDb25maWciLCJzZXRPYmplY3RMb2NrQ29uZmlnIiwibG9ja0NvbmZpZ09wdHMiLCJyZXRlbnRpb25Nb2RlcyIsInZhbGlkVW5pdHMiLCJEQVlTIiwiWUVBUlMiLCJ1bml0IiwidmFsaWRpdHkiLCJPYmplY3RMb2NrRW5hYmxlZCIsImNvbmZpZ0tleXMiLCJpc0FsbEtleXNTZXQiLCJldmVyeSIsImxjayIsIkRlZmF1bHRSZXRlbnRpb24iLCJEYXlzIiwiWWVhcnMiLCJnZXRCdWNrZXRWZXJzaW9uaW5nIiwicGFyc2VCdWNrZXRWZXJzaW9uaW5nQ29uZmlnIiwic2V0QnVja2V0VmVyc2lvbmluZyIsInZlcnNpb25Db25maWciLCJzZXRUYWdnaW5nIiwidGFnZ2luZ1BhcmFtcyIsInRhZ3MiLCJwdXRPcHRzIiwidGFnc0xpc3QiLCJ2YWx1ZSIsIktleSIsIlZhbHVlIiwidGFnZ2luZ0NvbmZpZyIsIlRhZ2dpbmciLCJUYWdTZXQiLCJUYWciLCJwYXlsb2FkQnVmIiwicmVtb3ZlVGFnZ2luZyIsInNldEJ1Y2tldFRhZ2dpbmciLCJyZW1vdmVCdWNrZXRUYWdnaW5nIiwic2V0T2JqZWN0VGFnZ2luZyIsInJlbW92ZU9iamVjdFRhZ2dpbmciLCJzZWxlY3RPYmplY3RDb250ZW50Iiwic2VsZWN0T3B0cyIsImV4cHJlc3Npb24iLCJpbnB1dFNlcmlhbGl6YXRpb24iLCJvdXRwdXRTZXJpYWxpemF0aW9uIiwiRXhwcmVzc2lvbiIsIkV4cHJlc3Npb25UeXBlIiwiZXhwcmVzc2lvblR5cGUiLCJJbnB1dFNlcmlhbGl6YXRpb24iLCJPdXRwdXRTZXJpYWxpemF0aW9uIiwicmVxdWVzdFByb2dyZXNzIiwiUmVxdWVzdFByb2dyZXNzIiwic2NhblJhbmdlIiwiU2NhblJhbmdlIiwiYXBwbHlCdWNrZXRMaWZlY3ljbGUiLCJwb2xpY3lDb25maWciLCJyZW1vdmVCdWNrZXRMaWZlY3ljbGUiLCJzZXRCdWNrZXRMaWZlY3ljbGUiLCJsaWZlQ3ljbGVDb25maWciLCJnZXRCdWNrZXRMaWZlY3ljbGUiLCJwYXJzZUxpZmVjeWNsZUNvbmZpZyIsInNldEJ1Y2tldEVuY3J5cHRpb24iLCJlbmNyeXB0aW9uQ29uZmlnIiwiZW5jcnlwdGlvbk9iaiIsIkFwcGx5U2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQiLCJTU0VBbGdvcml0aG0iLCJnZXRCdWNrZXRFbmNyeXB0aW9uIiwicGFyc2VCdWNrZXRFbmNyeXB0aW9uQ29uZmlnIiwicmVtb3ZlQnVja2V0RW5jcnlwdGlvbiJdLCJzb3VyY2VzIjpbImNsaWVudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnbm9kZTpjcnlwdG8nXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzJ1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdub2RlOmh0dHAnXG5pbXBvcnQgKiBhcyBodHRwcyBmcm9tICdub2RlOmh0dHBzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgKiBhcyBzdHJlYW0gZnJvbSAnbm9kZTpzdHJlYW0nXG5cbmltcG9ydCAqIGFzIGFzeW5jIGZyb20gJ2FzeW5jJ1xuaW1wb3J0IEJsb2NrU3RyZWFtMiBmcm9tICdibG9jay1zdHJlYW0yJ1xuaW1wb3J0IHsgaXNCcm93c2VyIH0gZnJvbSAnYnJvd3Nlci1vci1ub2RlJ1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJ1xuaW1wb3J0ICogYXMgcXMgZnJvbSAncXVlcnktc3RyaW5nJ1xuaW1wb3J0IHhtbDJqcyBmcm9tICd4bWwyanMnXG5cbmltcG9ydCB7IENyZWRlbnRpYWxQcm92aWRlciB9IGZyb20gJy4uL0NyZWRlbnRpYWxQcm92aWRlci50cydcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi9lcnJvcnMudHMnXG5pbXBvcnQgdHlwZSB7IFNlbGVjdFJlc3VsdHMgfSBmcm9tICcuLi9oZWxwZXJzLnRzJ1xuaW1wb3J0IHsgREVGQVVMVF9SRUdJT04sIExFR0FMX0hPTERfU1RBVFVTLCBSRVRFTlRJT05fTU9ERVMsIFJFVEVOVElPTl9WQUxJRElUWV9VTklUUyB9IGZyb20gJy4uL2hlbHBlcnMudHMnXG5pbXBvcnQgeyBzaWduVjQgfSBmcm9tICcuLi9zaWduaW5nLnRzJ1xuaW1wb3J0IHsgZnNwLCBzdHJlYW1Qcm9taXNlIH0gZnJvbSAnLi9hc3luYy50cydcbmltcG9ydCB7IEV4dGVuc2lvbnMgfSBmcm9tICcuL2V4dGVuc2lvbnMudHMnXG5pbXBvcnQge1xuICBleHRyYWN0TWV0YWRhdGEsXG4gIGdldENvbnRlbnRMZW5ndGgsXG4gIGdldFZlcnNpb25JZCxcbiAgaGFzaEJpbmFyeSxcbiAgaW5zZXJ0Q29udGVudFR5cGUsXG4gIGlzQW1hem9uRW5kcG9pbnQsXG4gIGlzQm9vbGVhbixcbiAgaXNEZWZpbmVkLFxuICBpc0VtcHR5LFxuICBpc051bWJlcixcbiAgaXNPYmplY3QsXG4gIGlzUmVhZGFibGVTdHJlYW0sXG4gIGlzU3RyaW5nLFxuICBpc1ZhbGlkQnVja2V0TmFtZSxcbiAgaXNWYWxpZEVuZHBvaW50LFxuICBpc1ZhbGlkT2JqZWN0TmFtZSxcbiAgaXNWYWxpZFBvcnQsXG4gIGlzVmFsaWRQcmVmaXgsXG4gIGlzVmlydHVhbEhvc3RTdHlsZSxcbiAgbWFrZURhdGVMb25nLFxuICBwcmVwZW5kWEFNWk1ldGEsXG4gIHJlYWRhYmxlU3RyZWFtLFxuICBzYW5pdGl6ZUVUYWcsXG4gIHRvTWQ1LFxuICB0b1NoYTI1NixcbiAgdXJpRXNjYXBlLFxuICB1cmlSZXNvdXJjZUVzY2FwZSxcbn0gZnJvbSAnLi9oZWxwZXIudHMnXG5pbXBvcnQgeyBqb2luSG9zdFBvcnQgfSBmcm9tICcuL2pvaW4taG9zdC1wb3J0LnRzJ1xuaW1wb3J0IHsgcmVxdWVzdCB9IGZyb20gJy4vcmVxdWVzdC50cydcbmltcG9ydCB7IGRyYWluUmVzcG9uc2UsIHJlYWRBc0J1ZmZlciwgcmVhZEFzU3RyaW5nIH0gZnJvbSAnLi9yZXNwb25zZS50cydcbmltcG9ydCB0eXBlIHsgUmVnaW9uIH0gZnJvbSAnLi9zMy1lbmRwb2ludHMudHMnXG5pbXBvcnQgeyBnZXRTM0VuZHBvaW50IH0gZnJvbSAnLi9zMy1lbmRwb2ludHMudHMnXG5pbXBvcnQgdHlwZSB7XG4gIEJpbmFyeSxcbiAgQnVja2V0SXRlbUZyb21MaXN0LFxuICBCdWNrZXRJdGVtU3RhdCxcbiAgQnVja2V0U3RyZWFtLFxuICBCdWNrZXRWZXJzaW9uaW5nQ29uZmlndXJhdGlvbixcbiAgRW5jcnlwdGlvbkNvbmZpZyxcbiAgR2V0T2JqZWN0TGVnYWxIb2xkT3B0aW9ucyxcbiAgSW5jb21wbGV0ZVVwbG9hZGVkQnVja2V0SXRlbSxcbiAgSVJlcXVlc3QsXG4gIEl0ZW1CdWNrZXRNZXRhZGF0YSxcbiAgTGlmZWN5Y2xlQ29uZmlnLFxuICBMaWZlQ3ljbGVDb25maWdQYXJhbSxcbiAgT2JqZWN0TG9ja0NvbmZpZ1BhcmFtLFxuICBPYmplY3RMb2NrSW5mbyxcbiAgT2JqZWN0TWV0YURhdGEsXG4gIFB1dE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gIFB1dFRhZ2dpbmdQYXJhbXMsXG4gIFJlbW92ZVRhZ2dpbmdQYXJhbXMsXG4gIFJlcGxpY2F0aW9uQ29uZmlnLFxuICBSZXBsaWNhdGlvbkNvbmZpZ09wdHMsXG4gIFJlcXVlc3RIZWFkZXJzLFxuICBSZXNwb25zZUhlYWRlcixcbiAgUmVzdWx0Q2FsbGJhY2ssXG4gIFJldGVudGlvbixcbiAgU2VsZWN0T3B0aW9ucyxcbiAgU3RhdE9iamVjdE9wdHMsXG4gIFRhZyxcbiAgVGFnZ2luZ09wdHMsXG4gIFRhZ3MsXG4gIFRyYW5zcG9ydCxcbiAgVXBsb2FkZWRPYmplY3RJbmZvLFxuICBWZXJzaW9uSWRlbnRpZmljYXRvcixcbn0gZnJvbSAnLi90eXBlLnRzJ1xuaW1wb3J0IHR5cGUgeyBMaXN0TXVsdGlwYXJ0UmVzdWx0LCBVcGxvYWRlZFBhcnQgfSBmcm9tICcuL3htbC1wYXJzZXIudHMnXG5pbXBvcnQge1xuICBwYXJzZUNvbXBsZXRlTXVsdGlwYXJ0LFxuICBwYXJzZUluaXRpYXRlTXVsdGlwYXJ0LFxuICBwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyxcbiAgcGFyc2VTZWxlY3RPYmplY3RDb250ZW50UmVzcG9uc2UsXG59IGZyb20gJy4veG1sLXBhcnNlci50cydcbmltcG9ydCAqIGFzIHhtbFBhcnNlcnMgZnJvbSAnLi94bWwtcGFyc2VyLnRzJ1xuXG5jb25zdCB4bWwgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSwgaGVhZGxlc3M6IHRydWUgfSlcblxuLy8gd2lsbCBiZSByZXBsYWNlZCBieSBidW5kbGVyLlxuY29uc3QgUGFja2FnZSA9IHsgdmVyc2lvbjogcHJvY2Vzcy5lbnYuTUlOSU9fSlNfUEFDS0FHRV9WRVJTSU9OIHx8ICdkZXZlbG9wbWVudCcgfVxuXG5jb25zdCByZXF1ZXN0T3B0aW9uUHJvcGVydGllcyA9IFtcbiAgJ2FnZW50JyxcbiAgJ2NhJyxcbiAgJ2NlcnQnLFxuICAnY2lwaGVycycsXG4gICdjbGllbnRDZXJ0RW5naW5lJyxcbiAgJ2NybCcsXG4gICdkaHBhcmFtJyxcbiAgJ2VjZGhDdXJ2ZScsXG4gICdmYW1pbHknLFxuICAnaG9ub3JDaXBoZXJPcmRlcicsXG4gICdrZXknLFxuICAncGFzc3BocmFzZScsXG4gICdwZngnLFxuICAncmVqZWN0VW5hdXRob3JpemVkJyxcbiAgJ3NlY3VyZU9wdGlvbnMnLFxuICAnc2VjdXJlUHJvdG9jb2wnLFxuICAnc2VydmVybmFtZScsXG4gICdzZXNzaW9uSWRDb250ZXh0Jyxcbl0gYXMgY29uc3RcblxuZXhwb3J0IGludGVyZmFjZSBDbGllbnRPcHRpb25zIHtcbiAgZW5kUG9pbnQ6IHN0cmluZ1xuICBhY2Nlc3NLZXk6IHN0cmluZ1xuICBzZWNyZXRLZXk6IHN0cmluZ1xuICB1c2VTU0w/OiBib29sZWFuXG4gIHBvcnQ/OiBudW1iZXJcbiAgcmVnaW9uPzogUmVnaW9uXG4gIHRyYW5zcG9ydD86IFRyYW5zcG9ydFxuICBzZXNzaW9uVG9rZW4/OiBzdHJpbmdcbiAgcGFydFNpemU/OiBudW1iZXJcbiAgcGF0aFN0eWxlPzogYm9vbGVhblxuICBjcmVkZW50aWFsc1Byb3ZpZGVyPzogQ3JlZGVudGlhbFByb3ZpZGVyXG4gIHMzQWNjZWxlcmF0ZUVuZHBvaW50Pzogc3RyaW5nXG4gIHRyYW5zcG9ydEFnZW50PzogaHR0cC5BZ2VudFxufVxuXG5leHBvcnQgdHlwZSBSZXF1ZXN0T3B0aW9uID0gUGFydGlhbDxJUmVxdWVzdD4gJiB7XG4gIG1ldGhvZDogc3RyaW5nXG4gIGJ1Y2tldE5hbWU/OiBzdHJpbmdcbiAgb2JqZWN0TmFtZT86IHN0cmluZ1xuICBxdWVyeT86IHN0cmluZ1xuICBwYXRoU3R5bGU/OiBib29sZWFuXG59XG5cbmV4cG9ydCB0eXBlIE5vUmVzdWx0Q2FsbGJhY2sgPSAoZXJyb3I6IHVua25vd24pID0+IHZvaWRcblxuZXhwb3J0IGludGVyZmFjZSBNYWtlQnVja2V0T3B0IHtcbiAgT2JqZWN0TG9ja2luZz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZW1vdmVPcHRpb25zIHtcbiAgdmVyc2lvbklkPzogc3RyaW5nXG4gIGdvdmVybmFuY2VCeXBhc3M/OiBib29sZWFuXG4gIGZvcmNlRGVsZXRlPzogYm9vbGVhblxufVxuXG50eXBlIFBhcnQgPSB7XG4gIHBhcnQ6IG51bWJlclxuICBldGFnOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVkQ2xpZW50IHtcbiAgcHJvdGVjdGVkIHRyYW5zcG9ydDogVHJhbnNwb3J0XG4gIHByb3RlY3RlZCBob3N0OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHBvcnQ6IG51bWJlclxuICBwcm90ZWN0ZWQgcHJvdG9jb2w6IHN0cmluZ1xuICBwcm90ZWN0ZWQgYWNjZXNzS2V5OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHNlY3JldEtleTogc3RyaW5nXG4gIHByb3RlY3RlZCBzZXNzaW9uVG9rZW4/OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHVzZXJBZ2VudDogc3RyaW5nXG4gIHByb3RlY3RlZCBhbm9ueW1vdXM6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIHBhdGhTdHlsZTogYm9vbGVhblxuICBwcm90ZWN0ZWQgcmVnaW9uTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gIHB1YmxpYyByZWdpb24/OiBzdHJpbmdcbiAgcHJvdGVjdGVkIGNyZWRlbnRpYWxzUHJvdmlkZXI/OiBDcmVkZW50aWFsUHJvdmlkZXJcbiAgcGFydFNpemU6IG51bWJlciA9IDY0ICogMTAyNCAqIDEwMjRcbiAgcHJvdGVjdGVkIG92ZXJSaWRlUGFydFNpemU/OiBib29sZWFuXG5cbiAgcHJvdGVjdGVkIG1heGltdW1QYXJ0U2l6ZSA9IDUgKiAxMDI0ICogMTAyNCAqIDEwMjRcbiAgcHJvdGVjdGVkIG1heE9iamVjdFNpemUgPSA1ICogMTAyNCAqIDEwMjQgKiAxMDI0ICogMTAyNFxuICBwdWJsaWMgZW5hYmxlU0hBMjU2OiBib29sZWFuXG4gIHByb3RlY3RlZCBzM0FjY2VsZXJhdGVFbmRwb2ludD86IHN0cmluZ1xuICBwcm90ZWN0ZWQgcmVxT3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5cblxuICBwcm90ZWN0ZWQgdHJhbnNwb3J0QWdlbnQ6IGh0dHAuQWdlbnRcbiAgcHJpdmF0ZSByZWFkb25seSBjbGllbnRFeHRlbnNpb25zOiBFeHRlbnNpb25zXG5cbiAgY29uc3RydWN0b3IocGFyYW1zOiBDbGllbnRPcHRpb25zKSB7XG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciBkZXByZWNhdGVkIHByb3BlcnR5XG4gICAgaWYgKHBhcmFtcy5zZWN1cmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcInNlY3VyZVwiIG9wdGlvbiBkZXByZWNhdGVkLCBcInVzZVNTTFwiIHNob3VsZCBiZSB1c2VkIGluc3RlYWQnKVxuICAgIH1cbiAgICAvLyBEZWZhdWx0IHZhbHVlcyBpZiBub3Qgc3BlY2lmaWVkLlxuICAgIGlmIChwYXJhbXMudXNlU1NMID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmFtcy51c2VTU0wgPSB0cnVlXG4gICAgfVxuICAgIGlmICghcGFyYW1zLnBvcnQpIHtcbiAgICAgIHBhcmFtcy5wb3J0ID0gMFxuICAgIH1cbiAgICAvLyBWYWxpZGF0ZSBpbnB1dCBwYXJhbXMuXG4gICAgaWYgKCFpc1ZhbGlkRW5kcG9pbnQocGFyYW1zLmVuZFBvaW50KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkRW5kcG9pbnRFcnJvcihgSW52YWxpZCBlbmRQb2ludCA6ICR7cGFyYW1zLmVuZFBvaW50fWApXG4gICAgfVxuICAgIGlmICghaXNWYWxpZFBvcnQocGFyYW1zLnBvcnQpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHBvcnQgOiAke3BhcmFtcy5wb3J0fWApXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHBhcmFtcy51c2VTU0wpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKFxuICAgICAgICBgSW52YWxpZCB1c2VTU0wgZmxhZyB0eXBlIDogJHtwYXJhbXMudXNlU1NMfSwgZXhwZWN0ZWQgdG8gYmUgb2YgdHlwZSBcImJvb2xlYW5cImAsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgcmVnaW9uIG9ubHkgaWYgaXRzIHNldC5cbiAgICBpZiAocGFyYW1zLnJlZ2lvbikge1xuICAgICAgaWYgKCFpc1N0cmluZyhwYXJhbXMucmVnaW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHJlZ2lvbiA6ICR7cGFyYW1zLnJlZ2lvbn1gKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGhvc3QgPSBwYXJhbXMuZW5kUG9pbnQudG9Mb3dlckNhc2UoKVxuICAgIGxldCBwb3J0ID0gcGFyYW1zLnBvcnRcbiAgICBsZXQgcHJvdG9jb2w6IHN0cmluZ1xuICAgIGxldCB0cmFuc3BvcnRcbiAgICBsZXQgdHJhbnNwb3J0QWdlbnQ6IGh0dHAuQWdlbnRcbiAgICAvLyBWYWxpZGF0ZSBpZiBjb25maWd1cmF0aW9uIGlzIG5vdCB1c2luZyBTU0xcbiAgICAvLyBmb3IgY29uc3RydWN0aW5nIHJlbGV2YW50IGVuZHBvaW50cy5cbiAgICBpZiAocGFyYW1zLnVzZVNTTCkge1xuICAgICAgLy8gRGVmYXVsdHMgdG8gc2VjdXJlLlxuICAgICAgdHJhbnNwb3J0ID0gaHR0cHNcbiAgICAgIHByb3RvY29sID0gJ2h0dHBzOidcbiAgICAgIHBvcnQgPSBwb3J0IHx8IDQ0M1xuICAgICAgdHJhbnNwb3J0QWdlbnQgPSBodHRwcy5nbG9iYWxBZ2VudFxuICAgIH0gZWxzZSB7XG4gICAgICB0cmFuc3BvcnQgPSBodHRwXG4gICAgICBwcm90b2NvbCA9ICdodHRwOidcbiAgICAgIHBvcnQgPSBwb3J0IHx8IDgwXG4gICAgICB0cmFuc3BvcnRBZ2VudCA9IGh0dHAuZ2xvYmFsQWdlbnRcbiAgICB9XG5cbiAgICAvLyBpZiBjdXN0b20gdHJhbnNwb3J0IGlzIHNldCwgdXNlIGl0LlxuICAgIGlmIChwYXJhbXMudHJhbnNwb3J0KSB7XG4gICAgICBpZiAoIWlzT2JqZWN0KHBhcmFtcy50cmFuc3BvcnQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgICAgYEludmFsaWQgdHJhbnNwb3J0IHR5cGUgOiAke3BhcmFtcy50cmFuc3BvcnR9LCBleHBlY3RlZCB0byBiZSB0eXBlIFwib2JqZWN0XCJgLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICB0cmFuc3BvcnQgPSBwYXJhbXMudHJhbnNwb3J0XG4gICAgfVxuXG4gICAgLy8gaWYgY3VzdG9tIHRyYW5zcG9ydCBhZ2VudCBpcyBzZXQsIHVzZSBpdC5cbiAgICBpZiAocGFyYW1zLnRyYW5zcG9ydEFnZW50KSB7XG4gICAgICBpZiAoIWlzT2JqZWN0KHBhcmFtcy50cmFuc3BvcnRBZ2VudCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgICBgSW52YWxpZCB0cmFuc3BvcnRBZ2VudCB0eXBlOiAke3BhcmFtcy50cmFuc3BvcnRBZ2VudH0sIGV4cGVjdGVkIHRvIGJlIHR5cGUgXCJvYmplY3RcImAsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgdHJhbnNwb3J0QWdlbnQgPSBwYXJhbXMudHJhbnNwb3J0QWdlbnRcbiAgICB9XG5cbiAgICAvLyBVc2VyIEFnZW50IHNob3VsZCBhbHdheXMgZm9sbG93aW5nIHRoZSBiZWxvdyBzdHlsZS5cbiAgICAvLyBQbGVhc2Ugb3BlbiBhbiBpc3N1ZSB0byBkaXNjdXNzIGFueSBuZXcgY2hhbmdlcyBoZXJlLlxuICAgIC8vXG4gICAgLy8gICAgICAgTWluSU8gKE9TOyBBUkNIKSBMSUIvVkVSIEFQUC9WRVJcbiAgICAvL1xuICAgIGNvbnN0IGxpYnJhcnlDb21tZW50cyA9IGAoJHtwcm9jZXNzLnBsYXRmb3JtfTsgJHtwcm9jZXNzLmFyY2h9KWBcbiAgICBjb25zdCBsaWJyYXJ5QWdlbnQgPSBgTWluSU8gJHtsaWJyYXJ5Q29tbWVudHN9IG1pbmlvLWpzLyR7UGFja2FnZS52ZXJzaW9ufWBcbiAgICAvLyBVc2VyIGFnZW50IGJsb2NrIGVuZHMuXG5cbiAgICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydFxuICAgIHRoaXMudHJhbnNwb3J0QWdlbnQgPSB0cmFuc3BvcnRBZ2VudFxuICAgIHRoaXMuaG9zdCA9IGhvc3RcbiAgICB0aGlzLnBvcnQgPSBwb3J0XG4gICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sXG4gICAgdGhpcy51c2VyQWdlbnQgPSBgJHtsaWJyYXJ5QWdlbnR9YFxuXG4gICAgLy8gRGVmYXVsdCBwYXRoIHN0eWxlIGlzIHRydWVcbiAgICBpZiAocGFyYW1zLnBhdGhTdHlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnBhdGhTdHlsZSA9IHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXRoU3R5bGUgPSBwYXJhbXMucGF0aFN0eWxlXG4gICAgfVxuXG4gICAgdGhpcy5hY2Nlc3NLZXkgPSBwYXJhbXMuYWNjZXNzS2V5ID8/ICcnXG4gICAgdGhpcy5zZWNyZXRLZXkgPSBwYXJhbXMuc2VjcmV0S2V5ID8/ICcnXG4gICAgdGhpcy5zZXNzaW9uVG9rZW4gPSBwYXJhbXMuc2Vzc2lvblRva2VuXG4gICAgdGhpcy5hbm9ueW1vdXMgPSAhdGhpcy5hY2Nlc3NLZXkgfHwgIXRoaXMuc2VjcmV0S2V5XG5cbiAgICBpZiAocGFyYW1zLmNyZWRlbnRpYWxzUHJvdmlkZXIpIHtcbiAgICAgIHRoaXMuY3JlZGVudGlhbHNQcm92aWRlciA9IHBhcmFtcy5jcmVkZW50aWFsc1Byb3ZpZGVyXG4gICAgfVxuXG4gICAgdGhpcy5yZWdpb25NYXAgPSB7fVxuICAgIGlmIChwYXJhbXMucmVnaW9uKSB7XG4gICAgICB0aGlzLnJlZ2lvbiA9IHBhcmFtcy5yZWdpb25cbiAgICB9XG5cbiAgICBpZiAocGFyYW1zLnBhcnRTaXplKSB7XG4gICAgICB0aGlzLnBhcnRTaXplID0gcGFyYW1zLnBhcnRTaXplXG4gICAgICB0aGlzLm92ZXJSaWRlUGFydFNpemUgPSB0cnVlXG4gICAgfVxuICAgIGlmICh0aGlzLnBhcnRTaXplIDwgNSAqIDEwMjQgKiAxMDI0KSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBQYXJ0IHNpemUgc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiA1TUJgKVxuICAgIH1cbiAgICBpZiAodGhpcy5wYXJ0U2l6ZSA+IDUgKiAxMDI0ICogMTAyNCAqIDEwMjQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYFBhcnQgc2l6ZSBzaG91bGQgYmUgbGVzcyB0aGFuIDVHQmApXG4gICAgfVxuXG4gICAgLy8gU0hBMjU2IGlzIGVuYWJsZWQgb25seSBmb3IgYXV0aGVudGljYXRlZCBodHRwIHJlcXVlc3RzLiBJZiB0aGUgcmVxdWVzdCBpcyBhdXRoZW50aWNhdGVkXG4gICAgLy8gYW5kIHRoZSBjb25uZWN0aW9uIGlzIGh0dHBzIHdlIHVzZSB4LWFtei1jb250ZW50LXNoYTI1Nj1VTlNJR05FRC1QQVlMT0FEXG4gICAgLy8gaGVhZGVyIGZvciBzaWduYXR1cmUgY2FsY3VsYXRpb24uXG4gICAgdGhpcy5lbmFibGVTSEEyNTYgPSAhdGhpcy5hbm9ueW1vdXMgJiYgIXBhcmFtcy51c2VTU0xcblxuICAgIHRoaXMuczNBY2NlbGVyYXRlRW5kcG9pbnQgPSBwYXJhbXMuczNBY2NlbGVyYXRlRW5kcG9pbnQgfHwgdW5kZWZpbmVkXG4gICAgdGhpcy5yZXFPcHRpb25zID0ge31cbiAgICB0aGlzLmNsaWVudEV4dGVuc2lvbnMgPSBuZXcgRXh0ZW5zaW9ucyh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIE1pbmlvIGV4dGVuc2lvbnMgdGhhdCBhcmVuJ3QgbmVjZXNzYXJ5IHByZXNlbnQgZm9yIEFtYXpvbiBTMyBjb21wYXRpYmxlIHN0b3JhZ2Ugc2VydmVyc1xuICAgKi9cbiAgZ2V0IGV4dGVuc2lvbnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50RXh0ZW5zaW9uc1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBlbmRQb2ludCAtIHZhbGlkIFMzIGFjY2VsZXJhdGlvbiBlbmQgcG9pbnRcbiAgICovXG4gIHNldFMzVHJhbnNmZXJBY2NlbGVyYXRlKGVuZFBvaW50OiBzdHJpbmcpIHtcbiAgICB0aGlzLnMzQWNjZWxlcmF0ZUVuZHBvaW50ID0gZW5kUG9pbnRcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBzdXBwb3J0ZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgKi9cbiAgcHVibGljIHNldFJlcXVlc3RPcHRpb25zKG9wdGlvbnM6IFBpY2s8aHR0cHMuUmVxdWVzdE9wdGlvbnMsICh0eXBlb2YgcmVxdWVzdE9wdGlvblByb3BlcnRpZXMpW251bWJlcl0+KSB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxdWVzdCBvcHRpb25zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICB0aGlzLnJlcU9wdGlvbnMgPSBfLnBpY2sob3B0aW9ucywgcmVxdWVzdE9wdGlvblByb3BlcnRpZXMpXG4gIH1cblxuICAvKipcbiAgICogIFRoaXMgaXMgczMgU3BlY2lmaWMgYW5kIGRvZXMgbm90IGhvbGQgdmFsaWRpdHkgaW4gYW55IG90aGVyIE9iamVjdCBzdG9yYWdlLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBY2NlbGVyYXRlRW5kUG9pbnRJZlNldChidWNrZXROYW1lPzogc3RyaW5nLCBvYmplY3ROYW1lPzogc3RyaW5nKSB7XG4gICAgaWYgKCFpc0VtcHR5KHRoaXMuczNBY2NlbGVyYXRlRW5kcG9pbnQpICYmICFpc0VtcHR5KGJ1Y2tldE5hbWUpICYmICFpc0VtcHR5KG9iamVjdE5hbWUpKSB7XG4gICAgICAvLyBodHRwOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25TMy9sYXRlc3QvZGV2L3RyYW5zZmVyLWFjY2VsZXJhdGlvbi5odG1sXG4gICAgICAvLyBEaXNhYmxlIHRyYW5zZmVyIGFjY2VsZXJhdGlvbiBmb3Igbm9uLWNvbXBsaWFudCBidWNrZXQgbmFtZXMuXG4gICAgICBpZiAoYnVja2V0TmFtZS5pbmNsdWRlcygnLicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVHJhbnNmZXIgQWNjZWxlcmF0aW9uIGlzIG5vdCBzdXBwb3J0ZWQgZm9yIG5vbiBjb21wbGlhbnQgYnVja2V0OiR7YnVja2V0TmFtZX1gKVxuICAgICAgfVxuICAgICAgLy8gSWYgdHJhbnNmZXIgYWNjZWxlcmF0aW9uIGlzIHJlcXVlc3RlZCBzZXQgbmV3IGhvc3QuXG4gICAgICAvLyBGb3IgbW9yZSBkZXRhaWxzIGFib3V0IGVuYWJsaW5nIHRyYW5zZmVyIGFjY2VsZXJhdGlvbiByZWFkIGhlcmUuXG4gICAgICAvLyBodHRwOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25TMy9sYXRlc3QvZGV2L3RyYW5zZmVyLWFjY2VsZXJhdGlvbi5odG1sXG4gICAgICByZXR1cm4gdGhpcy5zM0FjY2VsZXJhdGVFbmRwb2ludFxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8qKlxuICAgKiByZXR1cm5zIG9wdGlvbnMgb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBodHRwLnJlcXVlc3QoKVxuICAgKiBUYWtlcyBjYXJlIG9mIGNvbnN0cnVjdGluZyB2aXJ0dWFsLWhvc3Qtc3R5bGUgb3IgcGF0aC1zdHlsZSBob3N0bmFtZVxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFJlcXVlc3RPcHRpb25zKFxuICAgIG9wdHM6IFJlcXVlc3RPcHRpb24gJiB7XG4gICAgICByZWdpb246IHN0cmluZ1xuICAgIH0sXG4gICk6IElSZXF1ZXN0ICYge1xuICAgIGhvc3Q6IHN0cmluZ1xuICAgIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cbiAgfSB7XG4gICAgY29uc3QgbWV0aG9kID0gb3B0cy5tZXRob2RcbiAgICBjb25zdCByZWdpb24gPSBvcHRzLnJlZ2lvblxuICAgIGNvbnN0IGJ1Y2tldE5hbWUgPSBvcHRzLmJ1Y2tldE5hbWVcbiAgICBsZXQgb2JqZWN0TmFtZSA9IG9wdHMub2JqZWN0TmFtZVxuICAgIGNvbnN0IGhlYWRlcnMgPSBvcHRzLmhlYWRlcnNcbiAgICBjb25zdCBxdWVyeSA9IG9wdHMucXVlcnlcblxuICAgIGxldCByZXFPcHRpb25zID0ge1xuICAgICAgbWV0aG9kLFxuICAgICAgaGVhZGVyczoge30gYXMgUmVxdWVzdEhlYWRlcnMsXG4gICAgICBwcm90b2NvbDogdGhpcy5wcm90b2NvbCxcbiAgICAgIC8vIElmIGN1c3RvbSB0cmFuc3BvcnRBZ2VudCB3YXMgc3VwcGxpZWQgZWFybGllciwgd2UnbGwgaW5qZWN0IGl0IGhlcmVcbiAgICAgIGFnZW50OiB0aGlzLnRyYW5zcG9ydEFnZW50LFxuICAgIH1cblxuICAgIC8vIFZlcmlmeSBpZiB2aXJ0dWFsIGhvc3Qgc3VwcG9ydGVkLlxuICAgIGxldCB2aXJ0dWFsSG9zdFN0eWxlXG4gICAgaWYgKGJ1Y2tldE5hbWUpIHtcbiAgICAgIHZpcnR1YWxIb3N0U3R5bGUgPSBpc1ZpcnR1YWxIb3N0U3R5bGUodGhpcy5ob3N0LCB0aGlzLnByb3RvY29sLCBidWNrZXROYW1lLCB0aGlzLnBhdGhTdHlsZSlcbiAgICB9XG5cbiAgICBsZXQgcGF0aCA9ICcvJ1xuICAgIGxldCBob3N0ID0gdGhpcy5ob3N0XG5cbiAgICBsZXQgcG9ydDogdW5kZWZpbmVkIHwgbnVtYmVyXG4gICAgaWYgKHRoaXMucG9ydCkge1xuICAgICAgcG9ydCA9IHRoaXMucG9ydFxuICAgIH1cblxuICAgIGlmIChvYmplY3ROYW1lKSB7XG4gICAgICBvYmplY3ROYW1lID0gdXJpUmVzb3VyY2VFc2NhcGUob2JqZWN0TmFtZSlcbiAgICB9XG5cbiAgICAvLyBGb3IgQW1hem9uIFMzIGVuZHBvaW50LCBnZXQgZW5kcG9pbnQgYmFzZWQgb24gcmVnaW9uLlxuICAgIGlmIChpc0FtYXpvbkVuZHBvaW50KGhvc3QpKSB7XG4gICAgICBjb25zdCBhY2NlbGVyYXRlRW5kUG9pbnQgPSB0aGlzLmdldEFjY2VsZXJhdGVFbmRQb2ludElmU2V0KGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUpXG4gICAgICBpZiAoYWNjZWxlcmF0ZUVuZFBvaW50KSB7XG4gICAgICAgIGhvc3QgPSBgJHthY2NlbGVyYXRlRW5kUG9pbnR9YFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaG9zdCA9IGdldFMzRW5kcG9pbnQocmVnaW9uKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh2aXJ0dWFsSG9zdFN0eWxlICYmICFvcHRzLnBhdGhTdHlsZSkge1xuICAgICAgLy8gRm9yIGFsbCBob3N0cyB3aGljaCBzdXBwb3J0IHZpcnR1YWwgaG9zdCBzdHlsZSwgYGJ1Y2tldE5hbWVgXG4gICAgICAvLyBpcyBwYXJ0IG9mIHRoZSBob3N0bmFtZSBpbiB0aGUgZm9sbG93aW5nIGZvcm1hdDpcbiAgICAgIC8vXG4gICAgICAvLyAgdmFyIGhvc3QgPSAnYnVja2V0TmFtZS5leGFtcGxlLmNvbSdcbiAgICAgIC8vXG4gICAgICBpZiAoYnVja2V0TmFtZSkge1xuICAgICAgICBob3N0ID0gYCR7YnVja2V0TmFtZX0uJHtob3N0fWBcbiAgICAgIH1cbiAgICAgIGlmIChvYmplY3ROYW1lKSB7XG4gICAgICAgIHBhdGggPSBgLyR7b2JqZWN0TmFtZX1gXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZvciBhbGwgUzMgY29tcGF0aWJsZSBzdG9yYWdlIHNlcnZpY2VzIHdlIHdpbGwgZmFsbGJhY2sgdG9cbiAgICAgIC8vIHBhdGggc3R5bGUgcmVxdWVzdHMsIHdoZXJlIGBidWNrZXROYW1lYCBpcyBwYXJ0IG9mIHRoZSBVUklcbiAgICAgIC8vIHBhdGguXG4gICAgICBpZiAoYnVja2V0TmFtZSkge1xuICAgICAgICBwYXRoID0gYC8ke2J1Y2tldE5hbWV9YFxuICAgICAgfVxuICAgICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgICAgcGF0aCA9IGAvJHtidWNrZXROYW1lfS8ke29iamVjdE5hbWV9YFxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChxdWVyeSkge1xuICAgICAgcGF0aCArPSBgPyR7cXVlcnl9YFxuICAgIH1cbiAgICByZXFPcHRpb25zLmhlYWRlcnMuaG9zdCA9IGhvc3RcbiAgICBpZiAoKHJlcU9wdGlvbnMucHJvdG9jb2wgPT09ICdodHRwOicgJiYgcG9ydCAhPT0gODApIHx8IChyZXFPcHRpb25zLnByb3RvY29sID09PSAnaHR0cHM6JyAmJiBwb3J0ICE9PSA0NDMpKSB7XG4gICAgICByZXFPcHRpb25zLmhlYWRlcnMuaG9zdCA9IGpvaW5Ib3N0UG9ydChob3N0LCBwb3J0KVxuICAgIH1cblxuICAgIHJlcU9wdGlvbnMuaGVhZGVyc1sndXNlci1hZ2VudCddID0gdGhpcy51c2VyQWdlbnRcbiAgICBpZiAoaGVhZGVycykge1xuICAgICAgLy8gaGF2ZSBhbGwgaGVhZGVyIGtleXMgaW4gbG93ZXIgY2FzZSAtIHRvIG1ha2Ugc2lnbmluZyBlYXN5XG4gICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhoZWFkZXJzKSkge1xuICAgICAgICByZXFPcHRpb25zLmhlYWRlcnNbay50b0xvd2VyQ2FzZSgpXSA9IHZcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2UgYW55IHJlcXVlc3Qgb3B0aW9uIHNwZWNpZmllZCBpbiBtaW5pb0NsaWVudC5zZXRSZXF1ZXN0T3B0aW9ucygpXG4gICAgcmVxT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucmVxT3B0aW9ucywgcmVxT3B0aW9ucylcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5yZXFPcHRpb25zLFxuICAgICAgaGVhZGVyczogXy5tYXBWYWx1ZXMoXy5waWNrQnkocmVxT3B0aW9ucy5oZWFkZXJzLCBpc0RlZmluZWQpLCAodikgPT4gdi50b1N0cmluZygpKSxcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgcGF0aCxcbiAgICB9IHNhdGlzZmllcyBodHRwcy5SZXF1ZXN0T3B0aW9uc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHNldENyZWRlbnRpYWxzUHJvdmlkZXIoY3JlZGVudGlhbHNQcm92aWRlcjogQ3JlZGVudGlhbFByb3ZpZGVyKSB7XG4gICAgaWYgKCEoY3JlZGVudGlhbHNQcm92aWRlciBpbnN0YW5jZW9mIENyZWRlbnRpYWxQcm92aWRlcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGdldCBjcmVkZW50aWFscy4gRXhwZWN0ZWQgaW5zdGFuY2Ugb2YgQ3JlZGVudGlhbFByb3ZpZGVyJylcbiAgICB9XG4gICAgdGhpcy5jcmVkZW50aWFsc1Byb3ZpZGVyID0gY3JlZGVudGlhbHNQcm92aWRlclxuICAgIGF3YWl0IHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjaGVja0FuZFJlZnJlc2hDcmVkcygpIHtcbiAgICBpZiAodGhpcy5jcmVkZW50aWFsc1Byb3ZpZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjcmVkZW50aWFsc0NvbmYgPSBhd2FpdCB0aGlzLmNyZWRlbnRpYWxzUHJvdmlkZXIuZ2V0Q3JlZGVudGlhbHMoKVxuICAgICAgICB0aGlzLmFjY2Vzc0tleSA9IGNyZWRlbnRpYWxzQ29uZi5nZXRBY2Nlc3NLZXkoKVxuICAgICAgICB0aGlzLnNlY3JldEtleSA9IGNyZWRlbnRpYWxzQ29uZi5nZXRTZWNyZXRLZXkoKVxuICAgICAgICB0aGlzLnNlc3Npb25Ub2tlbiA9IGNyZWRlbnRpYWxzQ29uZi5nZXRTZXNzaW9uVG9rZW4oKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBnZXQgY3JlZGVudGlhbHM6ICR7ZX1gLCB7IGNhdXNlOiBlIH0pXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBsb2dTdHJlYW0/OiBzdHJlYW0uV3JpdGFibGVcblxuICAvKipcbiAgICogbG9nIHRoZSByZXF1ZXN0LCByZXNwb25zZSwgZXJyb3JcbiAgICovXG4gIHByaXZhdGUgbG9nSFRUUChyZXFPcHRpb25zOiBJUmVxdWVzdCwgcmVzcG9uc2U6IGh0dHAuSW5jb21pbmdNZXNzYWdlIHwgbnVsbCwgZXJyPzogdW5rbm93bikge1xuICAgIC8vIGlmIG5vIGxvZ1N0cmVhbSBhdmFpbGFibGUgcmV0dXJuLlxuICAgIGlmICghdGhpcy5sb2dTdHJlYW0pIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KHJlcU9wdGlvbnMpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXFPcHRpb25zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAocmVzcG9uc2UgJiYgIWlzUmVhZGFibGVTdHJlYW0ocmVzcG9uc2UpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXNwb25zZSBzaG91bGQgYmUgb2YgdHlwZSBcIlN0cmVhbVwiJylcbiAgICB9XG4gICAgaWYgKGVyciAmJiAhKGVyciBpbnN0YW5jZW9mIEVycm9yKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZXJyIHNob3VsZCBiZSBvZiB0eXBlIFwiRXJyb3JcIicpXG4gICAgfVxuICAgIGNvbnN0IGxvZ1N0cmVhbSA9IHRoaXMubG9nU3RyZWFtXG4gICAgY29uc3QgbG9nSGVhZGVycyA9IChoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycykgPT4ge1xuICAgICAgT2JqZWN0LmVudHJpZXMoaGVhZGVycykuZm9yRWFjaCgoW2ssIHZdKSA9PiB7XG4gICAgICAgIGlmIChrID09ICdhdXRob3JpemF0aW9uJykge1xuICAgICAgICAgIGlmIChpc1N0cmluZyh2KSkge1xuICAgICAgICAgICAgY29uc3QgcmVkYWN0b3IgPSBuZXcgUmVnRXhwKCdTaWduYXR1cmU9KFswLTlhLWZdKyknKVxuICAgICAgICAgICAgdiA9IHYucmVwbGFjZShyZWRhY3RvciwgJ1NpZ25hdHVyZT0qKlJFREFDVEVEKionKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsb2dTdHJlYW0ud3JpdGUoYCR7a306ICR7dn1cXG5gKVxuICAgICAgfSlcbiAgICAgIGxvZ1N0cmVhbS53cml0ZSgnXFxuJylcbiAgICB9XG4gICAgbG9nU3RyZWFtLndyaXRlKGBSRVFVRVNUOiAke3JlcU9wdGlvbnMubWV0aG9kfSAke3JlcU9wdGlvbnMucGF0aH1cXG5gKVxuICAgIGxvZ0hlYWRlcnMocmVxT3B0aW9ucy5oZWFkZXJzKVxuICAgIGlmIChyZXNwb25zZSkge1xuICAgICAgdGhpcy5sb2dTdHJlYW0ud3JpdGUoYFJFU1BPTlNFOiAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9XFxuYClcbiAgICAgIGxvZ0hlYWRlcnMocmVzcG9uc2UuaGVhZGVycyBhcyBSZXF1ZXN0SGVhZGVycylcbiAgICB9XG4gICAgaWYgKGVycikge1xuICAgICAgbG9nU3RyZWFtLndyaXRlKCdFUlJPUiBCT0RZOlxcbicpXG4gICAgICBjb25zdCBlcnJKU09OID0gSlNPTi5zdHJpbmdpZnkoZXJyLCBudWxsLCAnXFx0JylcbiAgICAgIGxvZ1N0cmVhbS53cml0ZShgJHtlcnJKU09OfVxcbmApXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVuYWJsZSB0cmFjaW5nXG4gICAqL1xuICBwdWJsaWMgdHJhY2VPbihzdHJlYW0/OiBzdHJlYW0uV3JpdGFibGUpIHtcbiAgICBpZiAoIXN0cmVhbSkge1xuICAgICAgc3RyZWFtID0gcHJvY2Vzcy5zdGRvdXRcbiAgICB9XG4gICAgdGhpcy5sb2dTdHJlYW0gPSBzdHJlYW1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNhYmxlIHRyYWNpbmdcbiAgICovXG4gIHB1YmxpYyB0cmFjZU9mZigpIHtcbiAgICB0aGlzLmxvZ1N0cmVhbSA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLyoqXG4gICAqIG1ha2VSZXF1ZXN0IGlzIHRoZSBwcmltaXRpdmUgdXNlZCBieSB0aGUgYXBpcyBmb3IgbWFraW5nIFMzIHJlcXVlc3RzLlxuICAgKiBwYXlsb2FkIGNhbiBiZSBlbXB0eSBzdHJpbmcgaW4gY2FzZSBvZiBubyBwYXlsb2FkLlxuICAgKiBzdGF0dXNDb2RlIGlzIHRoZSBleHBlY3RlZCBzdGF0dXNDb2RlLiBJZiByZXNwb25zZS5zdGF0dXNDb2RlIGRvZXMgbm90IG1hdGNoXG4gICAqIHdlIHBhcnNlIHRoZSBYTUwgZXJyb3IgYW5kIGNhbGwgdGhlIGNhbGxiYWNrIHdpdGggdGhlIGVycm9yIG1lc3NhZ2UuXG4gICAqXG4gICAqIEEgdmFsaWQgcmVnaW9uIGlzIHBhc3NlZCBieSB0aGUgY2FsbHMgLSBsaXN0QnVja2V0cywgbWFrZUJ1Y2tldCBhbmQgZ2V0QnVja2V0UmVnaW9uLlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGFzeW5jIG1ha2VSZXF1ZXN0QXN5bmMoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBwYXlsb2FkOiBCaW5hcnkgPSAnJyxcbiAgICBleHBlY3RlZENvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICApOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPiB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9ucyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwYXlsb2FkKSAmJiAhaXNPYmplY3QocGF5bG9hZCkpIHtcbiAgICAgIC8vIEJ1ZmZlciBpcyBvZiB0eXBlICdvYmplY3QnXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwYXlsb2FkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCIgb3IgXCJCdWZmZXJcIicpXG4gICAgfVxuICAgIGV4cGVjdGVkQ29kZXMuZm9yRWFjaCgoc3RhdHVzQ29kZSkgPT4ge1xuICAgICAgaWYgKCFpc051bWJlcihzdGF0dXNDb2RlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdGF0dXNDb2RlIHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgICAgfVxuICAgIH0pXG4gICAgaWYgKCFpc1N0cmluZyhyZWdpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWdpb24gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICBvcHRpb25zLmhlYWRlcnMgPSB7fVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5tZXRob2QgPT09ICdQT1NUJyB8fCBvcHRpb25zLm1ldGhvZCA9PT0gJ1BVVCcgfHwgb3B0aW9ucy5tZXRob2QgPT09ICdERUxFVEUnKSB7XG4gICAgICBvcHRpb25zLmhlYWRlcnNbJ2NvbnRlbnQtbGVuZ3RoJ10gPSBwYXlsb2FkLmxlbmd0aC50b1N0cmluZygpXG4gICAgfVxuICAgIGNvbnN0IHNoYTI1NnN1bSA9IHRoaXMuZW5hYmxlU0hBMjU2ID8gdG9TaGEyNTYocGF5bG9hZCkgOiAnJ1xuICAgIHJldHVybiB0aGlzLm1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMob3B0aW9ucywgcGF5bG9hZCwgc2hhMjU2c3VtLCBleHBlY3RlZENvZGVzLCByZWdpb24pXG4gIH1cblxuICAvKipcbiAgICogbmV3IHJlcXVlc3Qgd2l0aCBwcm9taXNlXG4gICAqXG4gICAqIE5vIG5lZWQgdG8gZHJhaW4gcmVzcG9uc2UsIHJlc3BvbnNlIGJvZHkgaXMgbm90IHZhbGlkXG4gICAqL1xuICBhc3luYyBtYWtlUmVxdWVzdEFzeW5jT21pdChcbiAgICBvcHRpb25zOiBSZXF1ZXN0T3B0aW9uLFxuICAgIHBheWxvYWQ6IEJpbmFyeSA9ICcnLFxuICAgIHN0YXR1c0NvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICApOiBQcm9taXNlPE9taXQ8aHR0cC5JbmNvbWluZ01lc3NhZ2UsICdvbic+PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKG9wdGlvbnMsIHBheWxvYWQsIHN0YXR1c0NvZGVzLCByZWdpb24pXG4gICAgYXdhaXQgZHJhaW5SZXNwb25zZShyZXMpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgLyoqXG4gICAqIG1ha2VSZXF1ZXN0U3RyZWFtIHdpbGwgYmUgdXNlZCBkaXJlY3RseSBpbnN0ZWFkIG9mIG1ha2VSZXF1ZXN0IGluIGNhc2UgdGhlIHBheWxvYWRcbiAgICogaXMgYXZhaWxhYmxlIGFzIGEgc3RyZWFtLiBmb3IgZXguIHB1dE9iamVjdFxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGFzeW5jIG1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBib2R5OiBzdHJlYW0uUmVhZGFibGUgfCBCaW5hcnksXG4gICAgc2hhMjU2c3VtOiBzdHJpbmcsXG4gICAgc3RhdHVzQ29kZXM6IG51bWJlcltdLFxuICAgIHJlZ2lvbjogc3RyaW5nLFxuICApOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPiB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9ucyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKCEoQnVmZmVyLmlzQnVmZmVyKGJvZHkpIHx8IHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJyB8fCBpc1JlYWRhYmxlU3RyZWFtKGJvZHkpKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgYHN0cmVhbSBzaG91bGQgYmUgYSBCdWZmZXIsIHN0cmluZyBvciByZWFkYWJsZSBTdHJlYW0sIGdvdCAke3R5cGVvZiBib2R5fSBpbnN0ZWFkYCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhzaGEyNTZzdW0pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaGEyNTZzdW0gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIHN0YXR1c0NvZGVzLmZvckVhY2goKHN0YXR1c0NvZGUpID0+IHtcbiAgICAgIGlmICghaXNOdW1iZXIoc3RhdHVzQ29kZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhdHVzQ29kZSBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICAgIH1cbiAgICB9KVxuICAgIGlmICghaXNTdHJpbmcocmVnaW9uKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVnaW9uIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICAvLyBzaGEyNTZzdW0gd2lsbCBiZSBlbXB0eSBmb3IgYW5vbnltb3VzIG9yIGh0dHBzIHJlcXVlc3RzXG4gICAgaWYgKCF0aGlzLmVuYWJsZVNIQTI1NiAmJiBzaGEyNTZzdW0ubGVuZ3RoICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBzaGEyNTZzdW0gZXhwZWN0ZWQgdG8gYmUgZW1wdHkgZm9yIGFub255bW91cyBvciBodHRwcyByZXF1ZXN0c2ApXG4gICAgfVxuICAgIC8vIHNoYTI1NnN1bSBzaG91bGQgYmUgdmFsaWQgZm9yIG5vbi1hbm9ueW1vdXMgaHR0cCByZXF1ZXN0cy5cbiAgICBpZiAodGhpcy5lbmFibGVTSEEyNTYgJiYgc2hhMjU2c3VtLmxlbmd0aCAhPT0gNjQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYEludmFsaWQgc2hhMjU2c3VtIDogJHtzaGEyNTZzdW19YClcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmNoZWNrQW5kUmVmcmVzaENyZWRzKClcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgcmVnaW9uID0gcmVnaW9uIHx8IChhd2FpdCB0aGlzLmdldEJ1Y2tldFJlZ2lvbkFzeW5jKG9wdGlvbnMuYnVja2V0TmFtZSEpKVxuXG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuZ2V0UmVxdWVzdE9wdGlvbnMoeyAuLi5vcHRpb25zLCByZWdpb24gfSlcbiAgICBpZiAoIXRoaXMuYW5vbnltb3VzKSB7XG4gICAgICAvLyBGb3Igbm9uLWFub255bW91cyBodHRwcyByZXF1ZXN0cyBzaGEyNTZzdW0gaXMgJ1VOU0lHTkVELVBBWUxPQUQnIGZvciBzaWduYXR1cmUgY2FsY3VsYXRpb24uXG4gICAgICBpZiAoIXRoaXMuZW5hYmxlU0hBMjU2KSB7XG4gICAgICAgIHNoYTI1NnN1bSA9ICdVTlNJR05FRC1QQVlMT0FEJ1xuICAgICAgfVxuICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKClcbiAgICAgIHJlcU9wdGlvbnMuaGVhZGVyc1sneC1hbXotZGF0ZSddID0gbWFrZURhdGVMb25nKGRhdGUpXG4gICAgICByZXFPcHRpb25zLmhlYWRlcnNbJ3gtYW16LWNvbnRlbnQtc2hhMjU2J10gPSBzaGEyNTZzdW1cbiAgICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbikge1xuICAgICAgICByZXFPcHRpb25zLmhlYWRlcnNbJ3gtYW16LXNlY3VyaXR5LXRva2VuJ10gPSB0aGlzLnNlc3Npb25Ub2tlblxuICAgICAgfVxuICAgICAgcmVxT3B0aW9ucy5oZWFkZXJzLmF1dGhvcml6YXRpb24gPSBzaWduVjQocmVxT3B0aW9ucywgdGhpcy5hY2Nlc3NLZXksIHRoaXMuc2VjcmV0S2V5LCByZWdpb24sIGRhdGUsIHNoYTI1NnN1bSlcbiAgICB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3QodGhpcy50cmFuc3BvcnQsIHJlcU9wdGlvbnMsIGJvZHkpXG4gICAgaWYgKCFyZXNwb25zZS5zdGF0dXNDb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCVUc6IHJlc3BvbnNlIGRvZXNuJ3QgaGF2ZSBhIHN0YXR1c0NvZGVcIilcbiAgICB9XG5cbiAgICBpZiAoIXN0YXR1c0NvZGVzLmluY2x1ZGVzKHJlc3BvbnNlLnN0YXR1c0NvZGUpKSB7XG4gICAgICAvLyBGb3IgYW4gaW5jb3JyZWN0IHJlZ2lvbiwgUzMgc2VydmVyIGFsd2F5cyBzZW5kcyBiYWNrIDQwMC5cbiAgICAgIC8vIEJ1dCB3ZSB3aWxsIGRvIGNhY2hlIGludmFsaWRhdGlvbiBmb3IgYWxsIGVycm9ycyBzbyB0aGF0LFxuICAgICAgLy8gaW4gZnV0dXJlLCBpZiBBV1MgUzMgZGVjaWRlcyB0byBzZW5kIGEgZGlmZmVyZW50IHN0YXR1cyBjb2RlIG9yXG4gICAgICAvLyBYTUwgZXJyb3IgY29kZSB3ZSB3aWxsIHN0aWxsIHdvcmsgZmluZS5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBkZWxldGUgdGhpcy5yZWdpb25NYXBbb3B0aW9ucy5idWNrZXROYW1lIV1cblxuICAgICAgY29uc3QgZXJyID0gYXdhaXQgeG1sUGFyc2Vycy5wYXJzZVJlc3BvbnNlRXJyb3IocmVzcG9uc2UpXG4gICAgICB0aGlzLmxvZ0hUVFAocmVxT3B0aW9ucywgcmVzcG9uc2UsIGVycilcbiAgICAgIHRocm93IGVyclxuICAgIH1cblxuICAgIHRoaXMubG9nSFRUUChyZXFPcHRpb25zLCByZXNwb25zZSlcblxuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgLyoqXG4gICAqIGdldHMgdGhlIHJlZ2lvbiBvZiB0aGUgYnVja2V0XG4gICAqXG4gICAqIEBwYXJhbSBidWNrZXROYW1lXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEJ1Y2tldFJlZ2lvbkFzeW5jKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lIDogJHtidWNrZXROYW1lfWApXG4gICAgfVxuXG4gICAgLy8gUmVnaW9uIGlzIHNldCB3aXRoIGNvbnN0cnVjdG9yLCByZXR1cm4gdGhlIHJlZ2lvbiByaWdodCBoZXJlLlxuICAgIGlmICh0aGlzLnJlZ2lvbikge1xuICAgICAgcmV0dXJuIHRoaXMucmVnaW9uXG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5yZWdpb25NYXBbYnVja2V0TmFtZV1cbiAgICBpZiAoY2FjaGVkKSB7XG4gICAgICByZXR1cm4gY2FjaGVkXG4gICAgfVxuXG4gICAgY29uc3QgZXh0cmFjdFJlZ2lvbkFzeW5jID0gYXN5bmMgKHJlc3BvbnNlOiBodHRwLkluY29taW5nTWVzc2FnZSkgPT4ge1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXNwb25zZSlcbiAgICAgIGNvbnN0IHJlZ2lvbiA9IHhtbFBhcnNlcnMucGFyc2VCdWNrZXRSZWdpb24oYm9keSkgfHwgREVGQVVMVF9SRUdJT05cbiAgICAgIHRoaXMucmVnaW9uTWFwW2J1Y2tldE5hbWVdID0gcmVnaW9uXG4gICAgICByZXR1cm4gcmVnaW9uXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdsb2NhdGlvbidcbiAgICAvLyBgZ2V0QnVja2V0TG9jYXRpb25gIGJlaGF2ZXMgZGlmZmVyZW50bHkgaW4gZm9sbG93aW5nIHdheXMgZm9yXG4gICAgLy8gZGlmZmVyZW50IGVudmlyb25tZW50cy5cbiAgICAvL1xuICAgIC8vIC0gRm9yIG5vZGVqcyBlbnYgd2UgZGVmYXVsdCB0byBwYXRoIHN0eWxlIHJlcXVlc3RzLlxuICAgIC8vIC0gRm9yIGJyb3dzZXIgZW52IHBhdGggc3R5bGUgcmVxdWVzdHMgb24gYnVja2V0cyB5aWVsZHMgQ09SU1xuICAgIC8vICAgZXJyb3IuIFRvIGNpcmN1bXZlbnQgdGhpcyBwcm9ibGVtIHdlIG1ha2UgYSB2aXJ0dWFsIGhvc3RcbiAgICAvLyAgIHN0eWxlIHJlcXVlc3Qgc2lnbmVkIHdpdGggJ3VzLWVhc3QtMScuIFRoaXMgcmVxdWVzdCBmYWlsc1xuICAgIC8vICAgd2l0aCBhbiBlcnJvciAnQXV0aG9yaXphdGlvbkhlYWRlck1hbGZvcm1lZCcsIGFkZGl0aW9uYWxseVxuICAgIC8vICAgdGhlIGVycm9yIFhNTCBhbHNvIHByb3ZpZGVzIFJlZ2lvbiBvZiB0aGUgYnVja2V0LiBUbyB2YWxpZGF0ZVxuICAgIC8vICAgdGhpcyByZWdpb24gaXMgcHJvcGVyIHdlIHJldHJ5IHRoZSBzYW1lIHJlcXVlc3Qgd2l0aCB0aGUgbmV3bHlcbiAgICAvLyAgIG9idGFpbmVkIHJlZ2lvbi5cbiAgICBjb25zdCBwYXRoU3R5bGUgPSB0aGlzLnBhdGhTdHlsZSAmJiAhaXNCcm93c2VyXG4gICAgbGV0IHJlZ2lvbjogc3RyaW5nXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIHBhdGhTdHlsZSB9LCAnJywgWzIwMF0sIERFRkFVTFRfUkVHSU9OKVxuICAgICAgcmV0dXJuIGV4dHJhY3RSZWdpb25Bc3luYyhyZXMpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgaWYgKCEoZS5uYW1lID09PSAnQXV0aG9yaXphdGlvbkhlYWRlck1hbGZvcm1lZCcpKSB7XG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3Igd2Ugc2V0IGV4dHJhIHByb3BlcnRpZXMgb24gZXJyb3Igb2JqZWN0XG4gICAgICByZWdpb24gPSBlLlJlZ2lvbiBhcyBzdHJpbmdcbiAgICAgIGlmICghcmVnaW9uKSB7XG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5LCBwYXRoU3R5bGUgfSwgJycsIFsyMDBdLCByZWdpb24pXG4gICAgcmV0dXJuIGF3YWl0IGV4dHJhY3RSZWdpb25Bc3luYyhyZXMpXG4gIH1cblxuICAvKipcbiAgICogbWFrZVJlcXVlc3QgaXMgdGhlIHByaW1pdGl2ZSB1c2VkIGJ5IHRoZSBhcGlzIGZvciBtYWtpbmcgUzMgcmVxdWVzdHMuXG4gICAqIHBheWxvYWQgY2FuIGJlIGVtcHR5IHN0cmluZyBpbiBjYXNlIG9mIG5vIHBheWxvYWQuXG4gICAqIHN0YXR1c0NvZGUgaXMgdGhlIGV4cGVjdGVkIHN0YXR1c0NvZGUuIElmIHJlc3BvbnNlLnN0YXR1c0NvZGUgZG9lcyBub3QgbWF0Y2hcbiAgICogd2UgcGFyc2UgdGhlIFhNTCBlcnJvciBhbmQgY2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgZXJyb3IgbWVzc2FnZS5cbiAgICogQSB2YWxpZCByZWdpb24gaXMgcGFzc2VkIGJ5IHRoZSBjYWxscyAtIGxpc3RCdWNrZXRzLCBtYWtlQnVja2V0IGFuZFxuICAgKiBnZXRCdWNrZXRSZWdpb24uXG4gICAqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBgbWFrZVJlcXVlc3RBc3luY2AgaW5zdGVhZFxuICAgKi9cbiAgbWFrZVJlcXVlc3QoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBwYXlsb2FkOiBCaW5hcnkgPSAnJyxcbiAgICBleHBlY3RlZENvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICAgIHJldHVyblJlc3BvbnNlOiBib29sZWFuLFxuICAgIGNiOiAoY2I6IHVua25vd24sIHJlc3VsdDogaHR0cC5JbmNvbWluZ01lc3NhZ2UpID0+IHZvaWQsXG4gICkge1xuICAgIGxldCBwcm9tOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPlxuICAgIGlmIChyZXR1cm5SZXNwb25zZSkge1xuICAgICAgcHJvbSA9IHRoaXMubWFrZVJlcXVlc3RBc3luYyhvcHRpb25zLCBwYXlsb2FkLCBleHBlY3RlZENvZGVzLCByZWdpb24pXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgY29tcGF0aWJsZSBmb3Igb2xkIGJlaGF2aW91clxuICAgICAgcHJvbSA9IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQob3B0aW9ucywgcGF5bG9hZCwgZXhwZWN0ZWRDb2RlcywgcmVnaW9uKVxuICAgIH1cblxuICAgIHByb20udGhlbihcbiAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAoZXJyKSA9PiB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBjYihlcnIpXG4gICAgICB9LFxuICAgIClcbiAgfVxuXG4gIC8qKlxuICAgKiBtYWtlUmVxdWVzdFN0cmVhbSB3aWxsIGJlIHVzZWQgZGlyZWN0bHkgaW5zdGVhZCBvZiBtYWtlUmVxdWVzdCBpbiBjYXNlIHRoZSBwYXlsb2FkXG4gICAqIGlzIGF2YWlsYWJsZSBhcyBhIHN0cmVhbS4gZm9yIGV4LiBwdXRPYmplY3RcbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgdXNlIGBtYWtlUmVxdWVzdFN0cmVhbUFzeW5jYCBpbnN0ZWFkXG4gICAqL1xuICBtYWtlUmVxdWVzdFN0cmVhbShcbiAgICBvcHRpb25zOiBSZXF1ZXN0T3B0aW9uLFxuICAgIHN0cmVhbTogc3RyZWFtLlJlYWRhYmxlIHwgQnVmZmVyLFxuICAgIHNoYTI1NnN1bTogc3RyaW5nLFxuICAgIHN0YXR1c0NvZGVzOiBudW1iZXJbXSxcbiAgICByZWdpb246IHN0cmluZyxcbiAgICByZXR1cm5SZXNwb25zZTogYm9vbGVhbixcbiAgICBjYjogKGNiOiB1bmtub3duLCByZXN1bHQ6IGh0dHAuSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuICApIHtcbiAgICBjb25zdCBleGVjdXRvciA9IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RTdHJlYW1Bc3luYyhvcHRpb25zLCBzdHJlYW0sIHNoYTI1NnN1bSwgc3RhdHVzQ29kZXMsIHJlZ2lvbilcbiAgICAgIGlmICghcmV0dXJuUmVzcG9uc2UpIHtcbiAgICAgICAgYXdhaXQgZHJhaW5SZXNwb25zZShyZXMpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXNcbiAgICB9XG5cbiAgICBleGVjdXRvcigpLnRoZW4oXG4gICAgICAocmVzdWx0KSA9PiBjYihudWxsLCByZXN1bHQpLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgKGVycikgPT4gY2IoZXJyKSxcbiAgICApXG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIGBnZXRCdWNrZXRSZWdpb25Bc3luY2AgaW5zdGVhZFxuICAgKi9cbiAgZ2V0QnVja2V0UmVnaW9uKGJ1Y2tldE5hbWU6IHN0cmluZywgY2I6IChlcnI6IHVua25vd24sIHJlZ2lvbjogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QnVja2V0UmVnaW9uQXN5bmMoYnVja2V0TmFtZSkudGhlbihcbiAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAoZXJyKSA9PiBjYihlcnIpLFxuICAgIClcbiAgfVxuXG4gIC8vIEJ1Y2tldCBvcGVyYXRpb25zXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgdGhlIGJ1Y2tldCBgYnVja2V0TmFtZWAuXG4gICAqXG4gICAqL1xuICBhc3luYyBtYWtlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZywgcmVnaW9uOiBSZWdpb24gPSAnJywgbWFrZU9wdHM6IE1ha2VCdWNrZXRPcHQgPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIC8vIEJhY2t3YXJkIENvbXBhdGliaWxpdHlcbiAgICBpZiAoaXNPYmplY3QocmVnaW9uKSkge1xuICAgICAgbWFrZU9wdHMgPSByZWdpb25cbiAgICAgIHJlZ2lvbiA9ICcnXG4gICAgfVxuXG4gICAgaWYgKCFpc1N0cmluZyhyZWdpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWdpb24gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QobWFrZU9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtYWtlT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBsZXQgcGF5bG9hZCA9ICcnXG5cbiAgICAvLyBSZWdpb24gYWxyZWFkeSBzZXQgaW4gY29uc3RydWN0b3IsIHZhbGlkYXRlIGlmXG4gICAgLy8gY2FsbGVyIHJlcXVlc3RlZCBidWNrZXQgbG9jYXRpb24gaXMgc2FtZS5cbiAgICBpZiAocmVnaW9uICYmIHRoaXMucmVnaW9uKSB7XG4gICAgICBpZiAocmVnaW9uICE9PSB0aGlzLnJlZ2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBDb25maWd1cmVkIHJlZ2lvbiAke3RoaXMucmVnaW9ufSwgcmVxdWVzdGVkICR7cmVnaW9ufWApXG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNlbmRpbmcgbWFrZUJ1Y2tldCByZXF1ZXN0IHdpdGggWE1MIGNvbnRhaW5pbmcgJ3VzLWVhc3QtMScgZmFpbHMuIEZvclxuICAgIC8vIGRlZmF1bHQgcmVnaW9uIHNlcnZlciBleHBlY3RzIHRoZSByZXF1ZXN0IHdpdGhvdXQgYm9keVxuICAgIGlmIChyZWdpb24gJiYgcmVnaW9uICE9PSBERUZBVUxUX1JFR0lPTikge1xuICAgICAgcGF5bG9hZCA9IHhtbC5idWlsZE9iamVjdCh7XG4gICAgICAgIENyZWF0ZUJ1Y2tldENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAkOiB7IHhtbG5zOiAnaHR0cDovL3MzLmFtYXpvbmF3cy5jb20vZG9jLzIwMDYtMDMtMDEvJyB9LFxuICAgICAgICAgIExvY2F0aW9uQ29uc3RyYWludDogcmVnaW9uLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG5cbiAgICBpZiAobWFrZU9wdHMuT2JqZWN0TG9ja2luZykge1xuICAgICAgaGVhZGVyc1sneC1hbXotYnVja2V0LW9iamVjdC1sb2NrLWVuYWJsZWQnXSA9IHRydWVcbiAgICB9XG5cbiAgICBpZiAoIXJlZ2lvbikge1xuICAgICAgcmVnaW9uID0gREVGQVVMVF9SRUdJT05cbiAgICB9XG4gICAgY29uc3QgZmluYWxSZWdpb24gPSByZWdpb24gLy8gdHlwZSBuYXJyb3dcbiAgICBjb25zdCByZXF1ZXN0T3B0OiBSZXF1ZXN0T3B0aW9uID0geyBtZXRob2QsIGJ1Y2tldE5hbWUsIGhlYWRlcnMgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQocmVxdWVzdE9wdCwgcGF5bG9hZCwgWzIwMF0sIGZpbmFsUmVnaW9uKVxuICAgIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuICAgICAgaWYgKHJlZ2lvbiA9PT0gJycgfHwgcmVnaW9uID09PSBERUZBVUxUX1JFR0lPTikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgZXJyb3JzLlMzRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJDb2RlID0gZXJyLmNvZGVcbiAgICAgICAgICBjb25zdCBlcnJSZWdpb24gPSBlcnIucmVnaW9uXG4gICAgICAgICAgaWYgKGVyckNvZGUgPT09ICdBdXRob3JpemF0aW9uSGVhZGVyTWFsZm9ybWVkJyAmJiBlcnJSZWdpb24gIT09ICcnKSB7XG4gICAgICAgICAgICAvLyBSZXRyeSB3aXRoIHJlZ2lvbiByZXR1cm5lZCBhcyBwYXJ0IG9mIGVycm9yXG4gICAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHJlcXVlc3RPcHQsIHBheWxvYWQsIFsyMDBdLCBlcnJDb2RlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3cgZXJyXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRvIGNoZWNrIGlmIGEgYnVja2V0IGFscmVhZHkgZXhpc3RzLlxuICAgKi9cbiAgYXN5bmMgYnVja2V0RXhpc3RzKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdIRUFEJ1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBpZiAoZXJyLmNvZGUgPT09ICdOb1N1Y2hCdWNrZXQnIHx8IGVyci5jb2RlID09PSAnTm90Rm91bmQnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgdGhyb3cgZXJyXG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUJ1Y2tldChidWNrZXROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBwcm9taXNlIHN0eWxlIEFQSVxuICAgKi9cbiAgcmVtb3ZlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZywgY2FsbGJhY2s6IE5vUmVzdWx0Q2FsbGJhY2spOiB2b2lkXG5cbiAgYXN5bmMgcmVtb3ZlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSB9LCAnJywgWzIwNF0pXG4gICAgZGVsZXRlIHRoaXMucmVnaW9uTWFwW2J1Y2tldE5hbWVdXG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgaXMgY2FsbGVkIHdpdGggcmVhZGFibGUgc3RyZWFtIG9mIHRoZSBvYmplY3QgY29udGVudC5cbiAgICovXG4gIGFzeW5jIGdldE9iamVjdChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGdldE9wdHM6IFZlcnNpb25JZGVudGlmaWNhdG9yID0ge30sXG4gICk6IFByb21pc2U8c3RyZWFtLlJlYWRhYmxlPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZ2V0UGFydGlhbE9iamVjdChidWNrZXROYW1lLCBvYmplY3ROYW1lLCAwLCAwLCBnZXRPcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIGlzIGNhbGxlZCB3aXRoIHJlYWRhYmxlIHN0cmVhbSBvZiB0aGUgcGFydGlhbCBvYmplY3QgY29udGVudC5cbiAgICogQHBhcmFtIGJ1Y2tldE5hbWVcbiAgICogQHBhcmFtIG9iamVjdE5hbWVcbiAgICogQHBhcmFtIG9mZnNldFxuICAgKiBAcGFyYW0gbGVuZ3RoIC0gbGVuZ3RoIG9mIHRoZSBvYmplY3QgdGhhdCB3aWxsIGJlIHJlYWQgaW4gdGhlIHN0cmVhbSAob3B0aW9uYWwsIGlmIG5vdCBzcGVjaWZpZWQgd2UgcmVhZCB0aGUgcmVzdCBvZiB0aGUgZmlsZSBmcm9tIHRoZSBvZmZzZXQpXG4gICAqIEBwYXJhbSBnZXRPcHRzXG4gICAqL1xuICBhc3luYyBnZXRQYXJ0aWFsT2JqZWN0KFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgb2Zmc2V0OiBudW1iZXIsXG4gICAgbGVuZ3RoID0gMCxcbiAgICBnZXRPcHRzOiBWZXJzaW9uSWRlbnRpZmljYXRvciA9IHt9LFxuICApOiBQcm9taXNlPHN0cmVhbS5SZWFkYWJsZT4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIob2Zmc2V0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb2Zmc2V0IHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgIH1cbiAgICBpZiAoIWlzTnVtYmVyKGxlbmd0aCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xlbmd0aCBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG5cbiAgICBsZXQgcmFuZ2UgPSAnJ1xuICAgIGlmIChvZmZzZXQgfHwgbGVuZ3RoKSB7XG4gICAgICBpZiAob2Zmc2V0KSB7XG4gICAgICAgIHJhbmdlID0gYGJ5dGVzPSR7K29mZnNldH0tYFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmFuZ2UgPSAnYnl0ZXM9MC0nXG4gICAgICAgIG9mZnNldCA9IDBcbiAgICAgIH1cbiAgICAgIGlmIChsZW5ndGgpIHtcbiAgICAgICAgcmFuZ2UgKz0gYCR7K2xlbmd0aCArIG9mZnNldCAtIDF9YFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzID0ge31cbiAgICBpZiAocmFuZ2UgIT09ICcnKSB7XG4gICAgICBoZWFkZXJzLnJhbmdlID0gcmFuZ2VcbiAgICB9XG5cbiAgICBjb25zdCBleHBlY3RlZFN0YXR1c0NvZGVzID0gWzIwMF1cbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIGV4cGVjdGVkU3RhdHVzQ29kZXMucHVzaCgyMDYpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdHRVQnXG5cbiAgICBjb25zdCBxdWVyeSA9IHFzLnN0cmluZ2lmeShnZXRPcHRzKVxuICAgIHJldHVybiBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGhlYWRlcnMsIHF1ZXJ5IH0sICcnLCBleHBlY3RlZFN0YXR1c0NvZGVzKVxuICB9XG5cbiAgLyoqXG4gICAqIGRvd25sb2FkIG9iamVjdCBjb250ZW50IHRvIGEgZmlsZS5cbiAgICogVGhpcyBtZXRob2Qgd2lsbCBjcmVhdGUgYSB0ZW1wIGZpbGUgbmFtZWQgYCR7ZmlsZW5hbWV9LiR7ZXRhZ30ucGFydC5taW5pb2Agd2hlbiBkb3dubG9hZGluZy5cbiAgICpcbiAgICogQHBhcmFtIGJ1Y2tldE5hbWUgLSBuYW1lIG9mIHRoZSBidWNrZXRcbiAgICogQHBhcmFtIG9iamVjdE5hbWUgLSBuYW1lIG9mIHRoZSBvYmplY3RcbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gcGF0aCB0byB3aGljaCB0aGUgb2JqZWN0IGRhdGEgd2lsbCBiZSB3cml0dGVuIHRvXG4gICAqIEBwYXJhbSBnZXRPcHRzIC0gT3B0aW9uYWwgb2JqZWN0IGdldCBvcHRpb25cbiAgICovXG4gIGFzeW5jIGZHZXRPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGdldE9wdHM6IFZlcnNpb25JZGVudGlmaWNhdG9yID0ge30pIHtcbiAgICAvLyBJbnB1dCB2YWxpZGF0aW9uLlxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoZmlsZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdmaWxlUGF0aCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG5cbiAgICBjb25zdCBkb3dubG9hZFRvVG1wRmlsZSA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgICAgbGV0IHBhcnRGaWxlU3RyZWFtOiBzdHJlYW0uV3JpdGFibGVcbiAgICAgIGNvbnN0IG9ialN0YXQgPSBhd2FpdCB0aGlzLnN0YXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZ2V0T3B0cylcbiAgICAgIGNvbnN0IHBhcnRGaWxlID0gYCR7ZmlsZVBhdGh9LiR7b2JqU3RhdC5ldGFnfS5wYXJ0Lm1pbmlvYFxuXG4gICAgICBhd2FpdCBmc3AubWtkaXIocGF0aC5kaXJuYW1lKGZpbGVQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSlcblxuICAgICAgbGV0IG9mZnNldCA9IDBcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnNwLnN0YXQocGFydEZpbGUpXG4gICAgICAgIGlmIChvYmpTdGF0LnNpemUgPT09IHN0YXRzLnNpemUpIHtcbiAgICAgICAgICByZXR1cm4gcGFydEZpbGVcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgPSBzdGF0cy5zaXplXG4gICAgICAgIHBhcnRGaWxlU3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ocGFydEZpbGUsIHsgZmxhZ3M6ICdhJyB9KVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIChlIGFzIHVua25vd24gYXMgeyBjb2RlOiBzdHJpbmcgfSkuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgICAgICAvLyBmaWxlIG5vdCBleGlzdFxuICAgICAgICAgIHBhcnRGaWxlU3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ocGFydEZpbGUsIHsgZmxhZ3M6ICd3JyB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyIGVycm9yLCBtYXliZSBhY2Nlc3MgZGVueVxuICAgICAgICAgIHRocm93IGVcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBkb3dubG9hZFN0cmVhbSA9IGF3YWl0IHRoaXMuZ2V0UGFydGlhbE9iamVjdChidWNrZXROYW1lLCBvYmplY3ROYW1lLCBvZmZzZXQsIDAsIGdldE9wdHMpXG5cbiAgICAgIGF3YWl0IHN0cmVhbVByb21pc2UucGlwZWxpbmUoZG93bmxvYWRTdHJlYW0sIHBhcnRGaWxlU3RyZWFtKVxuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmc3Auc3RhdChwYXJ0RmlsZSlcbiAgICAgIGlmIChzdGF0cy5zaXplID09PSBvYmpTdGF0LnNpemUpIHtcbiAgICAgICAgcmV0dXJuIHBhcnRGaWxlXG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcignU2l6ZSBtaXNtYXRjaCBiZXR3ZWVuIGRvd25sb2FkZWQgZmlsZSBhbmQgdGhlIG9iamVjdCcpXG4gICAgfVxuXG4gICAgY29uc3QgcGFydEZpbGUgPSBhd2FpdCBkb3dubG9hZFRvVG1wRmlsZSgpXG4gICAgYXdhaXQgZnNwLnJlbmFtZShwYXJ0RmlsZSwgZmlsZVBhdGgpXG4gIH1cblxuICAvKipcbiAgICogU3RhdCBpbmZvcm1hdGlvbiBvZiB0aGUgb2JqZWN0LlxuICAgKi9cbiAgYXN5bmMgc3RhdE9iamVjdChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgc3RhdE9wdHM6IFN0YXRPYmplY3RPcHRzID0ge30pOiBQcm9taXNlPEJ1Y2tldEl0ZW1TdGF0PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHN0YXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignc3RhdE9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgY29uc3QgcXVlcnkgPSBxcy5zdHJpbmdpZnkoc3RhdE9wdHMpXG4gICAgY29uc3QgbWV0aG9kID0gJ0hFQUQnXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfSlcblxuICAgIHJldHVybiB7XG4gICAgICBzaXplOiBwYXJzZUludChyZXMuaGVhZGVyc1snY29udGVudC1sZW5ndGgnXSBhcyBzdHJpbmcpLFxuICAgICAgbWV0YURhdGE6IGV4dHJhY3RNZXRhZGF0YShyZXMuaGVhZGVycyBhcyBSZXNwb25zZUhlYWRlciksXG4gICAgICBsYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKHJlcy5oZWFkZXJzWydsYXN0LW1vZGlmaWVkJ10gYXMgc3RyaW5nKSxcbiAgICAgIHZlcnNpb25JZDogZ2V0VmVyc2lvbklkKHJlcy5oZWFkZXJzIGFzIFJlc3BvbnNlSGVhZGVyKSxcbiAgICAgIGV0YWc6IHNhbml0aXplRVRhZyhyZXMuaGVhZGVycy5ldGFnKSxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBzcGVjaWZpZWQgb2JqZWN0LlxuICAgKiBAZGVwcmVjYXRlZCB1c2UgbmV3IHByb21pc2Ugc3R5bGUgQVBJXG4gICAqL1xuICByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM6IFJlbW92ZU9wdGlvbnMsIGNhbGxiYWNrOiBOb1Jlc3VsdENhbGxiYWNrKTogdm9pZFxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIG5ldyBwcm9taXNlIHN0eWxlIEFQSVxuICAgKi9cbiAgLy8gQHRzLWlnbm9yZVxuICByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBOb1Jlc3VsdENhbGxiYWNrKTogdm9pZFxuICBhc3luYyByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM/OiBSZW1vdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPlxuXG4gIGFzeW5jIHJlbW92ZU9iamVjdChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgcmVtb3ZlT3B0czogUmVtb3ZlT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHJlbW92ZU9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdyZW1vdmVPcHRzIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG4gICAgaWYgKHJlbW92ZU9wdHMuZ292ZXJuYW5jZUJ5cGFzcykge1xuICAgICAgaGVhZGVyc1snWC1BbXotQnlwYXNzLUdvdmVybmFuY2UtUmV0ZW50aW9uJ10gPSB0cnVlXG4gICAgfVxuICAgIGlmIChyZW1vdmVPcHRzLmZvcmNlRGVsZXRlKSB7XG4gICAgICBoZWFkZXJzWyd4LW1pbmlvLWZvcmNlLWRlbGV0ZSddID0gdHJ1ZVxuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5UGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICBpZiAocmVtb3ZlT3B0cy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5UGFyYW1zLnZlcnNpb25JZCA9IGAke3JlbW92ZU9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgcXVlcnkgPSBxcy5zdHJpbmdpZnkocXVlcnlQYXJhbXMpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzLCBxdWVyeSB9LCAnJywgWzIwMCwgMjA0XSlcbiAgfVxuXG4gIC8vIENhbGxzIGltcGxlbWVudGVkIGJlbG93IGFyZSByZWxhdGVkIHRvIG11bHRpcGFydC5cblxuICBsaXN0SW5jb21wbGV0ZVVwbG9hZHMoXG4gICAgYnVja2V0OiBzdHJpbmcsXG4gICAgcHJlZml4OiBzdHJpbmcsXG4gICAgcmVjdXJzaXZlOiBib29sZWFuLFxuICApOiBCdWNrZXRTdHJlYW08SW5jb21wbGV0ZVVwbG9hZGVkQnVja2V0SXRlbT4ge1xuICAgIGlmIChwcmVmaXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcHJlZml4ID0gJydcbiAgICB9XG4gICAgaWYgKHJlY3Vyc2l2ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZWN1cnNpdmUgPSBmYWxzZVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkUHJlZml4KHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBJbnZhbGlkIHByZWZpeCA6ICR7cHJlZml4fWApXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHJlY3Vyc2l2ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3JlY3Vyc2l2ZSBzaG91bGQgYmUgb2YgdHlwZSBcImJvb2xlYW5cIicpXG4gICAgfVxuICAgIGNvbnN0IGRlbGltaXRlciA9IHJlY3Vyc2l2ZSA/ICcnIDogJy8nXG4gICAgbGV0IGtleU1hcmtlciA9ICcnXG4gICAgbGV0IHVwbG9hZElkTWFya2VyID0gJydcbiAgICBjb25zdCB1cGxvYWRzOiB1bmtub3duW10gPSBbXVxuICAgIGxldCBlbmRlZCA9IGZhbHNlXG5cbiAgICAvLyBUT0RPOiByZWZhY3RvciB0aGlzIHdpdGggYXN5bmMvYXdhaXQgYW5kIGBzdHJlYW0uUmVhZGFibGUuZnJvbWBcbiAgICBjb25zdCByZWFkU3RyZWFtID0gbmV3IHN0cmVhbS5SZWFkYWJsZSh7IG9iamVjdE1vZGU6IHRydWUgfSlcbiAgICByZWFkU3RyZWFtLl9yZWFkID0gKCkgPT4ge1xuICAgICAgLy8gcHVzaCBvbmUgdXBsb2FkIGluZm8gcGVyIF9yZWFkKClcbiAgICAgIGlmICh1cGxvYWRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKHVwbG9hZHMuc2hpZnQoKSlcbiAgICAgIH1cbiAgICAgIGlmIChlbmRlZCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKG51bGwpXG4gICAgICB9XG4gICAgICB0aGlzLmxpc3RJbmNvbXBsZXRlVXBsb2Fkc1F1ZXJ5KGJ1Y2tldCwgcHJlZml4LCBrZXlNYXJrZXIsIHVwbG9hZElkTWFya2VyLCBkZWxpbWl0ZXIpLnRoZW4oXG4gICAgICAgIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgIHJlc3VsdC5wcmVmaXhlcy5mb3JFYWNoKChwcmVmaXgpID0+IHVwbG9hZHMucHVzaChwcmVmaXgpKVxuICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXMoXG4gICAgICAgICAgICByZXN1bHQudXBsb2FkcyxcbiAgICAgICAgICAgICh1cGxvYWQsIGNiKSA9PiB7XG4gICAgICAgICAgICAgIC8vIGZvciBlYWNoIGluY29tcGxldGUgdXBsb2FkIGFkZCB0aGUgc2l6ZXMgb2YgaXRzIHVwbG9hZGVkIHBhcnRzXG4gICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICB0aGlzLmxpc3RQYXJ0cyhidWNrZXQsIHVwbG9hZC5rZXksIHVwbG9hZC51cGxvYWRJZCkudGhlbihcbiAgICAgICAgICAgICAgICAocGFydHM6IFBhcnRbXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgdXBsb2FkLnNpemUgPSBwYXJ0cy5yZWR1Y2UoKGFjYywgaXRlbSkgPT4gYWNjICsgaXRlbS5zaXplLCAwKVxuICAgICAgICAgICAgICAgICAgdXBsb2Fkcy5wdXNoKHVwbG9hZClcbiAgICAgICAgICAgICAgICAgIGNiKClcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIChlcnI6IEVycm9yKSA9PiBjYihlcnIpLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKGVycikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVhZFN0cmVhbS5lbWl0KCdlcnJvcicsIGVycilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAocmVzdWx0LmlzVHJ1bmNhdGVkKSB7XG4gICAgICAgICAgICAgICAga2V5TWFya2VyID0gcmVzdWx0Lm5leHRLZXlNYXJrZXJcbiAgICAgICAgICAgICAgICB1cGxvYWRJZE1hcmtlciA9IHJlc3VsdC5uZXh0VXBsb2FkSWRNYXJrZXJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICByZWFkU3RyZWFtLl9yZWFkKClcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICB9LFxuICAgICAgICAoZSkgPT4ge1xuICAgICAgICAgIHJlYWRTdHJlYW0uZW1pdCgnZXJyb3InLCBlKVxuICAgICAgICB9LFxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gcmVhZFN0cmVhbVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBieSBsaXN0SW5jb21wbGV0ZVVwbG9hZHMgdG8gZmV0Y2ggYSBiYXRjaCBvZiBpbmNvbXBsZXRlIHVwbG9hZHMuXG4gICAqL1xuICBhc3luYyBsaXN0SW5jb21wbGV0ZVVwbG9hZHNRdWVyeShcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgcHJlZml4OiBzdHJpbmcsXG4gICAga2V5TWFya2VyOiBzdHJpbmcsXG4gICAgdXBsb2FkSWRNYXJrZXI6IHN0cmluZyxcbiAgICBkZWxpbWl0ZXI6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxMaXN0TXVsdGlwYXJ0UmVzdWx0PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwcmVmaXgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVmaXggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoa2V5TWFya2VyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigna2V5TWFya2VyIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHVwbG9hZElkTWFya2VyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndXBsb2FkSWRNYXJrZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoZGVsaW1pdGVyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZGVsaW1pdGVyIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBjb25zdCBxdWVyaWVzID0gW11cbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoZGVsaW1pdGVyKX1gKVxuXG4gICAgaWYgKGtleU1hcmtlcikge1xuICAgICAgcXVlcmllcy5wdXNoKGBrZXktbWFya2VyPSR7dXJpRXNjYXBlKGtleU1hcmtlcil9YClcbiAgICB9XG4gICAgaWYgKHVwbG9hZElkTWFya2VyKSB7XG4gICAgICBxdWVyaWVzLnB1c2goYHVwbG9hZC1pZC1tYXJrZXI9JHt1cGxvYWRJZE1hcmtlcn1gKVxuICAgIH1cblxuICAgIGNvbnN0IG1heFVwbG9hZHMgPSAxMDAwXG4gICAgcXVlcmllcy5wdXNoKGBtYXgtdXBsb2Fkcz0ke21heFVwbG9hZHN9YClcbiAgICBxdWVyaWVzLnNvcnQoKVxuICAgIHF1ZXJpZXMudW5zaGlmdCgndXBsb2FkcycpXG4gICAgbGV0IHF1ZXJ5ID0gJydcbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyeSA9IGAke3F1ZXJpZXMuam9pbignJicpfWBcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0TXVsdGlwYXJ0KGJvZHkpXG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhdGUgYSBuZXcgbXVsdGlwYXJ0IHVwbG9hZC5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBhc3luYyBpbml0aWF0ZU5ld011bHRpcGFydFVwbG9hZChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QoaGVhZGVycykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcignY29udGVudFR5cGUgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ3VwbG9hZHMnXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBxdWVyeSwgaGVhZGVycyB9KVxuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkQXNCdWZmZXIocmVzKVxuICAgIHJldHVybiBwYXJzZUluaXRpYXRlTXVsdGlwYXJ0KGJvZHkudG9TdHJpbmcoKSlcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBNZXRob2QgdG8gYWJvcnQgYSBtdWx0aXBhcnQgdXBsb2FkIHJlcXVlc3QgaW4gY2FzZSBvZiBhbnkgZXJyb3JzLlxuICAgKlxuICAgKiBAcGFyYW0gYnVja2V0TmFtZSAtIEJ1Y2tldCBOYW1lXG4gICAqIEBwYXJhbSBvYmplY3ROYW1lIC0gT2JqZWN0IE5hbWVcbiAgICogQHBhcmFtIHVwbG9hZElkIC0gaWQgb2YgYSBtdWx0aXBhcnQgdXBsb2FkIHRvIGNhbmNlbCBkdXJpbmcgY29tcG9zZSBvYmplY3Qgc2VxdWVuY2UuXG4gICAqL1xuICBhc3luYyBhYm9ydE11bHRpcGFydFVwbG9hZChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgdXBsb2FkSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cGxvYWRJZH1gXG5cbiAgICBjb25zdCByZXF1ZXN0T3B0aW9ucyA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lOiBvYmplY3ROYW1lLCBxdWVyeSB9XG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdChyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDRdKVxuICB9XG5cbiAgYXN5bmMgZmluZFVwbG9hZElkKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cblxuICAgIGxldCBsYXRlc3RVcGxvYWQ6IExpc3RNdWx0aXBhcnRSZXN1bHRbJ3VwbG9hZHMnXVtudW1iZXJdIHwgdW5kZWZpbmVkXG4gICAgbGV0IGtleU1hcmtlciA9ICcnXG4gICAgbGV0IHVwbG9hZElkTWFya2VyID0gJydcbiAgICBmb3IgKDs7KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxpc3RJbmNvbXBsZXRlVXBsb2Fkc1F1ZXJ5KGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGtleU1hcmtlciwgdXBsb2FkSWRNYXJrZXIsICcnKVxuICAgICAgZm9yIChjb25zdCB1cGxvYWQgb2YgcmVzdWx0LnVwbG9hZHMpIHtcbiAgICAgICAgaWYgKHVwbG9hZC5rZXkgPT09IG9iamVjdE5hbWUpIHtcbiAgICAgICAgICBpZiAoIWxhdGVzdFVwbG9hZCB8fCB1cGxvYWQuaW5pdGlhdGVkLmdldFRpbWUoKSA+IGxhdGVzdFVwbG9hZC5pbml0aWF0ZWQuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICBsYXRlc3RVcGxvYWQgPSB1cGxvYWRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuaXNUcnVuY2F0ZWQpIHtcbiAgICAgICAga2V5TWFya2VyID0gcmVzdWx0Lm5leHRLZXlNYXJrZXJcbiAgICAgICAgdXBsb2FkSWRNYXJrZXIgPSByZXN1bHQubmV4dFVwbG9hZElkTWFya2VyXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHJldHVybiBsYXRlc3RVcGxvYWQ/LnVwbG9hZElkXG4gIH1cblxuICAvKipcbiAgICogdGhpcyBjYWxsIHdpbGwgYWdncmVnYXRlIHRoZSBwYXJ0cyBvbiB0aGUgc2VydmVyIGludG8gYSBzaW5nbGUgb2JqZWN0LlxuICAgKi9cbiAgYXN5bmMgY29tcGxldGVNdWx0aXBhcnRVcGxvYWQoXG4gICAgYnVja2V0TmFtZTogc3RyaW5nLFxuICAgIG9iamVjdE5hbWU6IHN0cmluZyxcbiAgICB1cGxvYWRJZDogc3RyaW5nLFxuICAgIGV0YWdzOiB7XG4gICAgICBwYXJ0OiBudW1iZXJcbiAgICAgIGV0YWc/OiBzdHJpbmdcbiAgICB9W10sXG4gICk6IFByb21pc2U8eyBldGFnOiBzdHJpbmc7IHZlcnNpb25JZDogc3RyaW5nIHwgbnVsbCB9PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyh1cGxvYWRJZCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3VwbG9hZElkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGV0YWdzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZXRhZ3Mgc2hvdWxkIGJlIG9mIHR5cGUgXCJBcnJheVwiJylcbiAgICB9XG5cbiAgICBpZiAoIXVwbG9hZElkKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCd1cGxvYWRJZCBjYW5ub3QgYmUgZW1wdHknKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gYHVwbG9hZElkPSR7dXJpRXNjYXBlKHVwbG9hZElkKX1gXG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKClcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdCh7XG4gICAgICBDb21wbGV0ZU11bHRpcGFydFVwbG9hZDoge1xuICAgICAgICAkOiB7XG4gICAgICAgICAgeG1sbnM6ICdodHRwOi8vczMuYW1hem9uYXdzLmNvbS9kb2MvMjAwNi0wMy0wMS8nLFxuICAgICAgICB9LFxuICAgICAgICBQYXJ0OiBldGFncy5tYXAoKGV0YWcpID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgUGFydE51bWJlcjogZXRhZy5wYXJ0LFxuICAgICAgICAgICAgRVRhZzogZXRhZy5ldGFnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc0J1ZmZlcihyZXMpXG4gICAgY29uc3QgcmVzdWx0ID0gcGFyc2VDb21wbGV0ZU11bHRpcGFydChib2R5LnRvU3RyaW5nKCkpXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQlVHOiBmYWlsZWQgdG8gcGFyc2Ugc2VydmVyIHJlc3BvbnNlJylcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0LmVyckNvZGUpIHtcbiAgICAgIC8vIE11bHRpcGFydCBDb21wbGV0ZSBBUEkgcmV0dXJucyBhbiBlcnJvciBYTUwgYWZ0ZXIgYSAyMDAgaHR0cCBzdGF0dXNcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuUzNFcnJvcihyZXN1bHQuZXJyTWVzc2FnZSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgZXRhZzogcmVzdWx0LmV0YWcgYXMgc3RyaW5nLFxuICAgICAgdmVyc2lvbklkOiBnZXRWZXJzaW9uSWQocmVzLmhlYWRlcnMgYXMgUmVzcG9uc2VIZWFkZXIpLFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcGFydC1pbmZvIG9mIGFsbCBwYXJ0cyBvZiBhbiBpbmNvbXBsZXRlIHVwbG9hZCBzcGVjaWZpZWQgYnkgdXBsb2FkSWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgbGlzdFBhcnRzKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nLCB1cGxvYWRJZDogc3RyaW5nKTogUHJvbWlzZTxVcGxvYWRlZFBhcnRbXT4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcodXBsb2FkSWQpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd1cGxvYWRJZCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCF1cGxvYWRJZCkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndXBsb2FkSWQgY2Fubm90IGJlIGVtcHR5JylcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0czogVXBsb2FkZWRQYXJ0W10gPSBbXVxuICAgIGxldCBtYXJrZXIgPSAwXG4gICAgbGV0IHJlc3VsdFxuICAgIGRvIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMubGlzdFBhcnRzUXVlcnkoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdXBsb2FkSWQsIG1hcmtlcilcbiAgICAgIG1hcmtlciA9IHJlc3VsdC5tYXJrZXJcbiAgICAgIHBhcnRzLnB1c2goLi4ucmVzdWx0LnBhcnRzKVxuICAgIH0gd2hpbGUgKHJlc3VsdC5pc1RydW5jYXRlZClcblxuICAgIHJldHVybiBwYXJ0c1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBieSBsaXN0UGFydHMgdG8gZmV0Y2ggYSBiYXRjaCBvZiBwYXJ0LWluZm9cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgbGlzdFBhcnRzUXVlcnkoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHVwbG9hZElkOiBzdHJpbmcsIG1hcmtlcjogbnVtYmVyKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyh1cGxvYWRJZCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3VwbG9hZElkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzTnVtYmVyKG1hcmtlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ21hcmtlciBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG4gICAgaWYgKCF1cGxvYWRJZCkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndXBsb2FkSWQgY2Fubm90IGJlIGVtcHR5JylcbiAgICB9XG5cbiAgICBsZXQgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cmlFc2NhcGUodXBsb2FkSWQpfWBcbiAgICBpZiAobWFya2VyKSB7XG4gICAgICBxdWVyeSArPSBgJnBhcnQtbnVtYmVyLW1hcmtlcj0ke21hcmtlcn1gXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0pXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0UGFydHMoYXdhaXQgcmVhZEFzU3RyaW5nKHJlcykpXG4gIH1cblxuICBhc3luYyBsaXN0QnVja2V0cygpOiBQcm9taXNlPEJ1Y2tldEl0ZW1Gcm9tTGlzdFtdPiB7XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBodHRwUmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKHsgbWV0aG9kIH0sICcnLCBbMjAwXSwgdGhpcy5yZWdpb24gPz8gJycpXG4gICAgY29uc3QgeG1sUmVzdWx0ID0gYXdhaXQgcmVhZEFzU3RyaW5nKGh0dHBSZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0QnVja2V0KHhtbFJlc3VsdClcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGUgcGFydCBzaXplIGdpdmVuIHRoZSBvYmplY3Qgc2l6ZS4gUGFydCBzaXplIHdpbGwgYmUgYXRsZWFzdCB0aGlzLnBhcnRTaXplXG4gICAqL1xuICBjYWxjdWxhdGVQYXJ0U2l6ZShzaXplOiBudW1iZXIpIHtcbiAgICBpZiAoIWlzTnVtYmVyKHNpemUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaXplIHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgIH1cbiAgICBpZiAoc2l6ZSA+IHRoaXMubWF4T2JqZWN0U2l6ZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgc2l6ZSBzaG91bGQgbm90IGJlIG1vcmUgdGhhbiAke3RoaXMubWF4T2JqZWN0U2l6ZX1gKVxuICAgIH1cbiAgICBpZiAodGhpcy5vdmVyUmlkZVBhcnRTaXplKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJ0U2l6ZVxuICAgIH1cbiAgICBsZXQgcGFydFNpemUgPSB0aGlzLnBhcnRTaXplXG4gICAgZm9yICg7Oykge1xuICAgICAgLy8gd2hpbGUodHJ1ZSkgey4uLn0gdGhyb3dzIGxpbnRpbmcgZXJyb3IuXG4gICAgICAvLyBJZiBwYXJ0U2l6ZSBpcyBiaWcgZW5vdWdoIHRvIGFjY29tb2RhdGUgdGhlIG9iamVjdCBzaXplLCB0aGVuIHVzZSBpdC5cbiAgICAgIGlmIChwYXJ0U2l6ZSAqIDEwMDAwID4gc2l6ZSkge1xuICAgICAgICByZXR1cm4gcGFydFNpemVcbiAgICAgIH1cbiAgICAgIC8vIFRyeSBwYXJ0IHNpemVzIGFzIDY0TUIsIDgwTUIsIDk2TUIgZXRjLlxuICAgICAgcGFydFNpemUgKz0gMTYgKiAxMDI0ICogMTAyNFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGxvYWRzIHRoZSBvYmplY3QgdXNpbmcgY29udGVudHMgZnJvbSBhIGZpbGVcbiAgICovXG4gIGFzeW5jIGZQdXRPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIG1ldGFEYXRhOiBPYmplY3RNZXRhRGF0YSA9IHt9KSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzU3RyaW5nKGZpbGVQYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZmlsZVBhdGggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QobWV0YURhdGEpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtZXRhRGF0YSBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICAvLyBJbnNlcnRzIGNvcnJlY3QgYGNvbnRlbnQtdHlwZWAgYXR0cmlidXRlIGJhc2VkIG9uIG1ldGFEYXRhIGFuZCBmaWxlUGF0aFxuICAgIG1ldGFEYXRhID0gaW5zZXJ0Q29udGVudFR5cGUobWV0YURhdGEsIGZpbGVQYXRoKVxuICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBmc3AubHN0YXQoZmlsZVBhdGgpXG4gICAgYXdhaXQgdGhpcy5wdXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlUGF0aCksIHN0YXQuc2l6ZSwgbWV0YURhdGEpXG4gIH1cblxuICAvKipcbiAgICogIFVwbG9hZGluZyBhIHN0cmVhbSwgXCJCdWZmZXJcIiBvciBcInN0cmluZ1wiLlxuICAgKiAgSXQncyByZWNvbW1lbmRlZCB0byBwYXNzIGBzaXplYCBhcmd1bWVudCB3aXRoIHN0cmVhbS5cbiAgICovXG4gIGFzeW5jIHB1dE9iamVjdChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIHN0cmVhbTogc3RyZWFtLlJlYWRhYmxlIHwgQnVmZmVyIHwgc3RyaW5nLFxuICAgIHNpemU/OiBudW1iZXIsXG4gICAgbWV0YURhdGE/OiBJdGVtQnVja2V0TWV0YWRhdGEsXG4gICk6IFByb21pc2U8VXBsb2FkZWRPYmplY3RJbmZvPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICAvLyBXZSdsbCBuZWVkIHRvIHNoaWZ0IGFyZ3VtZW50cyB0byB0aGUgbGVmdCBiZWNhdXNlIG9mIG1ldGFEYXRhXG4gICAgLy8gYW5kIHNpemUgYmVpbmcgb3B0aW9uYWwuXG4gICAgaWYgKGlzT2JqZWN0KHNpemUpKSB7XG4gICAgICBtZXRhRGF0YSA9IHNpemVcbiAgICB9XG4gICAgLy8gRW5zdXJlcyBNZXRhZGF0YSBoYXMgYXBwcm9wcmlhdGUgcHJlZml4IGZvciBBMyBBUElcbiAgICBjb25zdCBoZWFkZXJzID0gcHJlcGVuZFhBTVpNZXRhKG1ldGFEYXRhKVxuICAgIGlmICh0eXBlb2Ygc3RyZWFtID09PSAnc3RyaW5nJyB8fCBzdHJlYW0gaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgIC8vIEFkYXB0cyB0aGUgbm9uLXN0cmVhbSBpbnRlcmZhY2UgaW50byBhIHN0cmVhbS5cbiAgICAgIHNpemUgPSBzdHJlYW0ubGVuZ3RoXG4gICAgICBzdHJlYW0gPSByZWFkYWJsZVN0cmVhbShzdHJlYW0pXG4gICAgfSBlbHNlIGlmICghaXNSZWFkYWJsZVN0cmVhbShzdHJlYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd0aGlyZCBhcmd1bWVudCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmVhbS5SZWFkYWJsZVwiIG9yIFwiQnVmZmVyXCIgb3IgXCJzdHJpbmdcIicpXG4gICAgfVxuXG4gICAgaWYgKGlzTnVtYmVyKHNpemUpICYmIHNpemUgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBzaXplIGNhbm5vdCBiZSBuZWdhdGl2ZSwgZ2l2ZW4gc2l6ZTogJHtzaXplfWApXG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBwYXJ0IHNpemUgYW5kIGZvcndhcmQgdGhhdCB0byB0aGUgQmxvY2tTdHJlYW0uIERlZmF1bHQgdG8gdGhlXG4gICAgLy8gbGFyZ2VzdCBibG9jayBzaXplIHBvc3NpYmxlIGlmIG5lY2Vzc2FyeS5cbiAgICBpZiAoIWlzTnVtYmVyKHNpemUpKSB7XG4gICAgICBzaXplID0gdGhpcy5tYXhPYmplY3RTaXplXG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBwYXJ0IHNpemUgYW5kIGZvcndhcmQgdGhhdCB0byB0aGUgQmxvY2tTdHJlYW0uIERlZmF1bHQgdG8gdGhlXG4gICAgLy8gbGFyZ2VzdCBibG9jayBzaXplIHBvc3NpYmxlIGlmIG5lY2Vzc2FyeS5cbiAgICBpZiAoc2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBzdGF0U2l6ZSA9IGF3YWl0IGdldENvbnRlbnRMZW5ndGgoc3RyZWFtKVxuICAgICAgaWYgKHN0YXRTaXplICE9PSBudWxsKSB7XG4gICAgICAgIHNpemUgPSBzdGF0U2l6ZVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaXNOdW1iZXIoc2l6ZSkpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICAgIHNpemUgPSB0aGlzLm1heE9iamVjdFNpemVcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0U2l6ZSA9IHRoaXMuY2FsY3VsYXRlUGFydFNpemUoc2l6ZSlcbiAgICBpZiAodHlwZW9mIHN0cmVhbSA9PT0gJ3N0cmluZycgfHwgQnVmZmVyLmlzQnVmZmVyKHN0cmVhbSkgfHwgc2l6ZSA8PSBwYXJ0U2l6ZSkge1xuICAgICAgY29uc3QgYnVmID0gaXNSZWFkYWJsZVN0cmVhbShzdHJlYW0pID8gYXdhaXQgcmVhZEFzQnVmZmVyKHN0cmVhbSkgOiBCdWZmZXIuZnJvbShzdHJlYW0pXG4gICAgICByZXR1cm4gdGhpcy51cGxvYWRCdWZmZXIoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycywgYnVmKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwbG9hZFN0cmVhbShidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzLCBzdHJlYW0sIHBhcnRTaXplKVxuICB9XG5cbiAgLyoqXG4gICAqIG1ldGhvZCB0byB1cGxvYWQgYnVmZmVyIGluIG9uZSBjYWxsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHVwbG9hZEJ1ZmZlcihcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzLFxuICAgIGJ1ZjogQnVmZmVyLFxuICApOiBQcm9taXNlPFVwbG9hZGVkT2JqZWN0SW5mbz4ge1xuICAgIGNvbnN0IHsgbWQ1c3VtLCBzaGEyNTZzdW0gfSA9IGhhc2hCaW5hcnkoYnVmLCB0aGlzLmVuYWJsZVNIQTI1NilcbiAgICBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddID0gYnVmLmxlbmd0aFxuICAgIGlmICghdGhpcy5lbmFibGVTSEEyNTYpIHtcbiAgICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSBtZDVzdW1cbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdFN0cmVhbUFzeW5jKFxuICAgICAge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBidWNrZXROYW1lLFxuICAgICAgICBvYmplY3ROYW1lLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIGJ1ZixcbiAgICAgIHNoYTI1NnN1bSxcbiAgICAgIFsyMDBdLFxuICAgICAgJycsXG4gICAgKVxuICAgIGF3YWl0IGRyYWluUmVzcG9uc2UocmVzKVxuICAgIHJldHVybiB7XG4gICAgICBldGFnOiBzYW5pdGl6ZUVUYWcocmVzLmhlYWRlcnMuZXRhZyksXG4gICAgICB2ZXJzaW9uSWQ6IGdldFZlcnNpb25JZChyZXMuaGVhZGVycyBhcyBSZXNwb25zZUhlYWRlciksXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIHVwbG9hZCBzdHJlYW0gd2l0aCBNdWx0aXBhcnRVcGxvYWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdXBsb2FkU3RyZWFtKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMsXG4gICAgYm9keTogc3RyZWFtLlJlYWRhYmxlLFxuICAgIHBhcnRTaXplOiBudW1iZXIsXG4gICk6IFByb21pc2U8VXBsb2FkZWRPYmplY3RJbmZvPiB7XG4gICAgLy8gQSBtYXAgb2YgdGhlIHByZXZpb3VzbHkgdXBsb2FkZWQgY2h1bmtzLCBmb3IgcmVzdW1pbmcgYSBmaWxlIHVwbG9hZC4gVGhpc1xuICAgIC8vIHdpbGwgYmUgbnVsbCBpZiB3ZSBhcmVuJ3QgcmVzdW1pbmcgYW4gdXBsb2FkLlxuICAgIGNvbnN0IG9sZFBhcnRzOiBSZWNvcmQ8bnVtYmVyLCBQYXJ0PiA9IHt9XG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBldGFncyBmb3IgYWdncmVnYXRpbmcgdGhlIGNodW5rcyB0b2dldGhlciBsYXRlci4gRWFjaFxuICAgIC8vIGV0YWcgcmVwcmVzZW50cyBhIHNpbmdsZSBjaHVuayBvZiB0aGUgZmlsZS5cbiAgICBjb25zdCBlVGFnczogUGFydFtdID0gW11cblxuICAgIGNvbnN0IHByZXZpb3VzVXBsb2FkSWQgPSBhd2FpdCB0aGlzLmZpbmRVcGxvYWRJZChidWNrZXROYW1lLCBvYmplY3ROYW1lKVxuICAgIGxldCB1cGxvYWRJZDogc3RyaW5nXG4gICAgaWYgKCFwcmV2aW91c1VwbG9hZElkKSB7XG4gICAgICB1cGxvYWRJZCA9IGF3YWl0IHRoaXMuaW5pdGlhdGVOZXdNdWx0aXBhcnRVcGxvYWQoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycylcbiAgICB9IGVsc2Uge1xuICAgICAgdXBsb2FkSWQgPSBwcmV2aW91c1VwbG9hZElkXG4gICAgICBjb25zdCBvbGRUYWdzID0gYXdhaXQgdGhpcy5saXN0UGFydHMoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcHJldmlvdXNVcGxvYWRJZClcbiAgICAgIG9sZFRhZ3MuZm9yRWFjaCgoZSkgPT4ge1xuICAgICAgICBvbGRUYWdzW2UucGFydF0gPSBlXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IGNodW5raWVyID0gbmV3IEJsb2NrU3RyZWFtMih7IHNpemU6IHBhcnRTaXplLCB6ZXJvUGFkZGluZzogZmFsc2UgfSlcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICBjb25zdCBbXywgb10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGJvZHkucGlwZShjaHVua2llcikub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgICBjaHVua2llci5vbignZW5kJywgcmVzb2x2ZSkub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgfSksXG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgcGFydE51bWJlciA9IDFcblxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGNodW5raWVyKSB7XG4gICAgICAgICAgY29uc3QgbWQ1ID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShjaHVuaykuZGlnZXN0KClcblxuICAgICAgICAgIGNvbnN0IG9sZFBhcnQgPSBvbGRQYXJ0c1twYXJ0TnVtYmVyXVxuICAgICAgICAgIGlmIChvbGRQYXJ0KSB7XG4gICAgICAgICAgICBpZiAob2xkUGFydC5ldGFnID09PSBtZDUudG9TdHJpbmcoJ2hleCcpKSB7XG4gICAgICAgICAgICAgIGVUYWdzLnB1c2goeyBwYXJ0OiBwYXJ0TnVtYmVyLCBldGFnOiBvbGRQYXJ0LmV0YWcgfSlcbiAgICAgICAgICAgICAgcGFydE51bWJlcisrXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcGFydE51bWJlcisrXG5cbiAgICAgICAgICAvLyBub3cgc3RhcnQgdG8gdXBsb2FkIG1pc3NpbmcgcGFydFxuICAgICAgICAgIGNvbnN0IG9wdGlvbnM6IFJlcXVlc3RPcHRpb24gPSB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICAgICAgcXVlcnk6IHFzLnN0cmluZ2lmeSh7IHBhcnROdW1iZXIsIHVwbG9hZElkIH0pLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBjaHVuay5sZW5ndGgsXG4gICAgICAgICAgICAgICdDb250ZW50LU1ENSc6IG1kNS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYnVja2V0TmFtZSxcbiAgICAgICAgICAgIG9iamVjdE5hbWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KG9wdGlvbnMsIGNodW5rKVxuXG4gICAgICAgICAgbGV0IGV0YWcgPSByZXNwb25zZS5oZWFkZXJzLmV0YWdcbiAgICAgICAgICBpZiAoZXRhZykge1xuICAgICAgICAgICAgZXRhZyA9IGV0YWcucmVwbGFjZSgvXlwiLywgJycpLnJlcGxhY2UoL1wiJC8sICcnKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBldGFnID0gJydcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBlVGFncy5wdXNoKHsgcGFydDogcGFydE51bWJlciwgZXRhZyB9KVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29tcGxldGVNdWx0aXBhcnRVcGxvYWQoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdXBsb2FkSWQsIGVUYWdzKVxuICAgICAgfSkoKSxcbiAgICBdKVxuXG4gICAgcmV0dXJuIG9cbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD5cbiAgcmVtb3ZlQnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBjYWxsYmFjazogTm9SZXN1bHRDYWxsYmFjayk6IHZvaWRcbiAgYXN5bmMgcmVtb3ZlQnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0RFTEVURSdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9LCAnJywgWzIwMCwgMjA0XSwgJycpXG4gIH1cblxuICBzZXRCdWNrZXRSZXBsaWNhdGlvbihidWNrZXROYW1lOiBzdHJpbmcsIHJlcGxpY2F0aW9uQ29uZmlnOiBSZXBsaWNhdGlvbkNvbmZpZ09wdHMpOiB2b2lkXG4gIGFzeW5jIHNldEJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZywgcmVwbGljYXRpb25Db25maWc6IFJlcGxpY2F0aW9uQ29uZmlnT3B0cyk6IFByb21pc2U8dm9pZD5cbiAgYXN5bmMgc2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nLCByZXBsaWNhdGlvbkNvbmZpZzogUmVwbGljYXRpb25Db25maWdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChyZXBsaWNhdGlvbkNvbmZpZykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3JlcGxpY2F0aW9uQ29uZmlnIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXy5pc0VtcHR5KHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ1JvbGUgY2Fubm90IGJlIGVtcHR5JylcbiAgICAgIH0gZWxzZSBpZiAocmVwbGljYXRpb25Db25maWcucm9sZSAmJiAhaXNTdHJpbmcocmVwbGljYXRpb25Db25maWcucm9sZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW52YWxpZCB2YWx1ZSBmb3Igcm9sZScsIHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUpXG4gICAgICB9XG4gICAgICBpZiAoXy5pc0VtcHR5KHJlcGxpY2F0aW9uQ29uZmlnLnJ1bGVzKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdNaW5pbXVtIG9uZSByZXBsaWNhdGlvbiBydWxlIG11c3QgYmUgc3BlY2lmaWVkJylcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cblxuICAgIGNvbnN0IHJlcGxpY2F0aW9uUGFyYW1zQ29uZmlnID0ge1xuICAgICAgUmVwbGljYXRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICAgIFJvbGU6IHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUsXG4gICAgICAgIFJ1bGU6IHJlcGxpY2F0aW9uQ29uZmlnLnJ1bGVzLFxuICAgICAgfSxcbiAgICB9XG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKHsgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sIGhlYWRsZXNzOiB0cnVlIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QocmVwbGljYXRpb25QYXJhbXNDb25maWcpXG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIGhlYWRlcnMgfSwgcGF5bG9hZClcbiAgfVxuXG4gIGdldEJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZyk6IHZvaWRcbiAgYXN5bmMgZ2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxSZXBsaWNhdGlvbkNvbmZpZz5cbiAgYXN5bmMgZ2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwLCAyMDRdKVxuICAgIGNvbnN0IHhtbFJlc3VsdCA9IGF3YWl0IHJlYWRBc1N0cmluZyhodHRwUmVzKVxuICAgIHJldHVybiB4bWxQYXJzZXJzLnBhcnNlUmVwbGljYXRpb25Db25maWcoeG1sUmVzdWx0KVxuICB9XG5cbiAgZ2V0T2JqZWN0TGVnYWxIb2xkKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgZ2V0T3B0cz86IEdldE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gICAgY2FsbGJhY2s/OiBSZXN1bHRDYWxsYmFjazxMRUdBTF9IT0xEX1NUQVRVUz4sXG4gICk6IFByb21pc2U8TEVHQUxfSE9MRF9TVEFUVVM+XG4gIGFzeW5jIGdldE9iamVjdExlZ2FsSG9sZChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGdldE9wdHM/OiBHZXRPYmplY3RMZWdhbEhvbGRPcHRpb25zLFxuICApOiBQcm9taXNlPExFR0FMX0hPTERfU1RBVFVTPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoZ2V0T3B0cykge1xuICAgICAgaWYgKCFpc09iamVjdChnZXRPcHRzKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdnZXRPcHRzIHNob3VsZCBiZSBvZiB0eXBlIFwiT2JqZWN0XCInKVxuICAgICAgfSBlbHNlIGlmIChPYmplY3Qua2V5cyhnZXRPcHRzKS5sZW5ndGggPiAwICYmIGdldE9wdHMudmVyc2lvbklkICYmICFpc1N0cmluZyhnZXRPcHRzLnZlcnNpb25JZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmVyc2lvbklkIHNob3VsZCBiZSBvZiB0eXBlIHN0cmluZy46JywgZ2V0T3B0cy52ZXJzaW9uSWQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBsZXQgcXVlcnkgPSAnbGVnYWwtaG9sZCdcblxuICAgIGlmIChnZXRPcHRzPy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ICs9IGAmdmVyc2lvbklkPSR7Z2V0T3B0cy52ZXJzaW9uSWR9YFxuICAgIH1cblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwXSlcbiAgICBjb25zdCBzdHJSZXMgPSBhd2FpdCByZWFkQXNTdHJpbmcoaHR0cFJlcylcbiAgICByZXR1cm4gcGFyc2VPYmplY3RMZWdhbEhvbGRDb25maWcoc3RyUmVzKVxuICB9XG5cbiAgc2V0T2JqZWN0TGVnYWxIb2xkKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nLCBzZXRPcHRzPzogUHV0T2JqZWN0TGVnYWxIb2xkT3B0aW9ucyk6IHZvaWRcbiAgYXN5bmMgc2V0T2JqZWN0TGVnYWxIb2xkKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgc2V0T3B0cyA9IHtcbiAgICAgIHN0YXR1czogTEVHQUxfSE9MRF9TVEFUVVMuRU5BQkxFRCxcbiAgICB9IGFzIFB1dE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuXG4gICAgaWYgKCFpc09iamVjdChzZXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc2V0T3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIk9iamVjdFwiJylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFbTEVHQUxfSE9MRF9TVEFUVVMuRU5BQkxFRCwgTEVHQUxfSE9MRF9TVEFUVVMuRElTQUJMRURdLmluY2x1ZGVzKHNldE9wdHM/LnN0YXR1cykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBzdGF0dXM6ICcgKyBzZXRPcHRzLnN0YXR1cylcbiAgICAgIH1cbiAgICAgIGlmIChzZXRPcHRzLnZlcnNpb25JZCAmJiAhc2V0T3B0cy52ZXJzaW9uSWQubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZlcnNpb25JZCBzaG91bGQgYmUgb2YgdHlwZSBzdHJpbmcuOicgKyBzZXRPcHRzLnZlcnNpb25JZClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnUFVUJ1xuICAgIGxldCBxdWVyeSA9ICdsZWdhbC1ob2xkJ1xuXG4gICAgaWYgKHNldE9wdHMudmVyc2lvbklkKSB7XG4gICAgICBxdWVyeSArPSBgJnZlcnNpb25JZD0ke3NldE9wdHMudmVyc2lvbklkfWBcbiAgICB9XG5cbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBTdGF0dXM6IHNldE9wdHMuc3RhdHVzLFxuICAgIH1cblxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyByb290TmFtZTogJ0xlZ2FsSG9sZCcsIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LCBoZWFkbGVzczogdHJ1ZSB9KVxuICAgIGNvbnN0IHBheWxvYWQgPSBidWlsZGVyLmJ1aWxkT2JqZWN0KGNvbmZpZylcbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5LCBoZWFkZXJzIH0sIHBheWxvYWQpXG4gIH1cblxuICAvKipcbiAgICogR2V0IFRhZ3MgYXNzb2NpYXRlZCB3aXRoIGEgQnVja2V0XG4gICAqL1xuICBhc3luYyBnZXRCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8VGFnW10+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoYEludmFsaWQgYnVja2V0IG5hbWU6ICR7YnVja2V0TmFtZX1gKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdHRVQnXG4gICAgY29uc3QgcXVlcnkgPSAndGFnZ2luZydcbiAgICBjb25zdCByZXF1ZXN0T3B0aW9ucyA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyhyZXF1ZXN0T3B0aW9ucylcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEFzU3RyaW5nKHJlc3BvbnNlKVxuICAgIHJldHVybiB4bWxQYXJzZXJzLnBhcnNlVGFnZ2luZyhib2R5KVxuICB9XG5cbiAgLyoqXG4gICAqICBHZXQgdGhlIHRhZ3MgYXNzb2NpYXRlZCB3aXRoIGEgYnVja2V0IE9SIGFuIG9iamVjdFxuICAgKi9cbiAgYXN5bmMgZ2V0T2JqZWN0VGFnZ2luZyhidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgZ2V0T3B0czogVmVyc2lvbklkZW50aWZpY2F0b3IgPSB7fSk6IFByb21pc2U8VGFnW10+IHtcbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGxldCBxdWVyeSA9ICd0YWdnaW5nJ1xuXG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChnZXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignZ2V0T3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBpZiAoZ2V0T3B0cyAmJiBnZXRPcHRzLnZlcnNpb25JZCkge1xuICAgICAgcXVlcnkgPSBgJHtxdWVyeX0mdmVyc2lvbklkPSR7Z2V0T3B0cy52ZXJzaW9uSWR9YFxuICAgIH1cbiAgICBjb25zdCByZXF1ZXN0T3B0aW9uczogUmVxdWVzdE9wdGlvbiA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9XG4gICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgIHJlcXVlc3RPcHRpb25zWydvYmplY3ROYW1lJ10gPSBvYmplY3ROYW1lXG4gICAgfVxuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMocmVxdWVzdE9wdGlvbnMpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXNwb25zZSlcbiAgICByZXR1cm4geG1sUGFyc2Vycy5wYXJzZVRhZ2dpbmcoYm9keSlcbiAgfVxuXG4gIC8qKlxuICAgKiAgU2V0IHRoZSBwb2xpY3kgb24gYSBidWNrZXQgb3IgYW4gb2JqZWN0IHByZWZpeC5cbiAgICovXG4gIGFzeW5jIHNldEJ1Y2tldFBvbGljeShidWNrZXROYW1lOiBzdHJpbmcsIHBvbGljeTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gVmFsaWRhdGUgYXJndW1lbnRzLlxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcihgSW52YWxpZCBidWNrZXQgbmFtZTogJHtidWNrZXROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocG9saWN5KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0UG9saWN5RXJyb3IoYEludmFsaWQgYnVja2V0IHBvbGljeTogJHtwb2xpY3l9IC0gbXVzdCBiZSBcInN0cmluZ1wiYClcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9ICdwb2xpY3knXG5cbiAgICBsZXQgbWV0aG9kID0gJ0RFTEVURSdcbiAgICBpZiAocG9saWN5KSB7XG4gICAgICBtZXRob2QgPSAnUFVUJ1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBvbGljeSwgWzIwNF0sICcnKVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgcG9saWN5IG9uIGEgYnVja2V0IG9yIGFuIG9iamVjdCBwcmVmaXguXG4gICAqL1xuICBhc3luYyBnZXRCdWNrZXRQb2xpY3koYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBWYWxpZGF0ZSBhcmd1bWVudHMuXG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ3BvbGljeSdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgcmV0dXJuIGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gIH1cblxuICBhc3luYyBwdXRPYmplY3RSZXRlbnRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJldGVudGlvbk9wdHM6IFJldGVudGlvbiA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChyZXRlbnRpb25PcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigncmV0ZW50aW9uT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJldGVudGlvbk9wdHMuZ292ZXJuYW5jZUJ5cGFzcyAmJiAhaXNCb29sZWFuKHJldGVudGlvbk9wdHMuZ292ZXJuYW5jZUJ5cGFzcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihgSW52YWxpZCB2YWx1ZSBmb3IgZ292ZXJuYW5jZUJ5cGFzczogJHtyZXRlbnRpb25PcHRzLmdvdmVybmFuY2VCeXBhc3N9YClcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgcmV0ZW50aW9uT3B0cy5tb2RlICYmXG4gICAgICAgICFbUkVURU5USU9OX01PREVTLkNPTVBMSUFOQ0UsIFJFVEVOVElPTl9NT0RFUy5HT1ZFUk5BTkNFXS5pbmNsdWRlcyhyZXRlbnRpb25PcHRzLm1vZGUpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihgSW52YWxpZCBvYmplY3QgcmV0ZW50aW9uIG1vZGU6ICR7cmV0ZW50aW9uT3B0cy5tb2RlfWApXG4gICAgICB9XG4gICAgICBpZiAocmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGUgJiYgIWlzU3RyaW5nKHJldGVudGlvbk9wdHMucmV0YWluVW50aWxEYXRlKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHZhbHVlIGZvciByZXRhaW5VbnRpbERhdGU6ICR7cmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGV9YClcbiAgICAgIH1cbiAgICAgIGlmIChyZXRlbnRpb25PcHRzLnZlcnNpb25JZCAmJiAhaXNTdHJpbmcocmV0ZW50aW9uT3B0cy52ZXJzaW9uSWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYEludmFsaWQgdmFsdWUgZm9yIHZlcnNpb25JZDogJHtyZXRlbnRpb25PcHRzLnZlcnNpb25JZH1gKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgbGV0IHF1ZXJ5ID0gJ3JldGVudGlvbidcblxuICAgIGNvbnN0IGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzID0ge31cbiAgICBpZiAocmV0ZW50aW9uT3B0cy5nb3Zlcm5hbmNlQnlwYXNzKSB7XG4gICAgICBoZWFkZXJzWydYLUFtei1CeXBhc3MtR292ZXJuYW5jZS1SZXRlbnRpb24nXSA9IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKHsgcm9vdE5hbWU6ICdSZXRlbnRpb24nLCByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSwgaGVhZGxlc3M6IHRydWUgfSlcbiAgICBjb25zdCBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuXG4gICAgaWYgKHJldGVudGlvbk9wdHMubW9kZSkge1xuICAgICAgcGFyYW1zLk1vZGUgPSByZXRlbnRpb25PcHRzLm1vZGVcbiAgICB9XG4gICAgaWYgKHJldGVudGlvbk9wdHMucmV0YWluVW50aWxEYXRlKSB7XG4gICAgICBwYXJhbXMuUmV0YWluVW50aWxEYXRlID0gcmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGVcbiAgICB9XG4gICAgaWYgKHJldGVudGlvbk9wdHMudmVyc2lvbklkKSB7XG4gICAgICBxdWVyeSArPSBgJnZlcnNpb25JZD0ke3JldGVudGlvbk9wdHMudmVyc2lvbklkfWBcbiAgICB9XG5cbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChwYXJhbXMpXG5cbiAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkLCBbMjAwLCAyMDRdKVxuICB9XG5cbiAgZ2V0T2JqZWN0TG9ja0NvbmZpZyhidWNrZXROYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBSZXN1bHRDYWxsYmFjazxPYmplY3RMb2NrSW5mbz4pOiB2b2lkXG4gIGdldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nKTogdm9pZFxuICBhc3luYyBnZXRPYmplY3RMb2NrQ29uZmlnKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8T2JqZWN0TG9ja0luZm8+XG4gIGFzeW5jIGdldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdvYmplY3QtbG9jaydcblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgeG1sUmVzdWx0ID0gYXdhaXQgcmVhZEFzU3RyaW5nKGh0dHBSZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VPYmplY3RMb2NrQ29uZmlnKHhtbFJlc3VsdClcbiAgfVxuXG4gIHNldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nLCBsb2NrQ29uZmlnT3B0czogT21pdDxPYmplY3RMb2NrSW5mbywgJ29iamVjdExvY2tFbmFibGVkJz4pOiB2b2lkXG4gIGFzeW5jIHNldE9iamVjdExvY2tDb25maWcoXG4gICAgYnVja2V0TmFtZTogc3RyaW5nLFxuICAgIGxvY2tDb25maWdPcHRzOiBPbWl0PE9iamVjdExvY2tJbmZvLCAnb2JqZWN0TG9ja0VuYWJsZWQnPixcbiAgKTogUHJvbWlzZTx2b2lkPlxuICBhc3luYyBzZXRPYmplY3RMb2NrQ29uZmlnKGJ1Y2tldE5hbWU6IHN0cmluZywgbG9ja0NvbmZpZ09wdHM6IE9taXQ8T2JqZWN0TG9ja0luZm8sICdvYmplY3RMb2NrRW5hYmxlZCc+KSB7XG4gICAgY29uc3QgcmV0ZW50aW9uTW9kZXMgPSBbUkVURU5USU9OX01PREVTLkNPTVBMSUFOQ0UsIFJFVEVOVElPTl9NT0RFUy5HT1ZFUk5BTkNFXVxuICAgIGNvbnN0IHZhbGlkVW5pdHMgPSBbUkVURU5USU9OX1ZBTElESVRZX1VOSVRTLkRBWVMsIFJFVEVOVElPTl9WQUxJRElUWV9VTklUUy5ZRUFSU11cblxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuXG4gICAgaWYgKGxvY2tDb25maWdPcHRzLm1vZGUgJiYgIXJldGVudGlvbk1vZGVzLmluY2x1ZGVzKGxvY2tDb25maWdPcHRzLm1vZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBsb2NrQ29uZmlnT3B0cy5tb2RlIHNob3VsZCBiZSBvbmUgb2YgJHtyZXRlbnRpb25Nb2Rlc31gKVxuICAgIH1cbiAgICBpZiAobG9ja0NvbmZpZ09wdHMudW5pdCAmJiAhdmFsaWRVbml0cy5pbmNsdWRlcyhsb2NrQ29uZmlnT3B0cy51bml0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgbG9ja0NvbmZpZ09wdHMudW5pdCBzaG91bGQgYmUgb25lIG9mICR7dmFsaWRVbml0c31gKVxuICAgIH1cbiAgICBpZiAobG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgJiYgIWlzTnVtYmVyKGxvY2tDb25maWdPcHRzLnZhbGlkaXR5KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgbG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgc2hvdWxkIGJlIGEgbnVtYmVyYClcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnUFVUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ29iamVjdC1sb2NrJ1xuXG4gICAgY29uc3QgY29uZmlnOiBPYmplY3RMb2NrQ29uZmlnUGFyYW0gPSB7XG4gICAgICBPYmplY3RMb2NrRW5hYmxlZDogJ0VuYWJsZWQnLFxuICAgIH1cbiAgICBjb25zdCBjb25maWdLZXlzID0gT2JqZWN0LmtleXMobG9ja0NvbmZpZ09wdHMpXG5cbiAgICBjb25zdCBpc0FsbEtleXNTZXQgPSBbJ3VuaXQnLCAnbW9kZScsICd2YWxpZGl0eSddLmV2ZXJ5KChsY2spID0+IGNvbmZpZ0tleXMuaW5jbHVkZXMobGNrKSlcbiAgICAvLyBDaGVjayBpZiBrZXlzIGFyZSBwcmVzZW50IGFuZCBhbGwga2V5cyBhcmUgcHJlc2VudC5cbiAgICBpZiAoY29uZmlnS2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIWlzQWxsS2V5c1NldCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBsb2NrQ29uZmlnT3B0cy5tb2RlLGxvY2tDb25maWdPcHRzLnVuaXQsbG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgYWxsIHRoZSBwcm9wZXJ0aWVzIHNob3VsZCBiZSBzcGVjaWZpZWQuYCxcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlnLlJ1bGUgPSB7XG4gICAgICAgICAgRGVmYXVsdFJldGVudGlvbjoge30sXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvY2tDb25maWdPcHRzLm1vZGUpIHtcbiAgICAgICAgICBjb25maWcuUnVsZS5EZWZhdWx0UmV0ZW50aW9uLk1vZGUgPSBsb2NrQ29uZmlnT3B0cy5tb2RlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvY2tDb25maWdPcHRzLnVuaXQgPT09IFJFVEVOVElPTl9WQUxJRElUWV9VTklUUy5EQVlTKSB7XG4gICAgICAgICAgY29uZmlnLlJ1bGUuRGVmYXVsdFJldGVudGlvbi5EYXlzID0gbG9ja0NvbmZpZ09wdHMudmFsaWRpdHlcbiAgICAgICAgfSBlbHNlIGlmIChsb2NrQ29uZmlnT3B0cy51bml0ID09PSBSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMuWUVBUlMpIHtcbiAgICAgICAgICBjb25maWcuUnVsZS5EZWZhdWx0UmV0ZW50aW9uLlllYXJzID0gbG9ja0NvbmZpZ09wdHMudmFsaWRpdHlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdPYmplY3RMb2NrQ29uZmlndXJhdGlvbicsXG4gICAgICByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoY29uZmlnKVxuXG4gICAgY29uc3QgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMgPSB7fVxuICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSB0b01kNShwYXlsb2FkKVxuXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIGhlYWRlcnMgfSwgcGF5bG9hZClcbiAgfVxuXG4gIGFzeW5jIGdldEJ1Y2tldFZlcnNpb25pbmcoYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICd2ZXJzaW9uaW5nJ1xuXG4gICAgY29uc3QgaHR0cFJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSlcbiAgICBjb25zdCB4bWxSZXN1bHQgPSBhd2FpdCByZWFkQXNTdHJpbmcoaHR0cFJlcylcbiAgICByZXR1cm4gYXdhaXQgeG1sUGFyc2Vycy5wYXJzZUJ1Y2tldFZlcnNpb25pbmdDb25maWcoeG1sUmVzdWx0KVxuICB9XG5cbiAgYXN5bmMgc2V0QnVja2V0VmVyc2lvbmluZyhidWNrZXROYW1lOiBzdHJpbmcsIHZlcnNpb25Db25maWc6IEJ1Y2tldFZlcnNpb25pbmdDb25maWd1cmF0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFPYmplY3Qua2V5cyh2ZXJzaW9uQ29uZmlnKS5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3ZlcnNpb25Db25maWcgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICd2ZXJzaW9uaW5nJ1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdWZXJzaW9uaW5nQ29uZmlndXJhdGlvbicsXG4gICAgICByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QodmVyc2lvbkNvbmZpZylcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHNldFRhZ2dpbmcodGFnZ2luZ1BhcmFtczogUHV0VGFnZ2luZ1BhcmFtcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdGFncywgcHV0T3B0cyB9ID0gdGFnZ2luZ1BhcmFtc1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgbGV0IHF1ZXJ5ID0gJ3RhZ2dpbmcnXG5cbiAgICBpZiAocHV0T3B0cyAmJiBwdXRPcHRzPy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcnl9JnZlcnNpb25JZD0ke3B1dE9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgdGFnc0xpc3QgPSBbXVxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRhZ3MpKSB7XG4gICAgICB0YWdzTGlzdC5wdXNoKHsgS2V5OiBrZXksIFZhbHVlOiB2YWx1ZSB9KVxuICAgIH1cbiAgICBjb25zdCB0YWdnaW5nQ29uZmlnID0ge1xuICAgICAgVGFnZ2luZzoge1xuICAgICAgICBUYWdTZXQ6IHtcbiAgICAgICAgICBUYWc6IHRhZ3NMaXN0LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9XG4gICAgY29uc3QgaGVhZGVycyA9IHt9IGFzIFJlcXVlc3RIZWFkZXJzXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyB4bWwyanMuQnVpbGRlcih7IGhlYWRsZXNzOiB0cnVlLCByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSB9KVxuICAgIGNvbnN0IHBheWxvYWRCdWYgPSBCdWZmZXIuZnJvbShidWlsZGVyLmJ1aWxkT2JqZWN0KHRhZ2dpbmdDb25maWcpKVxuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgbWV0aG9kLFxuICAgICAgYnVja2V0TmFtZSxcbiAgICAgIHF1ZXJ5LFxuICAgICAgaGVhZGVycyxcblxuICAgICAgLi4uKG9iamVjdE5hbWUgJiYgeyBvYmplY3ROYW1lOiBvYmplY3ROYW1lIH0pLFxuICAgIH1cblxuICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSB0b01kNShwYXlsb2FkQnVmKVxuXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdChyZXF1ZXN0T3B0aW9ucywgcGF5bG9hZEJ1ZilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVtb3ZlVGFnZ2luZyh7IGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHJlbW92ZU9wdHMgfTogUmVtb3ZlVGFnZ2luZ1BhcmFtcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgbGV0IHF1ZXJ5ID0gJ3RhZ2dpbmcnXG5cbiAgICBpZiAocmVtb3ZlT3B0cyAmJiBPYmplY3Qua2V5cyhyZW1vdmVPcHRzKS5sZW5ndGggJiYgcmVtb3ZlT3B0cy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcnl9JnZlcnNpb25JZD0ke3JlbW92ZU9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdE9wdGlvbnMgPSB7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfVxuXG4gICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgIHJlcXVlc3RPcHRpb25zWydvYmplY3ROYW1lJ10gPSBvYmplY3ROYW1lXG4gICAgfVxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyhyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDAsIDIwNF0pXG4gIH1cblxuICBhc3luYyBzZXRCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZywgdGFnczogVGFnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdCh0YWdzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndGFncyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKHRhZ3MpLmxlbmd0aCA+IDEwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdtYXhpbXVtIHRhZ3MgYWxsb3dlZCBpcyAxMFwiJylcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnNldFRhZ2dpbmcoeyBidWNrZXROYW1lLCB0YWdzIH0pXG4gIH1cblxuICBhc3luYyByZW1vdmVCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGF3YWl0IHRoaXMucmVtb3ZlVGFnZ2luZyh7IGJ1Y2tldE5hbWUgfSlcbiAgfVxuXG4gIGFzeW5jIHNldE9iamVjdFRhZ2dpbmcoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHRhZ3M6IFRhZ3MsIHB1dE9wdHM6IFRhZ2dpbmdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHRhZ3MpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCd0YWdzIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXModGFncykubGVuZ3RoID4gMTApIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ01heGltdW0gdGFncyBhbGxvd2VkIGlzIDEwXCInKVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuc2V0VGFnZ2luZyh7IGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHRhZ3MsIHB1dE9wdHMgfSlcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZU9iamVjdFRhZ2dpbmcoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM6IFRhZ2dpbmdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG4gICAgaWYgKHJlbW92ZU9wdHMgJiYgT2JqZWN0LmtleXMocmVtb3ZlT3B0cykubGVuZ3RoICYmICFpc09iamVjdChyZW1vdmVPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigncmVtb3ZlT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnJlbW92ZVRhZ2dpbmcoeyBidWNrZXROYW1lLCBvYmplY3ROYW1lLCByZW1vdmVPcHRzIH0pXG4gIH1cblxuICBhc3luYyBzZWxlY3RPYmplY3RDb250ZW50KFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgc2VsZWN0T3B0czogU2VsZWN0T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxTZWxlY3RSZXN1bHRzIHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cykpIHtcbiAgICAgIGlmICghaXNTdHJpbmcoc2VsZWN0T3B0cy5leHByZXNzaW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzcWxFeHByZXNzaW9uIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgICAgfVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cy5pbnB1dFNlcmlhbGl6YXRpb24pKSB7XG4gICAgICAgIGlmICghaXNPYmplY3Qoc2VsZWN0T3B0cy5pbnB1dFNlcmlhbGl6YXRpb24pKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5wdXRTZXJpYWxpemF0aW9uIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbnB1dFNlcmlhbGl6YXRpb24gaXMgcmVxdWlyZWQnKVxuICAgICAgfVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cy5vdXRwdXRTZXJpYWxpemF0aW9uKSkge1xuICAgICAgICBpZiAoIWlzT2JqZWN0KHNlbGVjdE9wdHMub3V0cHV0U2VyaWFsaXphdGlvbikpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvdXRwdXRTZXJpYWxpemF0aW9uIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvdXRwdXRTZXJpYWxpemF0aW9uIGlzIHJlcXVpcmVkJylcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsaWQgc2VsZWN0IGNvbmZpZ3VyYXRpb24gaXMgcmVxdWlyZWQnKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gYHNlbGVjdCZzZWxlY3QtdHlwZT0yYFxuXG4gICAgY29uc3QgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW1xuICAgICAge1xuICAgICAgICBFeHByZXNzaW9uOiBzZWxlY3RPcHRzLmV4cHJlc3Npb24sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBFeHByZXNzaW9uVHlwZTogc2VsZWN0T3B0cy5leHByZXNzaW9uVHlwZSB8fCAnU1FMJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIElucHV0U2VyaWFsaXphdGlvbjogW3NlbGVjdE9wdHMuaW5wdXRTZXJpYWxpemF0aW9uXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIE91dHB1dFNlcmlhbGl6YXRpb246IFtzZWxlY3RPcHRzLm91dHB1dFNlcmlhbGl6YXRpb25dLFxuICAgICAgfSxcbiAgICBdXG5cbiAgICAvLyBPcHRpb25hbFxuICAgIGlmIChzZWxlY3RPcHRzLnJlcXVlc3RQcm9ncmVzcykge1xuICAgICAgY29uZmlnLnB1c2goeyBSZXF1ZXN0UHJvZ3Jlc3M6IHNlbGVjdE9wdHM/LnJlcXVlc3RQcm9ncmVzcyB9KVxuICAgIH1cbiAgICAvLyBPcHRpb25hbFxuICAgIGlmIChzZWxlY3RPcHRzLnNjYW5SYW5nZSkge1xuICAgICAgY29uZmlnLnB1c2goeyBTY2FuUmFuZ2U6IHNlbGVjdE9wdHMuc2NhblJhbmdlIH0pXG4gICAgfVxuXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyB4bWwyanMuQnVpbGRlcih7XG4gICAgICByb290TmFtZTogJ1NlbGVjdE9iamVjdENvbnRlbnRSZXF1ZXN0JyxcbiAgICAgIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LFxuICAgICAgaGVhZGxlc3M6IHRydWUsXG4gICAgfSlcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChjb25maWcpXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc0J1ZmZlcihyZXMpXG4gICAgcmV0dXJuIHBhcnNlU2VsZWN0T2JqZWN0Q29udGVudFJlc3BvbnNlKGJvZHkpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFwcGx5QnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWU6IHN0cmluZywgcG9saWN5Q29uZmlnOiBMaWZlQ3ljbGVDb25maWdQYXJhbSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgY29uc3QgcXVlcnkgPSAnbGlmZWN5Y2xlJ1xuXG4gICAgY29uc3QgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMgPSB7fVxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdMaWZlY3ljbGVDb25maWd1cmF0aW9uJyxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgICAgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sXG4gICAgfSlcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChwb2xpY3lDb25maWcpXG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkKVxuICB9XG5cbiAgYXN5bmMgcmVtb3ZlQnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSAnbGlmZWN5Y2xlJ1xuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSlcbiAgfVxuXG4gIGFzeW5jIHNldEJ1Y2tldExpZmVjeWNsZShidWNrZXROYW1lOiBzdHJpbmcsIGxpZmVDeWNsZUNvbmZpZzogTGlmZUN5Y2xlQ29uZmlnUGFyYW0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoXy5pc0VtcHR5KGxpZmVDeWNsZUNvbmZpZykpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVtb3ZlQnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwbHlCdWNrZXRMaWZlY3ljbGUoYnVja2V0TmFtZSwgbGlmZUN5Y2xlQ29uZmlnKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldEJ1Y2tldExpZmVjeWNsZShidWNrZXROYW1lOiBzdHJpbmcpOiBQcm9taXNlPExpZmVjeWNsZUNvbmZpZyB8IG51bGw+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ2xpZmVjeWNsZSdcblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSlcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEFzU3RyaW5nKHJlcylcbiAgICByZXR1cm4geG1sUGFyc2Vycy5wYXJzZUxpZmVjeWNsZUNvbmZpZyhib2R5KVxuICB9XG4gIGFzeW5jIHNldEJ1Y2tldEVuY3J5cHRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBlbmNyeXB0aW9uQ29uZmlnPzogRW5jcnlwdGlvbkNvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghXy5pc0VtcHR5KGVuY3J5cHRpb25Db25maWcpICYmIGVuY3J5cHRpb25Db25maWcuUnVsZS5sZW5ndGggPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdJbnZhbGlkIFJ1bGUgbGVuZ3RoLiBPbmx5IG9uZSBydWxlIGlzIGFsbG93ZWQuOiAnICsgZW5jcnlwdGlvbkNvbmZpZy5SdWxlKVxuICAgIH1cblxuICAgIGxldCBlbmNyeXB0aW9uT2JqID0gZW5jcnlwdGlvbkNvbmZpZ1xuICAgIGlmIChfLmlzRW1wdHkoZW5jcnlwdGlvbkNvbmZpZykpIHtcbiAgICAgIGVuY3J5cHRpb25PYmogPSB7XG4gICAgICAgIC8vIERlZmF1bHQgTWluSU8gU2VydmVyIFN1cHBvcnRlZCBSdWxlXG4gICAgICAgIFJ1bGU6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBBcHBseVNlcnZlclNpZGVFbmNyeXB0aW9uQnlEZWZhdWx0OiB7XG4gICAgICAgICAgICAgIFNTRUFsZ29yaXRobTogJ0FFUzI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICdlbmNyeXB0aW9uJ1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdTZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sXG4gICAgICBoZWFkbGVzczogdHJ1ZSxcbiAgICB9KVxuICAgIGNvbnN0IHBheWxvYWQgPSBidWlsZGVyLmJ1aWxkT2JqZWN0KGVuY3J5cHRpb25PYmopXG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkKVxuICB9XG5cbiAgYXN5bmMgZ2V0QnVja2V0RW5jcnlwdGlvbihidWNrZXROYW1lOiBzdHJpbmcpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ2VuY3J5cHRpb24nXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VCdWNrZXRFbmNyeXB0aW9uQ29uZmlnKGJvZHkpXG4gIH1cblxuICBhc3luYyByZW1vdmVCdWNrZXRFbmNyeXB0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSAnZW5jcnlwdGlvbidcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSlcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEtBQUtBLE1BQU07QUFDbEIsT0FBTyxLQUFLQyxFQUFFO0FBQ2QsT0FBTyxLQUFLQyxJQUFJO0FBQ2hCLE9BQU8sS0FBS0MsS0FBSztBQUNqQixPQUFPLEtBQUtDLElBQUk7QUFDaEIsT0FBTyxLQUFLQyxNQUFNO0FBRWxCLE9BQU8sS0FBS0MsS0FBSyxNQUFNLE9BQU87QUFDOUIsT0FBT0MsWUFBWSxNQUFNLGVBQWU7QUFDeEMsU0FBU0MsU0FBUyxRQUFRLGlCQUFpQjtBQUMzQyxPQUFPQyxDQUFDLE1BQU0sUUFBUTtBQUN0QixPQUFPLEtBQUtDLEVBQUUsTUFBTSxjQUFjO0FBQ2xDLE9BQU9DLE1BQU0sTUFBTSxRQUFRO0FBRTNCLFNBQVNDLGtCQUFrQixRQUFRLDJCQUEwQjtBQUM3RCxPQUFPLEtBQUtDLE1BQU0sTUFBTSxlQUFjO0FBRXRDLFNBQVNDLGNBQWMsRUFBRUMsaUJBQWlCLEVBQUVDLGVBQWUsRUFBRUMsd0JBQXdCLFFBQVEsZ0JBQWU7QUFDNUcsU0FBU0MsTUFBTSxRQUFRLGdCQUFlO0FBQ3RDLFNBQVNDLEdBQUcsRUFBRUMsYUFBYSxRQUFRLGFBQVk7QUFDL0MsU0FBU0MsVUFBVSxRQUFRLGtCQUFpQjtBQUM1QyxTQUNFQyxlQUFlLEVBQ2ZDLGdCQUFnQixFQUNoQkMsWUFBWSxFQUNaQyxVQUFVLEVBQ1ZDLGlCQUFpQixFQUNqQkMsZ0JBQWdCLEVBQ2hCQyxTQUFTLEVBQ1RDLFNBQVMsRUFDVEMsT0FBTyxFQUNQQyxRQUFRLEVBQ1JDLFFBQVEsRUFDUkMsZ0JBQWdCLEVBQ2hCQyxRQUFRLEVBQ1JDLGlCQUFpQixFQUNqQkMsZUFBZSxFQUNmQyxpQkFBaUIsRUFDakJDLFdBQVcsRUFDWEMsYUFBYSxFQUNiQyxrQkFBa0IsRUFDbEJDLFlBQVksRUFDWkMsZUFBZSxFQUNmQyxjQUFjLEVBQ2RDLFlBQVksRUFDWkMsS0FBSyxFQUNMQyxRQUFRLEVBQ1JDLFNBQVMsRUFDVEMsaUJBQWlCLFFBQ1osY0FBYTtBQUNwQixTQUFTQyxZQUFZLFFBQVEsc0JBQXFCO0FBQ2xELFNBQVNDLE9BQU8sUUFBUSxlQUFjO0FBQ3RDLFNBQVNDLGFBQWEsRUFBRUMsWUFBWSxFQUFFQyxZQUFZLFFBQVEsZ0JBQWU7QUFFekUsU0FBU0MsYUFBYSxRQUFRLG9CQUFtQjtBQW9DakQsU0FDRUMsc0JBQXNCLEVBQ3RCQyxzQkFBc0IsRUFDdEJDLDBCQUEwQixFQUMxQkMsZ0NBQWdDLFFBQzNCLGtCQUFpQjtBQUN4QixPQUFPLEtBQUtDLFVBQVUsTUFBTSxrQkFBaUI7QUFFN0MsTUFBTUMsR0FBRyxHQUFHLElBQUlqRCxNQUFNLENBQUNrRCxPQUFPLENBQUM7RUFBRUMsVUFBVSxFQUFFO0lBQUVDLE1BQU0sRUFBRTtFQUFNLENBQUM7RUFBRUMsUUFBUSxFQUFFO0FBQUssQ0FBQyxDQUFDOztBQUVqRjtBQUNBLE1BQU1DLE9BQU8sR0FBRztFQUFFQyxPQUFPLEVBckd6QixPQUFPLElBcUc0RDtBQUFjLENBQUM7QUFFbEYsTUFBTUMsdUJBQXVCLEdBQUcsQ0FDOUIsT0FBTyxFQUNQLElBQUksRUFDSixNQUFNLEVBQ04sU0FBUyxFQUNULGtCQUFrQixFQUNsQixLQUFLLEVBQ0wsU0FBUyxFQUNULFdBQVcsRUFDWCxRQUFRLEVBQ1Isa0JBQWtCLEVBQ2xCLEtBQUssRUFDTCxZQUFZLEVBQ1osS0FBSyxFQUNMLG9CQUFvQixFQUNwQixlQUFlLEVBQ2YsZ0JBQWdCLEVBQ2hCLFlBQVksRUFDWixrQkFBa0IsQ0FDVjtBQTJDVixPQUFPLE1BQU1DLFdBQVcsQ0FBQztFQWN2QkMsUUFBUSxHQUFXLEVBQUUsR0FBRyxJQUFJLEdBQUcsSUFBSTtFQUd6QkMsZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUk7RUFDeENDLGFBQWEsR0FBRyxDQUFDLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSTtFQVF2REMsV0FBV0EsQ0FBQ0MsTUFBcUIsRUFBRTtJQUNqQztJQUNBLElBQUlBLE1BQU0sQ0FBQ0MsTUFBTSxLQUFLQyxTQUFTLEVBQUU7TUFDL0IsTUFBTSxJQUFJQyxLQUFLLENBQUMsNkRBQTZELENBQUM7SUFDaEY7SUFDQTtJQUNBLElBQUlILE1BQU0sQ0FBQ0ksTUFBTSxLQUFLRixTQUFTLEVBQUU7TUFDL0JGLE1BQU0sQ0FBQ0ksTUFBTSxHQUFHLElBQUk7SUFDdEI7SUFDQSxJQUFJLENBQUNKLE1BQU0sQ0FBQ0ssSUFBSSxFQUFFO01BQ2hCTCxNQUFNLENBQUNLLElBQUksR0FBRyxDQUFDO0lBQ2pCO0lBQ0E7SUFDQSxJQUFJLENBQUMxQyxlQUFlLENBQUNxQyxNQUFNLENBQUNNLFFBQVEsQ0FBQyxFQUFFO01BQ3JDLE1BQU0sSUFBSWxFLE1BQU0sQ0FBQ21FLG9CQUFvQixDQUFFLHNCQUFxQlAsTUFBTSxDQUFDTSxRQUFTLEVBQUMsQ0FBQztJQUNoRjtJQUNBLElBQUksQ0FBQ3pDLFdBQVcsQ0FBQ21DLE1BQU0sQ0FBQ0ssSUFBSSxDQUFDLEVBQUU7TUFDN0IsTUFBTSxJQUFJakUsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsa0JBQWlCUixNQUFNLENBQUNLLElBQUssRUFBQyxDQUFDO0lBQ3hFO0lBQ0EsSUFBSSxDQUFDbEQsU0FBUyxDQUFDNkMsTUFBTSxDQUFDSSxNQUFNLENBQUMsRUFBRTtNQUM3QixNQUFNLElBQUloRSxNQUFNLENBQUNvRSxvQkFBb0IsQ0FDbEMsOEJBQTZCUixNQUFNLENBQUNJLE1BQU8sb0NBQzlDLENBQUM7SUFDSDs7SUFFQTtJQUNBLElBQUlKLE1BQU0sQ0FBQ1MsTUFBTSxFQUFFO01BQ2pCLElBQUksQ0FBQ2hELFFBQVEsQ0FBQ3VDLE1BQU0sQ0FBQ1MsTUFBTSxDQUFDLEVBQUU7UUFDNUIsTUFBTSxJQUFJckUsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsb0JBQW1CUixNQUFNLENBQUNTLE1BQU8sRUFBQyxDQUFDO01BQzVFO0lBQ0Y7SUFFQSxNQUFNQyxJQUFJLEdBQUdWLE1BQU0sQ0FBQ00sUUFBUSxDQUFDSyxXQUFXLENBQUMsQ0FBQztJQUMxQyxJQUFJTixJQUFJLEdBQUdMLE1BQU0sQ0FBQ0ssSUFBSTtJQUN0QixJQUFJTyxRQUFnQjtJQUNwQixJQUFJQyxTQUFTO0lBQ2IsSUFBSUMsY0FBMEI7SUFDOUI7SUFDQTtJQUNBLElBQUlkLE1BQU0sQ0FBQ0ksTUFBTSxFQUFFO01BQ2pCO01BQ0FTLFNBQVMsR0FBR25GLEtBQUs7TUFDakJrRixRQUFRLEdBQUcsUUFBUTtNQUNuQlAsSUFBSSxHQUFHQSxJQUFJLElBQUksR0FBRztNQUNsQlMsY0FBYyxHQUFHcEYsS0FBSyxDQUFDcUYsV0FBVztJQUNwQyxDQUFDLE1BQU07TUFDTEYsU0FBUyxHQUFHcEYsSUFBSTtNQUNoQm1GLFFBQVEsR0FBRyxPQUFPO01BQ2xCUCxJQUFJLEdBQUdBLElBQUksSUFBSSxFQUFFO01BQ2pCUyxjQUFjLEdBQUdyRixJQUFJLENBQUNzRixXQUFXO0lBQ25DOztJQUVBO0lBQ0EsSUFBSWYsTUFBTSxDQUFDYSxTQUFTLEVBQUU7TUFDcEIsSUFBSSxDQUFDdEQsUUFBUSxDQUFDeUMsTUFBTSxDQUFDYSxTQUFTLENBQUMsRUFBRTtRQUMvQixNQUFNLElBQUl6RSxNQUFNLENBQUNvRSxvQkFBb0IsQ0FDbEMsNEJBQTJCUixNQUFNLENBQUNhLFNBQVUsZ0NBQy9DLENBQUM7TUFDSDtNQUNBQSxTQUFTLEdBQUdiLE1BQU0sQ0FBQ2EsU0FBUztJQUM5Qjs7SUFFQTtJQUNBLElBQUliLE1BQU0sQ0FBQ2MsY0FBYyxFQUFFO01BQ3pCLElBQUksQ0FBQ3ZELFFBQVEsQ0FBQ3lDLE1BQU0sQ0FBQ2MsY0FBYyxDQUFDLEVBQUU7UUFDcEMsTUFBTSxJQUFJMUUsTUFBTSxDQUFDb0Usb0JBQW9CLENBQ2xDLGdDQUErQlIsTUFBTSxDQUFDYyxjQUFlLGdDQUN4RCxDQUFDO01BQ0g7TUFFQUEsY0FBYyxHQUFHZCxNQUFNLENBQUNjLGNBQWM7SUFDeEM7O0lBRUE7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBLE1BQU1FLGVBQWUsR0FBSSxJQUFHQyxPQUFPLENBQUNDLFFBQVMsS0FBSUQsT0FBTyxDQUFDRSxJQUFLLEdBQUU7SUFDaEUsTUFBTUMsWUFBWSxHQUFJLFNBQVFKLGVBQWdCLGFBQVl4QixPQUFPLENBQUNDLE9BQVEsRUFBQztJQUMzRTs7SUFFQSxJQUFJLENBQUNvQixTQUFTLEdBQUdBLFNBQVM7SUFDMUIsSUFBSSxDQUFDQyxjQUFjLEdBQUdBLGNBQWM7SUFDcEMsSUFBSSxDQUFDSixJQUFJLEdBQUdBLElBQUk7SUFDaEIsSUFBSSxDQUFDTCxJQUFJLEdBQUdBLElBQUk7SUFDaEIsSUFBSSxDQUFDTyxRQUFRLEdBQUdBLFFBQVE7SUFDeEIsSUFBSSxDQUFDUyxTQUFTLEdBQUksR0FBRUQsWUFBYSxFQUFDOztJQUVsQztJQUNBLElBQUlwQixNQUFNLENBQUNzQixTQUFTLEtBQUtwQixTQUFTLEVBQUU7TUFDbEMsSUFBSSxDQUFDb0IsU0FBUyxHQUFHLElBQUk7SUFDdkIsQ0FBQyxNQUFNO01BQ0wsSUFBSSxDQUFDQSxTQUFTLEdBQUd0QixNQUFNLENBQUNzQixTQUFTO0lBQ25DO0lBRUEsSUFBSSxDQUFDQyxTQUFTLEdBQUd2QixNQUFNLENBQUN1QixTQUFTLElBQUksRUFBRTtJQUN2QyxJQUFJLENBQUNDLFNBQVMsR0FBR3hCLE1BQU0sQ0FBQ3dCLFNBQVMsSUFBSSxFQUFFO0lBQ3ZDLElBQUksQ0FBQ0MsWUFBWSxHQUFHekIsTUFBTSxDQUFDeUIsWUFBWTtJQUN2QyxJQUFJLENBQUNDLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQ0gsU0FBUyxJQUFJLENBQUMsSUFBSSxDQUFDQyxTQUFTO0lBRW5ELElBQUl4QixNQUFNLENBQUMyQixtQkFBbUIsRUFBRTtNQUM5QixJQUFJLENBQUNBLG1CQUFtQixHQUFHM0IsTUFBTSxDQUFDMkIsbUJBQW1CO0lBQ3ZEO0lBRUEsSUFBSSxDQUFDQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ25CLElBQUk1QixNQUFNLENBQUNTLE1BQU0sRUFBRTtNQUNqQixJQUFJLENBQUNBLE1BQU0sR0FBR1QsTUFBTSxDQUFDUyxNQUFNO0lBQzdCO0lBRUEsSUFBSVQsTUFBTSxDQUFDSixRQUFRLEVBQUU7TUFDbkIsSUFBSSxDQUFDQSxRQUFRLEdBQUdJLE1BQU0sQ0FBQ0osUUFBUTtNQUMvQixJQUFJLENBQUNpQyxnQkFBZ0IsR0FBRyxJQUFJO0lBQzlCO0lBQ0EsSUFBSSxJQUFJLENBQUNqQyxRQUFRLEdBQUcsQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLEVBQUU7TUFDbkMsTUFBTSxJQUFJeEQsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsc0NBQXFDLENBQUM7SUFDL0U7SUFDQSxJQUFJLElBQUksQ0FBQ1osUUFBUSxHQUFHLENBQUMsR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksRUFBRTtNQUMxQyxNQUFNLElBQUl4RCxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBRSxtQ0FBa0MsQ0FBQztJQUM1RTs7SUFFQTtJQUNBO0lBQ0E7SUFDQSxJQUFJLENBQUNzQixZQUFZLEdBQUcsQ0FBQyxJQUFJLENBQUNKLFNBQVMsSUFBSSxDQUFDMUIsTUFBTSxDQUFDSSxNQUFNO0lBRXJELElBQUksQ0FBQzJCLG9CQUFvQixHQUFHL0IsTUFBTSxDQUFDK0Isb0JBQW9CLElBQUk3QixTQUFTO0lBQ3BFLElBQUksQ0FBQzhCLFVBQVUsR0FBRyxDQUFDLENBQUM7SUFDcEIsSUFBSSxDQUFDQyxnQkFBZ0IsR0FBRyxJQUFJckYsVUFBVSxDQUFDLElBQUksQ0FBQztFQUM5Qzs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxJQUFJc0YsVUFBVUEsQ0FBQSxFQUFHO0lBQ2YsT0FBTyxJQUFJLENBQUNELGdCQUFnQjtFQUM5Qjs7RUFFQTtBQUNGO0FBQ0E7RUFDRUUsdUJBQXVCQSxDQUFDN0IsUUFBZ0IsRUFBRTtJQUN4QyxJQUFJLENBQUN5QixvQkFBb0IsR0FBR3pCLFFBQVE7RUFDdEM7O0VBRUE7QUFDRjtBQUNBO0VBQ1M4QixpQkFBaUJBLENBQUNDLE9BQTZFLEVBQUU7SUFDdEcsSUFBSSxDQUFDOUUsUUFBUSxDQUFDOEUsT0FBTyxDQUFDLEVBQUU7TUFDdEIsTUFBTSxJQUFJQyxTQUFTLENBQUMsNENBQTRDLENBQUM7SUFDbkU7SUFDQSxJQUFJLENBQUNOLFVBQVUsR0FBR2hHLENBQUMsQ0FBQ3VHLElBQUksQ0FBQ0YsT0FBTyxFQUFFM0MsdUJBQXVCLENBQUM7RUFDNUQ7O0VBRUE7QUFDRjtBQUNBO0VBQ1U4QywwQkFBMEJBLENBQUNDLFVBQW1CLEVBQUVDLFVBQW1CLEVBQUU7SUFDM0UsSUFBSSxDQUFDckYsT0FBTyxDQUFDLElBQUksQ0FBQzBFLG9CQUFvQixDQUFDLElBQUksQ0FBQzFFLE9BQU8sQ0FBQ29GLFVBQVUsQ0FBQyxJQUFJLENBQUNwRixPQUFPLENBQUNxRixVQUFVLENBQUMsRUFBRTtNQUN2RjtNQUNBO01BQ0EsSUFBSUQsVUFBVSxDQUFDRSxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7UUFDNUIsTUFBTSxJQUFJeEMsS0FBSyxDQUFFLG1FQUFrRXNDLFVBQVcsRUFBQyxDQUFDO01BQ2xHO01BQ0E7TUFDQTtNQUNBO01BQ0EsT0FBTyxJQUFJLENBQUNWLG9CQUFvQjtJQUNsQztJQUNBLE9BQU8sS0FBSztFQUNkOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0VBQ1lhLGlCQUFpQkEsQ0FDekJDLElBRUMsRUFJRDtJQUNBLE1BQU1DLE1BQU0sR0FBR0QsSUFBSSxDQUFDQyxNQUFNO0lBQzFCLE1BQU1yQyxNQUFNLEdBQUdvQyxJQUFJLENBQUNwQyxNQUFNO0lBQzFCLE1BQU1nQyxVQUFVLEdBQUdJLElBQUksQ0FBQ0osVUFBVTtJQUNsQyxJQUFJQyxVQUFVLEdBQUdHLElBQUksQ0FBQ0gsVUFBVTtJQUNoQyxNQUFNSyxPQUFPLEdBQUdGLElBQUksQ0FBQ0UsT0FBTztJQUM1QixNQUFNQyxLQUFLLEdBQUdILElBQUksQ0FBQ0csS0FBSztJQUV4QixJQUFJaEIsVUFBVSxHQUFHO01BQ2ZjLE1BQU07TUFDTkMsT0FBTyxFQUFFLENBQUMsQ0FBbUI7TUFDN0JuQyxRQUFRLEVBQUUsSUFBSSxDQUFDQSxRQUFRO01BQ3ZCO01BQ0FxQyxLQUFLLEVBQUUsSUFBSSxDQUFDbkM7SUFDZCxDQUFDOztJQUVEO0lBQ0EsSUFBSW9DLGdCQUFnQjtJQUNwQixJQUFJVCxVQUFVLEVBQUU7TUFDZFMsZ0JBQWdCLEdBQUduRixrQkFBa0IsQ0FBQyxJQUFJLENBQUMyQyxJQUFJLEVBQUUsSUFBSSxDQUFDRSxRQUFRLEVBQUU2QixVQUFVLEVBQUUsSUFBSSxDQUFDbkIsU0FBUyxDQUFDO0lBQzdGO0lBRUEsSUFBSTNGLElBQUksR0FBRyxHQUFHO0lBQ2QsSUFBSStFLElBQUksR0FBRyxJQUFJLENBQUNBLElBQUk7SUFFcEIsSUFBSUwsSUFBd0I7SUFDNUIsSUFBSSxJQUFJLENBQUNBLElBQUksRUFBRTtNQUNiQSxJQUFJLEdBQUcsSUFBSSxDQUFDQSxJQUFJO0lBQ2xCO0lBRUEsSUFBSXFDLFVBQVUsRUFBRTtNQUNkQSxVQUFVLEdBQUduRSxpQkFBaUIsQ0FBQ21FLFVBQVUsQ0FBQztJQUM1Qzs7SUFFQTtJQUNBLElBQUl4RixnQkFBZ0IsQ0FBQ3dELElBQUksQ0FBQyxFQUFFO01BQzFCLE1BQU15QyxrQkFBa0IsR0FBRyxJQUFJLENBQUNYLDBCQUEwQixDQUFDQyxVQUFVLEVBQUVDLFVBQVUsQ0FBQztNQUNsRixJQUFJUyxrQkFBa0IsRUFBRTtRQUN0QnpDLElBQUksR0FBSSxHQUFFeUMsa0JBQW1CLEVBQUM7TUFDaEMsQ0FBQyxNQUFNO1FBQ0x6QyxJQUFJLEdBQUc3QixhQUFhLENBQUM0QixNQUFNLENBQUM7TUFDOUI7SUFDRjtJQUVBLElBQUl5QyxnQkFBZ0IsSUFBSSxDQUFDTCxJQUFJLENBQUN2QixTQUFTLEVBQUU7TUFDdkM7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLElBQUltQixVQUFVLEVBQUU7UUFDZC9CLElBQUksR0FBSSxHQUFFK0IsVUFBVyxJQUFHL0IsSUFBSyxFQUFDO01BQ2hDO01BQ0EsSUFBSWdDLFVBQVUsRUFBRTtRQUNkL0csSUFBSSxHQUFJLElBQUcrRyxVQUFXLEVBQUM7TUFDekI7SUFDRixDQUFDLE1BQU07TUFDTDtNQUNBO01BQ0E7TUFDQSxJQUFJRCxVQUFVLEVBQUU7UUFDZDlHLElBQUksR0FBSSxJQUFHOEcsVUFBVyxFQUFDO01BQ3pCO01BQ0EsSUFBSUMsVUFBVSxFQUFFO1FBQ2QvRyxJQUFJLEdBQUksSUFBRzhHLFVBQVcsSUFBR0MsVUFBVyxFQUFDO01BQ3ZDO0lBQ0Y7SUFFQSxJQUFJTSxLQUFLLEVBQUU7TUFDVHJILElBQUksSUFBSyxJQUFHcUgsS0FBTSxFQUFDO0lBQ3JCO0lBQ0FoQixVQUFVLENBQUNlLE9BQU8sQ0FBQ3JDLElBQUksR0FBR0EsSUFBSTtJQUM5QixJQUFLc0IsVUFBVSxDQUFDcEIsUUFBUSxLQUFLLE9BQU8sSUFBSVAsSUFBSSxLQUFLLEVBQUUsSUFBTTJCLFVBQVUsQ0FBQ3BCLFFBQVEsS0FBSyxRQUFRLElBQUlQLElBQUksS0FBSyxHQUFJLEVBQUU7TUFDMUcyQixVQUFVLENBQUNlLE9BQU8sQ0FBQ3JDLElBQUksR0FBR2xDLFlBQVksQ0FBQ2tDLElBQUksRUFBRUwsSUFBSSxDQUFDO0lBQ3BEO0lBRUEyQixVQUFVLENBQUNlLE9BQU8sQ0FBQyxZQUFZLENBQUMsR0FBRyxJQUFJLENBQUMxQixTQUFTO0lBQ2pELElBQUkwQixPQUFPLEVBQUU7TUFDWDtNQUNBLEtBQUssTUFBTSxDQUFDSyxDQUFDLEVBQUVDLENBQUMsQ0FBQyxJQUFJQyxNQUFNLENBQUNDLE9BQU8sQ0FBQ1IsT0FBTyxDQUFDLEVBQUU7UUFDNUNmLFVBQVUsQ0FBQ2UsT0FBTyxDQUFDSyxDQUFDLENBQUN6QyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcwQyxDQUFDO01BQ3pDO0lBQ0Y7O0lBRUE7SUFDQXJCLFVBQVUsR0FBR3NCLE1BQU0sQ0FBQ0UsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQ3hCLFVBQVUsRUFBRUEsVUFBVSxDQUFDO0lBRTNELE9BQU87TUFDTCxHQUFHQSxVQUFVO01BQ2JlLE9BQU8sRUFBRS9HLENBQUMsQ0FBQ3lILFNBQVMsQ0FBQ3pILENBQUMsQ0FBQzBILE1BQU0sQ0FBQzFCLFVBQVUsQ0FBQ2UsT0FBTyxFQUFFM0YsU0FBUyxDQUFDLEVBQUdpRyxDQUFDLElBQUtBLENBQUMsQ0FBQ00sUUFBUSxDQUFDLENBQUMsQ0FBQztNQUNsRmpELElBQUk7TUFDSkwsSUFBSTtNQUNKMUU7SUFDRixDQUFDO0VBQ0g7RUFFQSxNQUFhaUksc0JBQXNCQSxDQUFDakMsbUJBQXVDLEVBQUU7SUFDM0UsSUFBSSxFQUFFQSxtQkFBbUIsWUFBWXhGLGtCQUFrQixDQUFDLEVBQUU7TUFDeEQsTUFBTSxJQUFJZ0UsS0FBSyxDQUFDLG9FQUFvRSxDQUFDO0lBQ3ZGO0lBQ0EsSUFBSSxDQUFDd0IsbUJBQW1CLEdBQUdBLG1CQUFtQjtJQUM5QyxNQUFNLElBQUksQ0FBQ2tDLG9CQUFvQixDQUFDLENBQUM7RUFDbkM7RUFFQSxNQUFjQSxvQkFBb0JBLENBQUEsRUFBRztJQUNuQyxJQUFJLElBQUksQ0FBQ2xDLG1CQUFtQixFQUFFO01BQzVCLElBQUk7UUFDRixNQUFNbUMsZUFBZSxHQUFHLE1BQU0sSUFBSSxDQUFDbkMsbUJBQW1CLENBQUNvQyxjQUFjLENBQUMsQ0FBQztRQUN2RSxJQUFJLENBQUN4QyxTQUFTLEdBQUd1QyxlQUFlLENBQUNFLFlBQVksQ0FBQyxDQUFDO1FBQy9DLElBQUksQ0FBQ3hDLFNBQVMsR0FBR3NDLGVBQWUsQ0FBQ0csWUFBWSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDeEMsWUFBWSxHQUFHcUMsZUFBZSxDQUFDSSxlQUFlLENBQUMsQ0FBQztNQUN2RCxDQUFDLENBQUMsT0FBT0MsQ0FBQyxFQUFFO1FBQ1YsTUFBTSxJQUFJaEUsS0FBSyxDQUFFLDhCQUE2QmdFLENBQUUsRUFBQyxFQUFFO1VBQUVDLEtBQUssRUFBRUQ7UUFBRSxDQUFDLENBQUM7TUFDbEU7SUFDRjtFQUNGO0VBSUE7QUFDRjtBQUNBO0VBQ1VFLE9BQU9BLENBQUNyQyxVQUFvQixFQUFFc0MsUUFBcUMsRUFBRUMsR0FBYSxFQUFFO0lBQzFGO0lBQ0EsSUFBSSxDQUFDLElBQUksQ0FBQ0MsU0FBUyxFQUFFO01BQ25CO0lBQ0Y7SUFDQSxJQUFJLENBQUNqSCxRQUFRLENBQUN5RSxVQUFVLENBQUMsRUFBRTtNQUN6QixNQUFNLElBQUlNLFNBQVMsQ0FBQyx1Q0FBdUMsQ0FBQztJQUM5RDtJQUNBLElBQUlnQyxRQUFRLElBQUksQ0FBQzlHLGdCQUFnQixDQUFDOEcsUUFBUSxDQUFDLEVBQUU7TUFDM0MsTUFBTSxJQUFJaEMsU0FBUyxDQUFDLHFDQUFxQyxDQUFDO0lBQzVEO0lBQ0EsSUFBSWlDLEdBQUcsSUFBSSxFQUFFQSxHQUFHLFlBQVlwRSxLQUFLLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUltQyxTQUFTLENBQUMsK0JBQStCLENBQUM7SUFDdEQ7SUFDQSxNQUFNa0MsU0FBUyxHQUFHLElBQUksQ0FBQ0EsU0FBUztJQUNoQyxNQUFNQyxVQUFVLEdBQUkxQixPQUF1QixJQUFLO01BQzlDTyxNQUFNLENBQUNDLE9BQU8sQ0FBQ1IsT0FBTyxDQUFDLENBQUMyQixPQUFPLENBQUMsQ0FBQyxDQUFDdEIsQ0FBQyxFQUFFQyxDQUFDLENBQUMsS0FBSztRQUMxQyxJQUFJRCxDQUFDLElBQUksZUFBZSxFQUFFO1VBQ3hCLElBQUkzRixRQUFRLENBQUM0RixDQUFDLENBQUMsRUFBRTtZQUNmLE1BQU1zQixRQUFRLEdBQUcsSUFBSUMsTUFBTSxDQUFDLHVCQUF1QixDQUFDO1lBQ3BEdkIsQ0FBQyxHQUFHQSxDQUFDLENBQUN3QixPQUFPLENBQUNGLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQztVQUNuRDtRQUNGO1FBQ0FILFNBQVMsQ0FBQ00sS0FBSyxDQUFFLEdBQUUxQixDQUFFLEtBQUlDLENBQUUsSUFBRyxDQUFDO01BQ2pDLENBQUMsQ0FBQztNQUNGbUIsU0FBUyxDQUFDTSxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3ZCLENBQUM7SUFDRE4sU0FBUyxDQUFDTSxLQUFLLENBQUUsWUFBVzlDLFVBQVUsQ0FBQ2MsTUFBTyxJQUFHZCxVQUFVLENBQUNyRyxJQUFLLElBQUcsQ0FBQztJQUNyRThJLFVBQVUsQ0FBQ3pDLFVBQVUsQ0FBQ2UsT0FBTyxDQUFDO0lBQzlCLElBQUl1QixRQUFRLEVBQUU7TUFDWixJQUFJLENBQUNFLFNBQVMsQ0FBQ00sS0FBSyxDQUFFLGFBQVlSLFFBQVEsQ0FBQ1MsVUFBVyxJQUFHLENBQUM7TUFDMUROLFVBQVUsQ0FBQ0gsUUFBUSxDQUFDdkIsT0FBeUIsQ0FBQztJQUNoRDtJQUNBLElBQUl3QixHQUFHLEVBQUU7TUFDUEMsU0FBUyxDQUFDTSxLQUFLLENBQUMsZUFBZSxDQUFDO01BQ2hDLE1BQU1FLE9BQU8sR0FBR0MsSUFBSSxDQUFDQyxTQUFTLENBQUNYLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDO01BQy9DQyxTQUFTLENBQUNNLEtBQUssQ0FBRSxHQUFFRSxPQUFRLElBQUcsQ0FBQztJQUNqQztFQUNGOztFQUVBO0FBQ0Y7QUFDQTtFQUNTRyxPQUFPQSxDQUFDdkosTUFBd0IsRUFBRTtJQUN2QyxJQUFJLENBQUNBLE1BQU0sRUFBRTtNQUNYQSxNQUFNLEdBQUdxRixPQUFPLENBQUNtRSxNQUFNO0lBQ3pCO0lBQ0EsSUFBSSxDQUFDWixTQUFTLEdBQUc1SSxNQUFNO0VBQ3pCOztFQUVBO0FBQ0Y7QUFDQTtFQUNTeUosUUFBUUEsQ0FBQSxFQUFHO0lBQ2hCLElBQUksQ0FBQ2IsU0FBUyxHQUFHdEUsU0FBUztFQUM1Qjs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFLE1BQU1vRixnQkFBZ0JBLENBQ3BCakQsT0FBc0IsRUFDdEJrRCxPQUFlLEdBQUcsRUFBRSxFQUNwQkMsYUFBdUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUMvQi9FLE1BQU0sR0FBRyxFQUFFLEVBQ29CO0lBQy9CLElBQUksQ0FBQ2xELFFBQVEsQ0FBQzhFLE9BQU8sQ0FBQyxFQUFFO01BQ3RCLE1BQU0sSUFBSUMsU0FBUyxDQUFDLG9DQUFvQyxDQUFDO0lBQzNEO0lBQ0EsSUFBSSxDQUFDN0UsUUFBUSxDQUFDOEgsT0FBTyxDQUFDLElBQUksQ0FBQ2hJLFFBQVEsQ0FBQ2dJLE9BQU8sQ0FBQyxFQUFFO01BQzVDO01BQ0EsTUFBTSxJQUFJakQsU0FBUyxDQUFDLGdEQUFnRCxDQUFDO0lBQ3ZFO0lBQ0FrRCxhQUFhLENBQUNkLE9BQU8sQ0FBRUssVUFBVSxJQUFLO01BQ3BDLElBQUksQ0FBQ3pILFFBQVEsQ0FBQ3lILFVBQVUsQ0FBQyxFQUFFO1FBQ3pCLE1BQU0sSUFBSXpDLFNBQVMsQ0FBQyx1Q0FBdUMsQ0FBQztNQUM5RDtJQUNGLENBQUMsQ0FBQztJQUNGLElBQUksQ0FBQzdFLFFBQVEsQ0FBQ2dELE1BQU0sQ0FBQyxFQUFFO01BQ3JCLE1BQU0sSUFBSTZCLFNBQVMsQ0FBQyxtQ0FBbUMsQ0FBQztJQUMxRDtJQUNBLElBQUksQ0FBQ0QsT0FBTyxDQUFDVSxPQUFPLEVBQUU7TUFDcEJWLE9BQU8sQ0FBQ1UsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUN0QjtJQUNBLElBQUlWLE9BQU8sQ0FBQ1MsTUFBTSxLQUFLLE1BQU0sSUFBSVQsT0FBTyxDQUFDUyxNQUFNLEtBQUssS0FBSyxJQUFJVCxPQUFPLENBQUNTLE1BQU0sS0FBSyxRQUFRLEVBQUU7TUFDeEZULE9BQU8sQ0FBQ1UsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEdBQUd3QyxPQUFPLENBQUNFLE1BQU0sQ0FBQzlCLFFBQVEsQ0FBQyxDQUFDO0lBQy9EO0lBQ0EsTUFBTStCLFNBQVMsR0FBRyxJQUFJLENBQUM1RCxZQUFZLEdBQUd6RCxRQUFRLENBQUNrSCxPQUFPLENBQUMsR0FBRyxFQUFFO0lBQzVELE9BQU8sSUFBSSxDQUFDSSxzQkFBc0IsQ0FBQ3RELE9BQU8sRUFBRWtELE9BQU8sRUFBRUcsU0FBUyxFQUFFRixhQUFhLEVBQUUvRSxNQUFNLENBQUM7RUFDeEY7O0VBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtFQUNFLE1BQU1tRixvQkFBb0JBLENBQ3hCdkQsT0FBc0IsRUFDdEJrRCxPQUFlLEdBQUcsRUFBRSxFQUNwQk0sV0FBcUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUM3QnBGLE1BQU0sR0FBRyxFQUFFLEVBQ2dDO0lBQzNDLE1BQU1xRixHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNSLGdCQUFnQixDQUFDakQsT0FBTyxFQUFFa0QsT0FBTyxFQUFFTSxXQUFXLEVBQUVwRixNQUFNLENBQUM7SUFDOUUsTUFBTS9CLGFBQWEsQ0FBQ29ILEdBQUcsQ0FBQztJQUN4QixPQUFPQSxHQUFHO0VBQ1o7O0VBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0UsTUFBTUgsc0JBQXNCQSxDQUMxQnRELE9BQXNCLEVBQ3RCMEQsSUFBOEIsRUFDOUJMLFNBQWlCLEVBQ2pCRyxXQUFxQixFQUNyQnBGLE1BQWMsRUFDaUI7SUFDL0IsSUFBSSxDQUFDbEQsUUFBUSxDQUFDOEUsT0FBTyxDQUFDLEVBQUU7TUFDdEIsTUFBTSxJQUFJQyxTQUFTLENBQUMsb0NBQW9DLENBQUM7SUFDM0Q7SUFDQSxJQUFJLEVBQUUwRCxNQUFNLENBQUNDLFFBQVEsQ0FBQ0YsSUFBSSxDQUFDLElBQUksT0FBT0EsSUFBSSxLQUFLLFFBQVEsSUFBSXZJLGdCQUFnQixDQUFDdUksSUFBSSxDQUFDLENBQUMsRUFBRTtNQUNsRixNQUFNLElBQUkzSixNQUFNLENBQUNvRSxvQkFBb0IsQ0FDbEMsNkRBQTRELE9BQU91RixJQUFLLFVBQzNFLENBQUM7SUFDSDtJQUNBLElBQUksQ0FBQ3RJLFFBQVEsQ0FBQ2lJLFNBQVMsQ0FBQyxFQUFFO01BQ3hCLE1BQU0sSUFBSXBELFNBQVMsQ0FBQyxzQ0FBc0MsQ0FBQztJQUM3RDtJQUNBdUQsV0FBVyxDQUFDbkIsT0FBTyxDQUFFSyxVQUFVLElBQUs7TUFDbEMsSUFBSSxDQUFDekgsUUFBUSxDQUFDeUgsVUFBVSxDQUFDLEVBQUU7UUFDekIsTUFBTSxJQUFJekMsU0FBUyxDQUFDLHVDQUF1QyxDQUFDO01BQzlEO0lBQ0YsQ0FBQyxDQUFDO0lBQ0YsSUFBSSxDQUFDN0UsUUFBUSxDQUFDZ0QsTUFBTSxDQUFDLEVBQUU7TUFDckIsTUFBTSxJQUFJNkIsU0FBUyxDQUFDLG1DQUFtQyxDQUFDO0lBQzFEO0lBQ0E7SUFDQSxJQUFJLENBQUMsSUFBSSxDQUFDUixZQUFZLElBQUk0RCxTQUFTLENBQUNELE1BQU0sS0FBSyxDQUFDLEVBQUU7TUFDaEQsTUFBTSxJQUFJckosTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsZ0VBQStELENBQUM7SUFDekc7SUFDQTtJQUNBLElBQUksSUFBSSxDQUFDc0IsWUFBWSxJQUFJNEQsU0FBUyxDQUFDRCxNQUFNLEtBQUssRUFBRSxFQUFFO01BQ2hELE1BQU0sSUFBSXJKLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFFLHVCQUFzQmtGLFNBQVUsRUFBQyxDQUFDO0lBQzNFO0lBRUEsTUFBTSxJQUFJLENBQUM3QixvQkFBb0IsQ0FBQyxDQUFDOztJQUVqQztJQUNBcEQsTUFBTSxHQUFHQSxNQUFNLEtBQUssTUFBTSxJQUFJLENBQUN5RixvQkFBb0IsQ0FBQzdELE9BQU8sQ0FBQ0ksVUFBVyxDQUFDLENBQUM7SUFFekUsTUFBTVQsVUFBVSxHQUFHLElBQUksQ0FBQ1ksaUJBQWlCLENBQUM7TUFBRSxHQUFHUCxPQUFPO01BQUU1QjtJQUFPLENBQUMsQ0FBQztJQUNqRSxJQUFJLENBQUMsSUFBSSxDQUFDaUIsU0FBUyxFQUFFO01BQ25CO01BQ0EsSUFBSSxDQUFDLElBQUksQ0FBQ0ksWUFBWSxFQUFFO1FBQ3RCNEQsU0FBUyxHQUFHLGtCQUFrQjtNQUNoQztNQUNBLE1BQU1TLElBQUksR0FBRyxJQUFJQyxJQUFJLENBQUMsQ0FBQztNQUN2QnBFLFVBQVUsQ0FBQ2UsT0FBTyxDQUFDLFlBQVksQ0FBQyxHQUFHL0UsWUFBWSxDQUFDbUksSUFBSSxDQUFDO01BQ3JEbkUsVUFBVSxDQUFDZSxPQUFPLENBQUMsc0JBQXNCLENBQUMsR0FBRzJDLFNBQVM7TUFDdEQsSUFBSSxJQUFJLENBQUNqRSxZQUFZLEVBQUU7UUFDckJPLFVBQVUsQ0FBQ2UsT0FBTyxDQUFDLHNCQUFzQixDQUFDLEdBQUcsSUFBSSxDQUFDdEIsWUFBWTtNQUNoRTtNQUNBTyxVQUFVLENBQUNlLE9BQU8sQ0FBQ3NELGFBQWEsR0FBRzVKLE1BQU0sQ0FBQ3VGLFVBQVUsRUFBRSxJQUFJLENBQUNULFNBQVMsRUFBRSxJQUFJLENBQUNDLFNBQVMsRUFBRWYsTUFBTSxFQUFFMEYsSUFBSSxFQUFFVCxTQUFTLENBQUM7SUFDaEg7SUFFQSxNQUFNcEIsUUFBUSxHQUFHLE1BQU03RixPQUFPLENBQUMsSUFBSSxDQUFDb0MsU0FBUyxFQUFFbUIsVUFBVSxFQUFFK0QsSUFBSSxDQUFDO0lBQ2hFLElBQUksQ0FBQ3pCLFFBQVEsQ0FBQ1MsVUFBVSxFQUFFO01BQ3hCLE1BQU0sSUFBSTVFLEtBQUssQ0FBQyx5Q0FBeUMsQ0FBQztJQUM1RDtJQUVBLElBQUksQ0FBQzBGLFdBQVcsQ0FBQ2xELFFBQVEsQ0FBQzJCLFFBQVEsQ0FBQ1MsVUFBVSxDQUFDLEVBQUU7TUFDOUM7TUFDQTtNQUNBO01BQ0E7TUFDQTtNQUNBLE9BQU8sSUFBSSxDQUFDbkQsU0FBUyxDQUFDUyxPQUFPLENBQUNJLFVBQVUsQ0FBRTtNQUUxQyxNQUFNOEIsR0FBRyxHQUFHLE1BQU1yRixVQUFVLENBQUNvSCxrQkFBa0IsQ0FBQ2hDLFFBQVEsQ0FBQztNQUN6RCxJQUFJLENBQUNELE9BQU8sQ0FBQ3JDLFVBQVUsRUFBRXNDLFFBQVEsRUFBRUMsR0FBRyxDQUFDO01BQ3ZDLE1BQU1BLEdBQUc7SUFDWDtJQUVBLElBQUksQ0FBQ0YsT0FBTyxDQUFDckMsVUFBVSxFQUFFc0MsUUFBUSxDQUFDO0lBRWxDLE9BQU9BLFFBQVE7RUFDakI7O0VBRUE7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRSxNQUFnQjRCLG9CQUFvQkEsQ0FBQ3pELFVBQWtCLEVBQW1CO0lBQ3hFLElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUUseUJBQXdCOUQsVUFBVyxFQUFDLENBQUM7SUFDaEY7O0lBRUE7SUFDQSxJQUFJLElBQUksQ0FBQ2hDLE1BQU0sRUFBRTtNQUNmLE9BQU8sSUFBSSxDQUFDQSxNQUFNO0lBQ3BCO0lBRUEsTUFBTStGLE1BQU0sR0FBRyxJQUFJLENBQUM1RSxTQUFTLENBQUNhLFVBQVUsQ0FBQztJQUN6QyxJQUFJK0QsTUFBTSxFQUFFO01BQ1YsT0FBT0EsTUFBTTtJQUNmO0lBRUEsTUFBTUMsa0JBQWtCLEdBQUcsTUFBT25DLFFBQThCLElBQUs7TUFDbkUsTUFBTXlCLElBQUksR0FBRyxNQUFNbkgsWUFBWSxDQUFDMEYsUUFBUSxDQUFDO01BQ3pDLE1BQU03RCxNQUFNLEdBQUd2QixVQUFVLENBQUN3SCxpQkFBaUIsQ0FBQ1gsSUFBSSxDQUFDLElBQUkxSixjQUFjO01BQ25FLElBQUksQ0FBQ3VGLFNBQVMsQ0FBQ2EsVUFBVSxDQUFDLEdBQUdoQyxNQUFNO01BQ25DLE9BQU9BLE1BQU07SUFDZixDQUFDO0lBRUQsTUFBTXFDLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLE1BQU1FLEtBQUssR0FBRyxVQUFVO0lBQ3hCO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQSxNQUFNMUIsU0FBUyxHQUFHLElBQUksQ0FBQ0EsU0FBUyxJQUFJLENBQUN2RixTQUFTO0lBQzlDLElBQUkwRSxNQUFjO0lBQ2xCLElBQUk7TUFDRixNQUFNcUYsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDUixnQkFBZ0IsQ0FBQztRQUFFeEMsTUFBTTtRQUFFTCxVQUFVO1FBQUVPLEtBQUs7UUFBRTFCO01BQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFakYsY0FBYyxDQUFDO01BQzVHLE9BQU9vSyxrQkFBa0IsQ0FBQ1gsR0FBRyxDQUFDO0lBQ2hDLENBQUMsQ0FBQyxPQUFPM0IsQ0FBQyxFQUFFO01BQ1Y7TUFDQTtNQUNBLElBQUksRUFBRUEsQ0FBQyxDQUFDd0MsSUFBSSxLQUFLLDhCQUE4QixDQUFDLEVBQUU7UUFDaEQsTUFBTXhDLENBQUM7TUFDVDtNQUNBO01BQ0ExRCxNQUFNLEdBQUcwRCxDQUFDLENBQUN5QyxNQUFnQjtNQUMzQixJQUFJLENBQUNuRyxNQUFNLEVBQUU7UUFDWCxNQUFNMEQsQ0FBQztNQUNUO0lBQ0Y7SUFFQSxNQUFNMkIsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDUixnQkFBZ0IsQ0FBQztNQUFFeEMsTUFBTTtNQUFFTCxVQUFVO01BQUVPLEtBQUs7TUFBRTFCO0lBQVUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFYixNQUFNLENBQUM7SUFDcEcsT0FBTyxNQUFNZ0csa0JBQWtCLENBQUNYLEdBQUcsQ0FBQztFQUN0Qzs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFZSxXQUFXQSxDQUNUeEUsT0FBc0IsRUFDdEJrRCxPQUFlLEdBQUcsRUFBRSxFQUNwQkMsYUFBdUIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUMvQi9FLE1BQU0sR0FBRyxFQUFFLEVBQ1hxRyxjQUF1QixFQUN2QkMsRUFBdUQsRUFDdkQ7SUFDQSxJQUFJQyxJQUFtQztJQUN2QyxJQUFJRixjQUFjLEVBQUU7TUFDbEJFLElBQUksR0FBRyxJQUFJLENBQUMxQixnQkFBZ0IsQ0FBQ2pELE9BQU8sRUFBRWtELE9BQU8sRUFBRUMsYUFBYSxFQUFFL0UsTUFBTSxDQUFDO0lBQ3ZFLENBQUMsTUFBTTtNQUNMO01BQ0E7TUFDQXVHLElBQUksR0FBRyxJQUFJLENBQUNwQixvQkFBb0IsQ0FBQ3ZELE9BQU8sRUFBRWtELE9BQU8sRUFBRUMsYUFBYSxFQUFFL0UsTUFBTSxDQUFDO0lBQzNFO0lBRUF1RyxJQUFJLENBQUNDLElBQUksQ0FDTkMsTUFBTSxJQUFLSCxFQUFFLENBQUMsSUFBSSxFQUFFRyxNQUFNLENBQUMsRUFDM0IzQyxHQUFHLElBQUs7TUFDUDtNQUNBO01BQ0F3QyxFQUFFLENBQUN4QyxHQUFHLENBQUM7SUFDVCxDQUNGLENBQUM7RUFDSDs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRTRDLGlCQUFpQkEsQ0FDZjlFLE9BQXNCLEVBQ3RCekcsTUFBZ0MsRUFDaEM4SixTQUFpQixFQUNqQkcsV0FBcUIsRUFDckJwRixNQUFjLEVBQ2RxRyxjQUF1QixFQUN2QkMsRUFBdUQsRUFDdkQ7SUFDQSxNQUFNSyxRQUFRLEdBQUcsTUFBQUEsQ0FBQSxLQUFZO01BQzNCLE1BQU10QixHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNILHNCQUFzQixDQUFDdEQsT0FBTyxFQUFFekcsTUFBTSxFQUFFOEosU0FBUyxFQUFFRyxXQUFXLEVBQUVwRixNQUFNLENBQUM7TUFDOUYsSUFBSSxDQUFDcUcsY0FBYyxFQUFFO1FBQ25CLE1BQU1wSSxhQUFhLENBQUNvSCxHQUFHLENBQUM7TUFDMUI7TUFFQSxPQUFPQSxHQUFHO0lBQ1osQ0FBQztJQUVEc0IsUUFBUSxDQUFDLENBQUMsQ0FBQ0gsSUFBSSxDQUNaQyxNQUFNLElBQUtILEVBQUUsQ0FBQyxJQUFJLEVBQUVHLE1BQU0sQ0FBQztJQUM1QjtJQUNBO0lBQ0MzQyxHQUFHLElBQUt3QyxFQUFFLENBQUN4QyxHQUFHLENBQ2pCLENBQUM7RUFDSDs7RUFFQTtBQUNGO0FBQ0E7RUFDRThDLGVBQWVBLENBQUM1RSxVQUFrQixFQUFFc0UsRUFBMEMsRUFBRTtJQUM5RSxPQUFPLElBQUksQ0FBQ2Isb0JBQW9CLENBQUN6RCxVQUFVLENBQUMsQ0FBQ3dFLElBQUksQ0FDOUNDLE1BQU0sSUFBS0gsRUFBRSxDQUFDLElBQUksRUFBRUcsTUFBTSxDQUFDO0lBQzVCO0lBQ0E7SUFDQzNDLEdBQUcsSUFBS3dDLEVBQUUsQ0FBQ3hDLEdBQUcsQ0FDakIsQ0FBQztFQUNIOztFQUVBOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0VBQ0UsTUFBTStDLFVBQVVBLENBQUM3RSxVQUFrQixFQUFFaEMsTUFBYyxHQUFHLEVBQUUsRUFBRThHLFFBQXVCLEdBQUcsQ0FBQyxDQUFDLEVBQWlCO0lBQ3JHLElBQUksQ0FBQzdKLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQTtJQUNBLElBQUlsRixRQUFRLENBQUNrRCxNQUFNLENBQUMsRUFBRTtNQUNwQjhHLFFBQVEsR0FBRzlHLE1BQU07TUFDakJBLE1BQU0sR0FBRyxFQUFFO0lBQ2I7SUFFQSxJQUFJLENBQUNoRCxRQUFRLENBQUNnRCxNQUFNLENBQUMsRUFBRTtNQUNyQixNQUFNLElBQUk2QixTQUFTLENBQUMsbUNBQW1DLENBQUM7SUFDMUQ7SUFDQSxJQUFJLENBQUMvRSxRQUFRLENBQUNnSyxRQUFRLENBQUMsRUFBRTtNQUN2QixNQUFNLElBQUlqRixTQUFTLENBQUMscUNBQXFDLENBQUM7SUFDNUQ7SUFFQSxJQUFJaUQsT0FBTyxHQUFHLEVBQUU7O0lBRWhCO0lBQ0E7SUFDQSxJQUFJOUUsTUFBTSxJQUFJLElBQUksQ0FBQ0EsTUFBTSxFQUFFO01BQ3pCLElBQUlBLE1BQU0sS0FBSyxJQUFJLENBQUNBLE1BQU0sRUFBRTtRQUMxQixNQUFNLElBQUlyRSxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBRSxxQkFBb0IsSUFBSSxDQUFDQyxNQUFPLGVBQWNBLE1BQU8sRUFBQyxDQUFDO01BQ2hHO0lBQ0Y7SUFDQTtJQUNBO0lBQ0EsSUFBSUEsTUFBTSxJQUFJQSxNQUFNLEtBQUtwRSxjQUFjLEVBQUU7TUFDdkNrSixPQUFPLEdBQUdwRyxHQUFHLENBQUNxSSxXQUFXLENBQUM7UUFDeEJDLHlCQUF5QixFQUFFO1VBQ3pCQyxDQUFDLEVBQUU7WUFBRUMsS0FBSyxFQUFFO1VBQTBDLENBQUM7VUFDdkRDLGtCQUFrQixFQUFFbkg7UUFDdEI7TUFDRixDQUFDLENBQUM7SUFDSjtJQUNBLE1BQU1xQyxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNQyxPQUF1QixHQUFHLENBQUMsQ0FBQztJQUVsQyxJQUFJd0UsUUFBUSxDQUFDTSxhQUFhLEVBQUU7TUFDMUI5RSxPQUFPLENBQUMsa0NBQWtDLENBQUMsR0FBRyxJQUFJO0lBQ3BEO0lBRUEsSUFBSSxDQUFDdEMsTUFBTSxFQUFFO01BQ1hBLE1BQU0sR0FBR3BFLGNBQWM7SUFDekI7SUFDQSxNQUFNeUwsV0FBVyxHQUFHckgsTUFBTSxFQUFDO0lBQzNCLE1BQU1zSCxVQUF5QixHQUFHO01BQUVqRixNQUFNO01BQUVMLFVBQVU7TUFBRU07SUFBUSxDQUFDO0lBRWpFLElBQUk7TUFDRixNQUFNLElBQUksQ0FBQzZDLG9CQUFvQixDQUFDbUMsVUFBVSxFQUFFeEMsT0FBTyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUV1QyxXQUFXLENBQUM7SUFDMUUsQ0FBQyxDQUFDLE9BQU92RCxHQUFZLEVBQUU7TUFDckIsSUFBSTlELE1BQU0sS0FBSyxFQUFFLElBQUlBLE1BQU0sS0FBS3BFLGNBQWMsRUFBRTtRQUM5QyxJQUFJa0ksR0FBRyxZQUFZbkksTUFBTSxDQUFDNEwsT0FBTyxFQUFFO1VBQ2pDLE1BQU1DLE9BQU8sR0FBRzFELEdBQUcsQ0FBQzJELElBQUk7VUFDeEIsTUFBTUMsU0FBUyxHQUFHNUQsR0FBRyxDQUFDOUQsTUFBTTtVQUM1QixJQUFJd0gsT0FBTyxLQUFLLDhCQUE4QixJQUFJRSxTQUFTLEtBQUssRUFBRSxFQUFFO1lBQ2xFO1lBQ0EsTUFBTSxJQUFJLENBQUN2QyxvQkFBb0IsQ0FBQ21DLFVBQVUsRUFBRXhDLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFMEMsT0FBTyxDQUFDO1VBQ3RFO1FBQ0Y7TUFDRjtNQUNBLE1BQU0xRCxHQUFHO0lBQ1g7RUFDRjs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNNkQsWUFBWUEsQ0FBQzNGLFVBQWtCLEVBQW9CO0lBQ3ZELElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxNQUFNSyxNQUFNLEdBQUcsTUFBTTtJQUNyQixJQUFJO01BQ0YsTUFBTSxJQUFJLENBQUM4QyxvQkFBb0IsQ0FBQztRQUFFOUMsTUFBTTtRQUFFTDtNQUFXLENBQUMsQ0FBQztJQUN6RCxDQUFDLENBQUMsT0FBTzhCLEdBQUcsRUFBRTtNQUNaO01BQ0EsSUFBSUEsR0FBRyxDQUFDMkQsSUFBSSxLQUFLLGNBQWMsSUFBSTNELEdBQUcsQ0FBQzJELElBQUksS0FBSyxVQUFVLEVBQUU7UUFDMUQsT0FBTyxLQUFLO01BQ2Q7TUFDQSxNQUFNM0QsR0FBRztJQUNYO0lBRUEsT0FBTyxJQUFJO0VBQ2I7O0VBSUE7QUFDRjtBQUNBOztFQUdFLE1BQU04RCxZQUFZQSxDQUFDNUYsVUFBa0IsRUFBaUI7SUFDcEQsSUFBSSxDQUFDL0UsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLE1BQU1LLE1BQU0sR0FBRyxRQUFRO0lBQ3ZCLE1BQU0sSUFBSSxDQUFDOEMsb0JBQW9CLENBQUM7TUFBRTlDLE1BQU07TUFBRUw7SUFBVyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbEUsT0FBTyxJQUFJLENBQUNiLFNBQVMsQ0FBQ2EsVUFBVSxDQUFDO0VBQ25DOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU02RixTQUFTQSxDQUNiN0YsVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCNkYsT0FBNkIsR0FBRyxDQUFDLENBQUMsRUFDUjtJQUMxQixJQUFJLENBQUM3SyxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDN0UsaUJBQWlCLENBQUM4RSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUl0RyxNQUFNLENBQUNvTSxzQkFBc0IsQ0FBRSx3QkFBdUI5RixVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUNBLE9BQU8sSUFBSSxDQUFDK0YsZ0JBQWdCLENBQUNoRyxVQUFVLEVBQUVDLFVBQVUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFNkYsT0FBTyxDQUFDO0VBQ3JFOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7RUFDRSxNQUFNRSxnQkFBZ0JBLENBQ3BCaEcsVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCZ0csTUFBYyxFQUNkakQsTUFBTSxHQUFHLENBQUMsRUFDVjhDLE9BQTZCLEdBQUcsQ0FBQyxDQUFDLEVBQ1I7SUFDMUIsSUFBSSxDQUFDN0ssaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQzdFLGlCQUFpQixDQUFDOEUsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJdEcsTUFBTSxDQUFDb00sc0JBQXNCLENBQUUsd0JBQXVCOUYsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUNwRixRQUFRLENBQUNvTCxNQUFNLENBQUMsRUFBRTtNQUNyQixNQUFNLElBQUlwRyxTQUFTLENBQUMsbUNBQW1DLENBQUM7SUFDMUQ7SUFDQSxJQUFJLENBQUNoRixRQUFRLENBQUNtSSxNQUFNLENBQUMsRUFBRTtNQUNyQixNQUFNLElBQUluRCxTQUFTLENBQUMsbUNBQW1DLENBQUM7SUFDMUQ7SUFFQSxJQUFJcUcsS0FBSyxHQUFHLEVBQUU7SUFDZCxJQUFJRCxNQUFNLElBQUlqRCxNQUFNLEVBQUU7TUFDcEIsSUFBSWlELE1BQU0sRUFBRTtRQUNWQyxLQUFLLEdBQUksU0FBUSxDQUFDRCxNQUFPLEdBQUU7TUFDN0IsQ0FBQyxNQUFNO1FBQ0xDLEtBQUssR0FBRyxVQUFVO1FBQ2xCRCxNQUFNLEdBQUcsQ0FBQztNQUNaO01BQ0EsSUFBSWpELE1BQU0sRUFBRTtRQUNWa0QsS0FBSyxJQUFLLEdBQUUsQ0FBQ2xELE1BQU0sR0FBR2lELE1BQU0sR0FBRyxDQUFFLEVBQUM7TUFDcEM7SUFDRjtJQUVBLE1BQU0zRixPQUF1QixHQUFHLENBQUMsQ0FBQztJQUNsQyxJQUFJNEYsS0FBSyxLQUFLLEVBQUUsRUFBRTtNQUNoQjVGLE9BQU8sQ0FBQzRGLEtBQUssR0FBR0EsS0FBSztJQUN2QjtJQUVBLE1BQU1DLG1CQUFtQixHQUFHLENBQUMsR0FBRyxDQUFDO0lBQ2pDLElBQUlELEtBQUssRUFBRTtNQUNUQyxtQkFBbUIsQ0FBQ0MsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUMvQjtJQUNBLE1BQU0vRixNQUFNLEdBQUcsS0FBSztJQUVwQixNQUFNRSxLQUFLLEdBQUcvRyxFQUFFLENBQUNpSixTQUFTLENBQUNxRCxPQUFPLENBQUM7SUFDbkMsT0FBTyxNQUFNLElBQUksQ0FBQ2pELGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRUMsVUFBVTtNQUFFSyxPQUFPO01BQUVDO0lBQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRTRGLG1CQUFtQixDQUFDO0VBQ2pIOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtFQUNFLE1BQU1FLFVBQVVBLENBQUNyRyxVQUFrQixFQUFFQyxVQUFrQixFQUFFcUcsUUFBZ0IsRUFBRVIsT0FBNkIsR0FBRyxDQUFDLENBQUMsRUFBRTtJQUM3RztJQUNBLElBQUksQ0FBQzdLLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDakYsUUFBUSxDQUFDc0wsUUFBUSxDQUFDLEVBQUU7TUFDdkIsTUFBTSxJQUFJekcsU0FBUyxDQUFDLHFDQUFxQyxDQUFDO0lBQzVEO0lBRUEsTUFBTTBHLGlCQUFpQixHQUFHLE1BQUFBLENBQUEsS0FBNkI7TUFDckQsSUFBSUMsY0FBK0I7TUFDbkMsTUFBTUMsT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDQyxVQUFVLENBQUMxRyxVQUFVLEVBQUVDLFVBQVUsRUFBRTZGLE9BQU8sQ0FBQztNQUN0RSxNQUFNYSxRQUFRLEdBQUksR0FBRUwsUUFBUyxJQUFHRyxPQUFPLENBQUNHLElBQUssYUFBWTtNQUV6RCxNQUFNM00sR0FBRyxDQUFDNE0sS0FBSyxDQUFDM04sSUFBSSxDQUFDNE4sT0FBTyxDQUFDUixRQUFRLENBQUMsRUFBRTtRQUFFUyxTQUFTLEVBQUU7TUFBSyxDQUFDLENBQUM7TUFFNUQsSUFBSWQsTUFBTSxHQUFHLENBQUM7TUFDZCxJQUFJO1FBQ0YsTUFBTWUsS0FBSyxHQUFHLE1BQU0vTSxHQUFHLENBQUNnTixJQUFJLENBQUNOLFFBQVEsQ0FBQztRQUN0QyxJQUFJRixPQUFPLENBQUNTLElBQUksS0FBS0YsS0FBSyxDQUFDRSxJQUFJLEVBQUU7VUFDL0IsT0FBT1AsUUFBUTtRQUNqQjtRQUNBVixNQUFNLEdBQUdlLEtBQUssQ0FBQ0UsSUFBSTtRQUNuQlYsY0FBYyxHQUFHek4sRUFBRSxDQUFDb08saUJBQWlCLENBQUNSLFFBQVEsRUFBRTtVQUFFUyxLQUFLLEVBQUU7UUFBSSxDQUFDLENBQUM7TUFDakUsQ0FBQyxDQUFDLE9BQU8xRixDQUFDLEVBQUU7UUFDVixJQUFJQSxDQUFDLFlBQVloRSxLQUFLLElBQUtnRSxDQUFDLENBQWlDK0QsSUFBSSxLQUFLLFFBQVEsRUFBRTtVQUM5RTtVQUNBZSxjQUFjLEdBQUd6TixFQUFFLENBQUNvTyxpQkFBaUIsQ0FBQ1IsUUFBUSxFQUFFO1lBQUVTLEtBQUssRUFBRTtVQUFJLENBQUMsQ0FBQztRQUNqRSxDQUFDLE1BQU07VUFDTDtVQUNBLE1BQU0xRixDQUFDO1FBQ1Q7TUFDRjtNQUVBLE1BQU0yRixjQUFjLEdBQUcsTUFBTSxJQUFJLENBQUNyQixnQkFBZ0IsQ0FBQ2hHLFVBQVUsRUFBRUMsVUFBVSxFQUFFZ0csTUFBTSxFQUFFLENBQUMsRUFBRUgsT0FBTyxDQUFDO01BRTlGLE1BQU01TCxhQUFhLENBQUNvTixRQUFRLENBQUNELGNBQWMsRUFBRWIsY0FBYyxDQUFDO01BQzVELE1BQU1RLEtBQUssR0FBRyxNQUFNL00sR0FBRyxDQUFDZ04sSUFBSSxDQUFDTixRQUFRLENBQUM7TUFDdEMsSUFBSUssS0FBSyxDQUFDRSxJQUFJLEtBQUtULE9BQU8sQ0FBQ1MsSUFBSSxFQUFFO1FBQy9CLE9BQU9QLFFBQVE7TUFDakI7TUFFQSxNQUFNLElBQUlqSixLQUFLLENBQUMsc0RBQXNELENBQUM7SUFDekUsQ0FBQztJQUVELE1BQU1pSixRQUFRLEdBQUcsTUFBTUosaUJBQWlCLENBQUMsQ0FBQztJQUMxQyxNQUFNdE0sR0FBRyxDQUFDc04sTUFBTSxDQUFDWixRQUFRLEVBQUVMLFFBQVEsQ0FBQztFQUN0Qzs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNSSxVQUFVQSxDQUFDMUcsVUFBa0IsRUFBRUMsVUFBa0IsRUFBRXVILFFBQXdCLEdBQUcsQ0FBQyxDQUFDLEVBQTJCO0lBQy9HLElBQUksQ0FBQ3ZNLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBRUEsSUFBSSxDQUFDbkYsUUFBUSxDQUFDME0sUUFBUSxDQUFDLEVBQUU7TUFDdkIsTUFBTSxJQUFJN04sTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMscUNBQXFDLENBQUM7SUFDOUU7SUFFQSxNQUFNd0MsS0FBSyxHQUFHL0csRUFBRSxDQUFDaUosU0FBUyxDQUFDK0UsUUFBUSxDQUFDO0lBQ3BDLE1BQU1uSCxNQUFNLEdBQUcsTUFBTTtJQUNyQixNQUFNZ0QsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDRixvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVDLFVBQVU7TUFBRU07SUFBTSxDQUFDLENBQUM7SUFFdEYsT0FBTztNQUNMMkcsSUFBSSxFQUFFTyxRQUFRLENBQUNwRSxHQUFHLENBQUMvQyxPQUFPLENBQUMsZ0JBQWdCLENBQVcsQ0FBQztNQUN2RG9ILFFBQVEsRUFBRXROLGVBQWUsQ0FBQ2lKLEdBQUcsQ0FBQy9DLE9BQXlCLENBQUM7TUFDeERxSCxZQUFZLEVBQUUsSUFBSWhFLElBQUksQ0FBQ04sR0FBRyxDQUFDL0MsT0FBTyxDQUFDLGVBQWUsQ0FBVyxDQUFDO01BQzlEc0gsU0FBUyxFQUFFdE4sWUFBWSxDQUFDK0ksR0FBRyxDQUFDL0MsT0FBeUIsQ0FBQztNQUN0RHNHLElBQUksRUFBRWxMLFlBQVksQ0FBQzJILEdBQUcsQ0FBQy9DLE9BQU8sQ0FBQ3NHLElBQUk7SUFDckMsQ0FBQztFQUNIOztFQUVBO0FBQ0Y7QUFDQTtBQUNBOztFQUVFO0FBQ0Y7QUFDQSxLQUZFLENBR0E7RUFJQSxNQUFNaUIsWUFBWUEsQ0FBQzdILFVBQWtCLEVBQUVDLFVBQWtCLEVBQUU2SCxVQUF5QixHQUFHLENBQUMsQ0FBQyxFQUFpQjtJQUN4RyxJQUFJLENBQUM3TSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFFLHdCQUF1QjlELFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDN0UsaUJBQWlCLENBQUM4RSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUl0RyxNQUFNLENBQUNvTSxzQkFBc0IsQ0FBRSx3QkFBdUI5RixVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUVBLElBQUksQ0FBQ25GLFFBQVEsQ0FBQ2dOLFVBQVUsQ0FBQyxFQUFFO01BQ3pCLE1BQU0sSUFBSW5PLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFDLHVDQUF1QyxDQUFDO0lBQ2hGO0lBRUEsTUFBTXNDLE1BQU0sR0FBRyxRQUFRO0lBRXZCLE1BQU1DLE9BQXVCLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDLElBQUl3SCxVQUFVLENBQUNDLGdCQUFnQixFQUFFO01BQy9CekgsT0FBTyxDQUFDLG1DQUFtQyxDQUFDLEdBQUcsSUFBSTtJQUNyRDtJQUNBLElBQUl3SCxVQUFVLENBQUNFLFdBQVcsRUFBRTtNQUMxQjFILE9BQU8sQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLElBQUk7SUFDeEM7SUFFQSxNQUFNMkgsV0FBbUMsR0FBRyxDQUFDLENBQUM7SUFDOUMsSUFBSUgsVUFBVSxDQUFDRixTQUFTLEVBQUU7TUFDeEJLLFdBQVcsQ0FBQ0wsU0FBUyxHQUFJLEdBQUVFLFVBQVUsQ0FBQ0YsU0FBVSxFQUFDO0lBQ25EO0lBQ0EsTUFBTXJILEtBQUssR0FBRy9HLEVBQUUsQ0FBQ2lKLFNBQVMsQ0FBQ3dGLFdBQVcsQ0FBQztJQUV2QyxNQUFNLElBQUksQ0FBQzlFLG9CQUFvQixDQUFDO01BQUU5QyxNQUFNO01BQUVMLFVBQVU7TUFBRUMsVUFBVTtNQUFFSyxPQUFPO01BQUVDO0lBQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztFQUNyRzs7RUFFQTs7RUFFQTJILHFCQUFxQkEsQ0FDbkJDLE1BQWMsRUFDZEMsTUFBYyxFQUNkckIsU0FBa0IsRUFDMEI7SUFDNUMsSUFBSXFCLE1BQU0sS0FBSzNLLFNBQVMsRUFBRTtNQUN4QjJLLE1BQU0sR0FBRyxFQUFFO0lBQ2I7SUFDQSxJQUFJckIsU0FBUyxLQUFLdEosU0FBUyxFQUFFO01BQzNCc0osU0FBUyxHQUFHLEtBQUs7SUFDbkI7SUFDQSxJQUFJLENBQUM5TCxpQkFBaUIsQ0FBQ2tOLE1BQU0sQ0FBQyxFQUFFO01BQzlCLE1BQU0sSUFBSXhPLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHcUUsTUFBTSxDQUFDO0lBQzNFO0lBQ0EsSUFBSSxDQUFDOU0sYUFBYSxDQUFDK00sTUFBTSxDQUFDLEVBQUU7TUFDMUIsTUFBTSxJQUFJek8sTUFBTSxDQUFDME8sa0JBQWtCLENBQUUsb0JBQW1CRCxNQUFPLEVBQUMsQ0FBQztJQUNuRTtJQUNBLElBQUksQ0FBQzFOLFNBQVMsQ0FBQ3FNLFNBQVMsQ0FBQyxFQUFFO01BQ3pCLE1BQU0sSUFBSWxILFNBQVMsQ0FBQyx1Q0FBdUMsQ0FBQztJQUM5RDtJQUNBLE1BQU15SSxTQUFTLEdBQUd2QixTQUFTLEdBQUcsRUFBRSxHQUFHLEdBQUc7SUFDdEMsSUFBSXdCLFNBQVMsR0FBRyxFQUFFO0lBQ2xCLElBQUlDLGNBQWMsR0FBRyxFQUFFO0lBQ3ZCLE1BQU1DLE9BQWtCLEdBQUcsRUFBRTtJQUM3QixJQUFJQyxLQUFLLEdBQUcsS0FBSzs7SUFFakI7SUFDQSxNQUFNQyxVQUFVLEdBQUcsSUFBSXhQLE1BQU0sQ0FBQ3lQLFFBQVEsQ0FBQztNQUFFQyxVQUFVLEVBQUU7SUFBSyxDQUFDLENBQUM7SUFDNURGLFVBQVUsQ0FBQ0csS0FBSyxHQUFHLE1BQU07TUFDdkI7TUFDQSxJQUFJTCxPQUFPLENBQUN6RixNQUFNLEVBQUU7UUFDbEIsT0FBTzJGLFVBQVUsQ0FBQ3ZDLElBQUksQ0FBQ3FDLE9BQU8sQ0FBQ00sS0FBSyxDQUFDLENBQUMsQ0FBQztNQUN6QztNQUNBLElBQUlMLEtBQUssRUFBRTtRQUNULE9BQU9DLFVBQVUsQ0FBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUM7TUFDOUI7TUFDQSxJQUFJLENBQUM0QywwQkFBMEIsQ0FBQ2IsTUFBTSxFQUFFQyxNQUFNLEVBQUVHLFNBQVMsRUFBRUMsY0FBYyxFQUFFRixTQUFTLENBQUMsQ0FBQzlELElBQUksQ0FDdkZDLE1BQU0sSUFBSztRQUNWO1FBQ0E7UUFDQUEsTUFBTSxDQUFDd0UsUUFBUSxDQUFDaEgsT0FBTyxDQUFFbUcsTUFBTSxJQUFLSyxPQUFPLENBQUNyQyxJQUFJLENBQUNnQyxNQUFNLENBQUMsQ0FBQztRQUN6RGhQLEtBQUssQ0FBQzhQLFVBQVUsQ0FDZHpFLE1BQU0sQ0FBQ2dFLE9BQU8sRUFDZCxDQUFDVSxNQUFNLEVBQUU3RSxFQUFFLEtBQUs7VUFDZDtVQUNBO1VBQ0E7VUFDQSxJQUFJLENBQUM4RSxTQUFTLENBQUNqQixNQUFNLEVBQUVnQixNQUFNLENBQUNFLEdBQUcsRUFBRUYsTUFBTSxDQUFDRyxRQUFRLENBQUMsQ0FBQzlFLElBQUksQ0FDckQrRSxLQUFhLElBQUs7WUFDakI7WUFDQTtZQUNBSixNQUFNLENBQUNqQyxJQUFJLEdBQUdxQyxLQUFLLENBQUNDLE1BQU0sQ0FBQyxDQUFDQyxHQUFHLEVBQUVDLElBQUksS0FBS0QsR0FBRyxHQUFHQyxJQUFJLENBQUN4QyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1lBQzdEdUIsT0FBTyxDQUFDckMsSUFBSSxDQUFDK0MsTUFBTSxDQUFDO1lBQ3BCN0UsRUFBRSxDQUFDLENBQUM7VUFDTixDQUFDLEVBQ0F4QyxHQUFVLElBQUt3QyxFQUFFLENBQUN4QyxHQUFHLENBQ3hCLENBQUM7UUFDSCxDQUFDLEVBQ0FBLEdBQUcsSUFBSztVQUNQLElBQUlBLEdBQUcsRUFBRTtZQUNQNkcsVUFBVSxDQUFDZ0IsSUFBSSxDQUFDLE9BQU8sRUFBRTdILEdBQUcsQ0FBQztZQUM3QjtVQUNGO1VBQ0EsSUFBSTJDLE1BQU0sQ0FBQ21GLFdBQVcsRUFBRTtZQUN0QnJCLFNBQVMsR0FBRzlELE1BQU0sQ0FBQ29GLGFBQWE7WUFDaENyQixjQUFjLEdBQUcvRCxNQUFNLENBQUNxRixrQkFBa0I7VUFDNUMsQ0FBQyxNQUFNO1lBQ0xwQixLQUFLLEdBQUcsSUFBSTtVQUNkOztVQUVBO1VBQ0E7VUFDQUMsVUFBVSxDQUFDRyxLQUFLLENBQUMsQ0FBQztRQUNwQixDQUNGLENBQUM7TUFDSCxDQUFDLEVBQ0FwSCxDQUFDLElBQUs7UUFDTGlILFVBQVUsQ0FBQ2dCLElBQUksQ0FBQyxPQUFPLEVBQUVqSSxDQUFDLENBQUM7TUFDN0IsQ0FDRixDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU9pSCxVQUFVO0VBQ25COztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1LLDBCQUEwQkEsQ0FDOUJoSixVQUFrQixFQUNsQm9JLE1BQWMsRUFDZEcsU0FBaUIsRUFDakJDLGNBQXNCLEVBQ3RCRixTQUFpQixFQUNhO0lBQzlCLElBQUksQ0FBQ3JOLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUNoRixRQUFRLENBQUNvTixNQUFNLENBQUMsRUFBRTtNQUNyQixNQUFNLElBQUl2SSxTQUFTLENBQUMsbUNBQW1DLENBQUM7SUFDMUQ7SUFDQSxJQUFJLENBQUM3RSxRQUFRLENBQUN1TixTQUFTLENBQUMsRUFBRTtNQUN4QixNQUFNLElBQUkxSSxTQUFTLENBQUMsc0NBQXNDLENBQUM7SUFDN0Q7SUFDQSxJQUFJLENBQUM3RSxRQUFRLENBQUN3TixjQUFjLENBQUMsRUFBRTtNQUM3QixNQUFNLElBQUkzSSxTQUFTLENBQUMsMkNBQTJDLENBQUM7SUFDbEU7SUFDQSxJQUFJLENBQUM3RSxRQUFRLENBQUNzTixTQUFTLENBQUMsRUFBRTtNQUN4QixNQUFNLElBQUl6SSxTQUFTLENBQUMsc0NBQXNDLENBQUM7SUFDN0Q7SUFDQSxNQUFNa0ssT0FBTyxHQUFHLEVBQUU7SUFDbEJBLE9BQU8sQ0FBQzNELElBQUksQ0FBRSxVQUFTdkssU0FBUyxDQUFDdU0sTUFBTSxDQUFFLEVBQUMsQ0FBQztJQUMzQzJCLE9BQU8sQ0FBQzNELElBQUksQ0FBRSxhQUFZdkssU0FBUyxDQUFDeU0sU0FBUyxDQUFFLEVBQUMsQ0FBQztJQUVqRCxJQUFJQyxTQUFTLEVBQUU7TUFDYndCLE9BQU8sQ0FBQzNELElBQUksQ0FBRSxjQUFhdkssU0FBUyxDQUFDME0sU0FBUyxDQUFFLEVBQUMsQ0FBQztJQUNwRDtJQUNBLElBQUlDLGNBQWMsRUFBRTtNQUNsQnVCLE9BQU8sQ0FBQzNELElBQUksQ0FBRSxvQkFBbUJvQyxjQUFlLEVBQUMsQ0FBQztJQUNwRDtJQUVBLE1BQU13QixVQUFVLEdBQUcsSUFBSTtJQUN2QkQsT0FBTyxDQUFDM0QsSUFBSSxDQUFFLGVBQWM0RCxVQUFXLEVBQUMsQ0FBQztJQUN6Q0QsT0FBTyxDQUFDRSxJQUFJLENBQUMsQ0FBQztJQUNkRixPQUFPLENBQUNHLE9BQU8sQ0FBQyxTQUFTLENBQUM7SUFDMUIsSUFBSTNKLEtBQUssR0FBRyxFQUFFO0lBQ2QsSUFBSXdKLE9BQU8sQ0FBQy9HLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDdEJ6QyxLQUFLLEdBQUksR0FBRXdKLE9BQU8sQ0FBQ0ksSUFBSSxDQUFDLEdBQUcsQ0FBRSxFQUFDO0lBQ2hDO0lBQ0EsTUFBTTlKLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLE1BQU1nRCxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNSLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRU87SUFBTSxDQUFDLENBQUM7SUFDdEUsTUFBTStDLElBQUksR0FBRyxNQUFNbkgsWUFBWSxDQUFDa0gsR0FBRyxDQUFDO0lBQ3BDLE9BQU81RyxVQUFVLENBQUMyTixrQkFBa0IsQ0FBQzlHLElBQUksQ0FBQztFQUM1Qzs7RUFFQTtBQUNGO0FBQ0E7QUFDQTtFQUNFLE1BQU0rRywwQkFBMEJBLENBQUNySyxVQUFrQixFQUFFQyxVQUFrQixFQUFFSyxPQUF1QixFQUFtQjtJQUNqSCxJQUFJLENBQUNyRixpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDN0UsaUJBQWlCLENBQUM4RSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUl0RyxNQUFNLENBQUNvTSxzQkFBc0IsQ0FBRSx3QkFBdUI5RixVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQ25GLFFBQVEsQ0FBQ3dGLE9BQU8sQ0FBQyxFQUFFO01BQ3RCLE1BQU0sSUFBSTNHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFDLHdDQUF3QyxDQUFDO0lBQ25GO0lBQ0EsTUFBTTFGLE1BQU0sR0FBRyxNQUFNO0lBQ3JCLE1BQU1FLEtBQUssR0FBRyxTQUFTO0lBQ3ZCLE1BQU04QyxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNSLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRUMsVUFBVTtNQUFFTSxLQUFLO01BQUVEO0lBQVEsQ0FBQyxDQUFDO0lBQzNGLE1BQU1nRCxJQUFJLEdBQUcsTUFBTXBILFlBQVksQ0FBQ21ILEdBQUcsQ0FBQztJQUNwQyxPQUFPL0csc0JBQXNCLENBQUNnSCxJQUFJLENBQUNwQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0VBQ2hEOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0VBQ0UsTUFBTW9KLG9CQUFvQkEsQ0FBQ3RLLFVBQWtCLEVBQUVDLFVBQWtCLEVBQUVxSixRQUFnQixFQUFpQjtJQUNsRyxNQUFNakosTUFBTSxHQUFHLFFBQVE7SUFDdkIsTUFBTUUsS0FBSyxHQUFJLFlBQVcrSSxRQUFTLEVBQUM7SUFFcEMsTUFBTWlCLGNBQWMsR0FBRztNQUFFbEssTUFBTTtNQUFFTCxVQUFVO01BQUVDLFVBQVUsRUFBRUEsVUFBVTtNQUFFTTtJQUFNLENBQUM7SUFDNUUsTUFBTSxJQUFJLENBQUM0QyxvQkFBb0IsQ0FBQ29ILGNBQWMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUM1RDtFQUVBLE1BQU1DLFlBQVlBLENBQUN4SyxVQUFrQixFQUFFQyxVQUFrQixFQUErQjtJQUFBLElBQUF3SyxhQUFBO0lBQ3RGLElBQUksQ0FBQ3hQLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBRUEsSUFBSXlLLFlBQWdFO0lBQ3BFLElBQUluQyxTQUFTLEdBQUcsRUFBRTtJQUNsQixJQUFJQyxjQUFjLEdBQUcsRUFBRTtJQUN2QixTQUFTO01BQ1AsTUFBTS9ELE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQ3VFLDBCQUEwQixDQUFDaEosVUFBVSxFQUFFQyxVQUFVLEVBQUVzSSxTQUFTLEVBQUVDLGNBQWMsRUFBRSxFQUFFLENBQUM7TUFDM0csS0FBSyxNQUFNVyxNQUFNLElBQUkxRSxNQUFNLENBQUNnRSxPQUFPLEVBQUU7UUFDbkMsSUFBSVUsTUFBTSxDQUFDRSxHQUFHLEtBQUtwSixVQUFVLEVBQUU7VUFDN0IsSUFBSSxDQUFDeUssWUFBWSxJQUFJdkIsTUFBTSxDQUFDd0IsU0FBUyxDQUFDQyxPQUFPLENBQUMsQ0FBQyxHQUFHRixZQUFZLENBQUNDLFNBQVMsQ0FBQ0MsT0FBTyxDQUFDLENBQUMsRUFBRTtZQUNsRkYsWUFBWSxHQUFHdkIsTUFBTTtVQUN2QjtRQUNGO01BQ0Y7TUFDQSxJQUFJMUUsTUFBTSxDQUFDbUYsV0FBVyxFQUFFO1FBQ3RCckIsU0FBUyxHQUFHOUQsTUFBTSxDQUFDb0YsYUFBYTtRQUNoQ3JCLGNBQWMsR0FBRy9ELE1BQU0sQ0FBQ3FGLGtCQUFrQjtRQUMxQztNQUNGO01BRUE7SUFDRjtJQUNBLFFBQUFXLGFBQUEsR0FBT0MsWUFBWSxjQUFBRCxhQUFBLHVCQUFaQSxhQUFBLENBQWNuQixRQUFRO0VBQy9COztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU11Qix1QkFBdUJBLENBQzNCN0ssVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCcUosUUFBZ0IsRUFDaEJ3QixLQUdHLEVBQ2tEO0lBQ3JELElBQUksQ0FBQzdQLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDakYsUUFBUSxDQUFDc08sUUFBUSxDQUFDLEVBQUU7TUFDdkIsTUFBTSxJQUFJekosU0FBUyxDQUFDLHFDQUFxQyxDQUFDO0lBQzVEO0lBQ0EsSUFBSSxDQUFDL0UsUUFBUSxDQUFDZ1EsS0FBSyxDQUFDLEVBQUU7TUFDcEIsTUFBTSxJQUFJakwsU0FBUyxDQUFDLGlDQUFpQyxDQUFDO0lBQ3hEO0lBRUEsSUFBSSxDQUFDeUosUUFBUSxFQUFFO01BQ2IsTUFBTSxJQUFJM1AsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsMEJBQTBCLENBQUM7SUFDbkU7SUFFQSxNQUFNc0MsTUFBTSxHQUFHLE1BQU07SUFDckIsTUFBTUUsS0FBSyxHQUFJLFlBQVcxRSxTQUFTLENBQUN5TixRQUFRLENBQUUsRUFBQztJQUUvQyxNQUFNeUIsT0FBTyxHQUFHLElBQUl0UixNQUFNLENBQUNrRCxPQUFPLENBQUMsQ0FBQztJQUNwQyxNQUFNbUcsT0FBTyxHQUFHaUksT0FBTyxDQUFDaEcsV0FBVyxDQUFDO01BQ2xDaUcsdUJBQXVCLEVBQUU7UUFDdkIvRixDQUFDLEVBQUU7VUFDREMsS0FBSyxFQUFFO1FBQ1QsQ0FBQztRQUNEK0YsSUFBSSxFQUFFSCxLQUFLLENBQUNJLEdBQUcsQ0FBRXRFLElBQUksSUFBSztVQUN4QixPQUFPO1lBQ0x1RSxVQUFVLEVBQUV2RSxJQUFJLENBQUN3RSxJQUFJO1lBQ3JCQyxJQUFJLEVBQUV6RSxJQUFJLENBQUNBO1VBQ2IsQ0FBQztRQUNILENBQUM7TUFDSDtJQUNGLENBQUMsQ0FBQztJQUVGLE1BQU12RCxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNSLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRUMsVUFBVTtNQUFFTTtJQUFNLENBQUMsRUFBRXVDLE9BQU8sQ0FBQztJQUMzRixNQUFNUSxJQUFJLEdBQUcsTUFBTXBILFlBQVksQ0FBQ21ILEdBQUcsQ0FBQztJQUNwQyxNQUFNb0IsTUFBTSxHQUFHcEksc0JBQXNCLENBQUNpSCxJQUFJLENBQUNwQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQ3RELElBQUksQ0FBQ3VELE1BQU0sRUFBRTtNQUNYLE1BQU0sSUFBSS9HLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQztJQUN6RDtJQUVBLElBQUkrRyxNQUFNLENBQUNlLE9BQU8sRUFBRTtNQUNsQjtNQUNBLE1BQU0sSUFBSTdMLE1BQU0sQ0FBQzRMLE9BQU8sQ0FBQ2QsTUFBTSxDQUFDNkcsVUFBVSxDQUFDO0lBQzdDO0lBRUEsT0FBTztNQUNMO01BQ0E7TUFDQTFFLElBQUksRUFBRW5DLE1BQU0sQ0FBQ21DLElBQWM7TUFDM0JnQixTQUFTLEVBQUV0TixZQUFZLENBQUMrSSxHQUFHLENBQUMvQyxPQUF5QjtJQUN2RCxDQUFDO0VBQ0g7O0VBRUE7QUFDRjtBQUNBO0VBQ0UsTUFBZ0I4SSxTQUFTQSxDQUFDcEosVUFBa0IsRUFBRUMsVUFBa0IsRUFBRXFKLFFBQWdCLEVBQTJCO0lBQzNHLElBQUksQ0FBQ3JPLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDakYsUUFBUSxDQUFDc08sUUFBUSxDQUFDLEVBQUU7TUFDdkIsTUFBTSxJQUFJekosU0FBUyxDQUFDLHFDQUFxQyxDQUFDO0lBQzVEO0lBQ0EsSUFBSSxDQUFDeUosUUFBUSxFQUFFO01BQ2IsTUFBTSxJQUFJM1AsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsMEJBQTBCLENBQUM7SUFDbkU7SUFFQSxNQUFNd0wsS0FBcUIsR0FBRyxFQUFFO0lBQ2hDLElBQUlnQyxNQUFNLEdBQUcsQ0FBQztJQUNkLElBQUk5RyxNQUFNO0lBQ1YsR0FBRztNQUNEQSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMrRyxjQUFjLENBQUN4TCxVQUFVLEVBQUVDLFVBQVUsRUFBRXFKLFFBQVEsRUFBRWlDLE1BQU0sQ0FBQztNQUM1RUEsTUFBTSxHQUFHOUcsTUFBTSxDQUFDOEcsTUFBTTtNQUN0QmhDLEtBQUssQ0FBQ25ELElBQUksQ0FBQyxHQUFHM0IsTUFBTSxDQUFDOEUsS0FBSyxDQUFDO0lBQzdCLENBQUMsUUFBUTlFLE1BQU0sQ0FBQ21GLFdBQVc7SUFFM0IsT0FBT0wsS0FBSztFQUNkOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQWNpQyxjQUFjQSxDQUFDeEwsVUFBa0IsRUFBRUMsVUFBa0IsRUFBRXFKLFFBQWdCLEVBQUVpQyxNQUFjLEVBQUU7SUFDckcsSUFBSSxDQUFDdFEsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQzdFLGlCQUFpQixDQUFDOEUsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJdEcsTUFBTSxDQUFDb00sc0JBQXNCLENBQUUsd0JBQXVCOUYsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUNqRixRQUFRLENBQUNzTyxRQUFRLENBQUMsRUFBRTtNQUN2QixNQUFNLElBQUl6SixTQUFTLENBQUMscUNBQXFDLENBQUM7SUFDNUQ7SUFDQSxJQUFJLENBQUNoRixRQUFRLENBQUMwUSxNQUFNLENBQUMsRUFBRTtNQUNyQixNQUFNLElBQUkxTCxTQUFTLENBQUMsbUNBQW1DLENBQUM7SUFDMUQ7SUFDQSxJQUFJLENBQUN5SixRQUFRLEVBQUU7TUFDYixNQUFNLElBQUkzUCxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQywwQkFBMEIsQ0FBQztJQUNuRTtJQUVBLElBQUl3QyxLQUFLLEdBQUksWUFBVzFFLFNBQVMsQ0FBQ3lOLFFBQVEsQ0FBRSxFQUFDO0lBQzdDLElBQUlpQyxNQUFNLEVBQUU7TUFDVmhMLEtBQUssSUFBSyx1QkFBc0JnTCxNQUFPLEVBQUM7SUFDMUM7SUFFQSxNQUFNbEwsTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTWdELEdBQUcsR0FBRyxNQUFNLElBQUksQ0FBQ1IsZ0JBQWdCLENBQUM7TUFBRXhDLE1BQU07TUFBRUwsVUFBVTtNQUFFQyxVQUFVO01BQUVNO0lBQU0sQ0FBQyxDQUFDO0lBQ2xGLE9BQU85RCxVQUFVLENBQUNnUCxjQUFjLENBQUMsTUFBTXRQLFlBQVksQ0FBQ2tILEdBQUcsQ0FBQyxDQUFDO0VBQzNEO0VBRUEsTUFBTXFJLFdBQVdBLENBQUEsRUFBa0M7SUFDakQsTUFBTXJMLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLE1BQU1zTCxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUM5SSxnQkFBZ0IsQ0FBQztNQUFFeEM7SUFBTyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDckMsTUFBTSxJQUFJLEVBQUUsQ0FBQztJQUNyRixNQUFNNE4sU0FBUyxHQUFHLE1BQU16UCxZQUFZLENBQUN3UCxPQUFPLENBQUM7SUFDN0MsT0FBT2xQLFVBQVUsQ0FBQ29QLGVBQWUsQ0FBQ0QsU0FBUyxDQUFDO0VBQzlDOztFQUVBO0FBQ0Y7QUFDQTtFQUNFRSxpQkFBaUJBLENBQUM1RSxJQUFZLEVBQUU7SUFDOUIsSUFBSSxDQUFDck0sUUFBUSxDQUFDcU0sSUFBSSxDQUFDLEVBQUU7TUFDbkIsTUFBTSxJQUFJckgsU0FBUyxDQUFDLGlDQUFpQyxDQUFDO0lBQ3hEO0lBQ0EsSUFBSXFILElBQUksR0FBRyxJQUFJLENBQUM3SixhQUFhLEVBQUU7TUFDN0IsTUFBTSxJQUFJd0MsU0FBUyxDQUFFLGdDQUErQixJQUFJLENBQUN4QyxhQUFjLEVBQUMsQ0FBQztJQUMzRTtJQUNBLElBQUksSUFBSSxDQUFDK0IsZ0JBQWdCLEVBQUU7TUFDekIsT0FBTyxJQUFJLENBQUNqQyxRQUFRO0lBQ3RCO0lBQ0EsSUFBSUEsUUFBUSxHQUFHLElBQUksQ0FBQ0EsUUFBUTtJQUM1QixTQUFTO01BQ1A7TUFDQTtNQUNBLElBQUlBLFFBQVEsR0FBRyxLQUFLLEdBQUcrSixJQUFJLEVBQUU7UUFDM0IsT0FBTy9KLFFBQVE7TUFDakI7TUFDQTtNQUNBQSxRQUFRLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0lBQzlCO0VBQ0Y7O0VBRUE7QUFDRjtBQUNBO0VBQ0UsTUFBTTRPLFVBQVVBLENBQUMvTCxVQUFrQixFQUFFQyxVQUFrQixFQUFFcUcsUUFBZ0IsRUFBRW9CLFFBQXdCLEdBQUcsQ0FBQyxDQUFDLEVBQUU7SUFDeEcsSUFBSSxDQUFDek0saUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQzdFLGlCQUFpQixDQUFDOEUsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJdEcsTUFBTSxDQUFDb00sc0JBQXNCLENBQUUsd0JBQXVCOUYsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFFQSxJQUFJLENBQUNqRixRQUFRLENBQUNzTCxRQUFRLENBQUMsRUFBRTtNQUN2QixNQUFNLElBQUl6RyxTQUFTLENBQUMscUNBQXFDLENBQUM7SUFDNUQ7SUFDQSxJQUFJLENBQUMvRSxRQUFRLENBQUM0TSxRQUFRLENBQUMsRUFBRTtNQUN2QixNQUFNLElBQUk3SCxTQUFTLENBQUMscUNBQXFDLENBQUM7SUFDNUQ7O0lBRUE7SUFDQTZILFFBQVEsR0FBR2xOLGlCQUFpQixDQUFDa04sUUFBUSxFQUFFcEIsUUFBUSxDQUFDO0lBQ2hELE1BQU1XLElBQUksR0FBRyxNQUFNaE4sR0FBRyxDQUFDK1IsS0FBSyxDQUFDMUYsUUFBUSxDQUFDO0lBQ3RDLE1BQU0sSUFBSSxDQUFDMkYsU0FBUyxDQUFDak0sVUFBVSxFQUFFQyxVQUFVLEVBQUVsSCxFQUFFLENBQUNtVCxnQkFBZ0IsQ0FBQzVGLFFBQVEsQ0FBQyxFQUFFVyxJQUFJLENBQUNDLElBQUksRUFBRVEsUUFBUSxDQUFDO0VBQ2xHOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0VBQ0UsTUFBTXVFLFNBQVNBLENBQ2JqTSxVQUFrQixFQUNsQkMsVUFBa0IsRUFDbEI5RyxNQUF5QyxFQUN6QytOLElBQWEsRUFDYlEsUUFBNkIsRUFDQTtJQUM3QixJQUFJLENBQUN6TSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFFLHdCQUF1QjlELFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDN0UsaUJBQWlCLENBQUM4RSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUl0RyxNQUFNLENBQUNvTSxzQkFBc0IsQ0FBRSx3QkFBdUI5RixVQUFXLEVBQUMsQ0FBQztJQUMvRTs7SUFFQTtJQUNBO0lBQ0EsSUFBSW5GLFFBQVEsQ0FBQ29NLElBQUksQ0FBQyxFQUFFO01BQ2xCUSxRQUFRLEdBQUdSLElBQUk7SUFDakI7SUFDQTtJQUNBLE1BQU01RyxPQUFPLEdBQUc5RSxlQUFlLENBQUNrTSxRQUFRLENBQUM7SUFDekMsSUFBSSxPQUFPdk8sTUFBTSxLQUFLLFFBQVEsSUFBSUEsTUFBTSxZQUFZb0ssTUFBTSxFQUFFO01BQzFEO01BQ0EyRCxJQUFJLEdBQUcvTixNQUFNLENBQUM2SixNQUFNO01BQ3BCN0osTUFBTSxHQUFHc0MsY0FBYyxDQUFDdEMsTUFBTSxDQUFDO0lBQ2pDLENBQUMsTUFBTSxJQUFJLENBQUM0QixnQkFBZ0IsQ0FBQzVCLE1BQU0sQ0FBQyxFQUFFO01BQ3BDLE1BQU0sSUFBSTBHLFNBQVMsQ0FBQyw0RUFBNEUsQ0FBQztJQUNuRztJQUVBLElBQUloRixRQUFRLENBQUNxTSxJQUFJLENBQUMsSUFBSUEsSUFBSSxHQUFHLENBQUMsRUFBRTtNQUM5QixNQUFNLElBQUl2TixNQUFNLENBQUNvRSxvQkFBb0IsQ0FBRSx3Q0FBdUNtSixJQUFLLEVBQUMsQ0FBQztJQUN2Rjs7SUFFQTtJQUNBO0lBQ0EsSUFBSSxDQUFDck0sUUFBUSxDQUFDcU0sSUFBSSxDQUFDLEVBQUU7TUFDbkJBLElBQUksR0FBRyxJQUFJLENBQUM3SixhQUFhO0lBQzNCOztJQUVBO0lBQ0E7SUFDQSxJQUFJNkosSUFBSSxLQUFLekosU0FBUyxFQUFFO01BQ3RCLE1BQU0wTyxRQUFRLEdBQUcsTUFBTTlSLGdCQUFnQixDQUFDbEIsTUFBTSxDQUFDO01BQy9DLElBQUlnVCxRQUFRLEtBQUssSUFBSSxFQUFFO1FBQ3JCakYsSUFBSSxHQUFHaUYsUUFBUTtNQUNqQjtJQUNGO0lBRUEsSUFBSSxDQUFDdFIsUUFBUSxDQUFDcU0sSUFBSSxDQUFDLEVBQUU7TUFDbkI7TUFDQUEsSUFBSSxHQUFHLElBQUksQ0FBQzdKLGFBQWE7SUFDM0I7SUFFQSxNQUFNRixRQUFRLEdBQUcsSUFBSSxDQUFDMk8saUJBQWlCLENBQUM1RSxJQUFJLENBQUM7SUFDN0MsSUFBSSxPQUFPL04sTUFBTSxLQUFLLFFBQVEsSUFBSW9LLE1BQU0sQ0FBQ0MsUUFBUSxDQUFDckssTUFBTSxDQUFDLElBQUkrTixJQUFJLElBQUkvSixRQUFRLEVBQUU7TUFDN0UsTUFBTWlQLEdBQUcsR0FBR3JSLGdCQUFnQixDQUFDNUIsTUFBTSxDQUFDLEdBQUcsTUFBTStDLFlBQVksQ0FBQy9DLE1BQU0sQ0FBQyxHQUFHb0ssTUFBTSxDQUFDOEksSUFBSSxDQUFDbFQsTUFBTSxDQUFDO01BQ3ZGLE9BQU8sSUFBSSxDQUFDbVQsWUFBWSxDQUFDdE0sVUFBVSxFQUFFQyxVQUFVLEVBQUVLLE9BQU8sRUFBRThMLEdBQUcsQ0FBQztJQUNoRTtJQUVBLE9BQU8sSUFBSSxDQUFDRyxZQUFZLENBQUN2TSxVQUFVLEVBQUVDLFVBQVUsRUFBRUssT0FBTyxFQUFFbkgsTUFBTSxFQUFFZ0UsUUFBUSxDQUFDO0VBQzdFOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0VBQ0UsTUFBY21QLFlBQVlBLENBQ3hCdE0sVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCSyxPQUF1QixFQUN2QjhMLEdBQVcsRUFDa0I7SUFDN0IsTUFBTTtNQUFFSSxNQUFNO01BQUV2SjtJQUFVLENBQUMsR0FBRzFJLFVBQVUsQ0FBQzZSLEdBQUcsRUFBRSxJQUFJLENBQUMvTSxZQUFZLENBQUM7SUFDaEVpQixPQUFPLENBQUMsZ0JBQWdCLENBQUMsR0FBRzhMLEdBQUcsQ0FBQ3BKLE1BQU07SUFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQzNELFlBQVksRUFBRTtNQUN0QmlCLE9BQU8sQ0FBQyxhQUFhLENBQUMsR0FBR2tNLE1BQU07SUFDakM7SUFDQSxNQUFNbkosR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDSCxzQkFBc0IsQ0FDM0M7TUFDRTdDLE1BQU0sRUFBRSxLQUFLO01BQ2JMLFVBQVU7TUFDVkMsVUFBVTtNQUNWSztJQUNGLENBQUMsRUFDRDhMLEdBQUcsRUFDSG5KLFNBQVMsRUFDVCxDQUFDLEdBQUcsQ0FBQyxFQUNMLEVBQ0YsQ0FBQztJQUNELE1BQU1oSCxhQUFhLENBQUNvSCxHQUFHLENBQUM7SUFDeEIsT0FBTztNQUNMdUQsSUFBSSxFQUFFbEwsWUFBWSxDQUFDMkgsR0FBRyxDQUFDL0MsT0FBTyxDQUFDc0csSUFBSSxDQUFDO01BQ3BDZ0IsU0FBUyxFQUFFdE4sWUFBWSxDQUFDK0ksR0FBRyxDQUFDL0MsT0FBeUI7SUFDdkQsQ0FBQztFQUNIOztFQUVBO0FBQ0Y7QUFDQTtBQUNBO0VBQ0UsTUFBY2lNLFlBQVlBLENBQ3hCdk0sVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCSyxPQUF1QixFQUN2QmdELElBQXFCLEVBQ3JCbkcsUUFBZ0IsRUFDYTtJQUM3QjtJQUNBO0lBQ0EsTUFBTXNQLFFBQThCLEdBQUcsQ0FBQyxDQUFDOztJQUV6QztJQUNBO0lBQ0EsTUFBTUMsS0FBYSxHQUFHLEVBQUU7SUFFeEIsTUFBTUMsZ0JBQWdCLEdBQUcsTUFBTSxJQUFJLENBQUNuQyxZQUFZLENBQUN4SyxVQUFVLEVBQUVDLFVBQVUsQ0FBQztJQUN4RSxJQUFJcUosUUFBZ0I7SUFDcEIsSUFBSSxDQUFDcUQsZ0JBQWdCLEVBQUU7TUFDckJyRCxRQUFRLEdBQUcsTUFBTSxJQUFJLENBQUNlLDBCQUEwQixDQUFDckssVUFBVSxFQUFFQyxVQUFVLEVBQUVLLE9BQU8sQ0FBQztJQUNuRixDQUFDLE1BQU07TUFDTGdKLFFBQVEsR0FBR3FELGdCQUFnQjtNQUMzQixNQUFNQyxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUN4RCxTQUFTLENBQUNwSixVQUFVLEVBQUVDLFVBQVUsRUFBRTBNLGdCQUFnQixDQUFDO01BQzlFQyxPQUFPLENBQUMzSyxPQUFPLENBQUVQLENBQUMsSUFBSztRQUNyQmtMLE9BQU8sQ0FBQ2xMLENBQUMsQ0FBQzBKLElBQUksQ0FBQyxHQUFHMUosQ0FBQztNQUNyQixDQUFDLENBQUM7SUFDSjtJQUVBLE1BQU1tTCxRQUFRLEdBQUcsSUFBSXhULFlBQVksQ0FBQztNQUFFNk4sSUFBSSxFQUFFL0osUUFBUTtNQUFFMlAsV0FBVyxFQUFFO0lBQU0sQ0FBQyxDQUFDOztJQUV6RTtJQUNBLE1BQU0sQ0FBQ3ZULENBQUMsRUFBRXdULENBQUMsQ0FBQyxHQUFHLE1BQU1DLE9BQU8sQ0FBQ0MsR0FBRyxDQUFDLENBQy9CLElBQUlELE9BQU8sQ0FBQyxDQUFDRSxPQUFPLEVBQUVDLE1BQU0sS0FBSztNQUMvQjdKLElBQUksQ0FBQzhKLElBQUksQ0FBQ1AsUUFBUSxDQUFDLENBQUNRLEVBQUUsQ0FBQyxPQUFPLEVBQUVGLE1BQU0sQ0FBQztNQUN2Q04sUUFBUSxDQUFDUSxFQUFFLENBQUMsS0FBSyxFQUFFSCxPQUFPLENBQUMsQ0FBQ0csRUFBRSxDQUFDLE9BQU8sRUFBRUYsTUFBTSxDQUFDO0lBQ2pELENBQUMsQ0FBQyxFQUNGLENBQUMsWUFBWTtNQUNYLElBQUlHLFVBQVUsR0FBRyxDQUFDO01BRWxCLFdBQVcsTUFBTUMsS0FBSyxJQUFJVixRQUFRLEVBQUU7UUFDbEMsTUFBTVcsR0FBRyxHQUFHMVUsTUFBTSxDQUFDMlUsVUFBVSxDQUFDLEtBQUssQ0FBQyxDQUFDQyxNQUFNLENBQUNILEtBQUssQ0FBQyxDQUFDSSxNQUFNLENBQUMsQ0FBQztRQUUzRCxNQUFNQyxPQUFPLEdBQUduQixRQUFRLENBQUNhLFVBQVUsQ0FBQztRQUNwQyxJQUFJTSxPQUFPLEVBQUU7VUFDWCxJQUFJQSxPQUFPLENBQUNoSCxJQUFJLEtBQUs0RyxHQUFHLENBQUN0TSxRQUFRLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDeEN3TCxLQUFLLENBQUN0RyxJQUFJLENBQUM7Y0FBRWdGLElBQUksRUFBRWtDLFVBQVU7Y0FBRTFHLElBQUksRUFBRWdILE9BQU8sQ0FBQ2hIO1lBQUssQ0FBQyxDQUFDO1lBQ3BEMEcsVUFBVSxFQUFFO1lBQ1o7VUFDRjtRQUNGO1FBRUFBLFVBQVUsRUFBRTs7UUFFWjtRQUNBLE1BQU0xTixPQUFzQixHQUFHO1VBQzdCUyxNQUFNLEVBQUUsS0FBSztVQUNiRSxLQUFLLEVBQUUvRyxFQUFFLENBQUNpSixTQUFTLENBQUM7WUFBRTZLLFVBQVU7WUFBRWhFO1VBQVMsQ0FBQyxDQUFDO1VBQzdDaEosT0FBTyxFQUFFO1lBQ1AsZ0JBQWdCLEVBQUVpTixLQUFLLENBQUN2SyxNQUFNO1lBQzlCLGFBQWEsRUFBRXdLLEdBQUcsQ0FBQ3RNLFFBQVEsQ0FBQyxRQUFRO1VBQ3RDLENBQUM7VUFDRGxCLFVBQVU7VUFDVkM7UUFDRixDQUFDO1FBRUQsTUFBTTRCLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQ3NCLG9CQUFvQixDQUFDdkQsT0FBTyxFQUFFMk4sS0FBSyxDQUFDO1FBRWhFLElBQUkzRyxJQUFJLEdBQUcvRSxRQUFRLENBQUN2QixPQUFPLENBQUNzRyxJQUFJO1FBQ2hDLElBQUlBLElBQUksRUFBRTtVQUNSQSxJQUFJLEdBQUdBLElBQUksQ0FBQ3hFLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUNBLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ2pELENBQUMsTUFBTTtVQUNMd0UsSUFBSSxHQUFHLEVBQUU7UUFDWDtRQUVBOEYsS0FBSyxDQUFDdEcsSUFBSSxDQUFDO1VBQUVnRixJQUFJLEVBQUVrQyxVQUFVO1VBQUUxRztRQUFLLENBQUMsQ0FBQztNQUN4QztNQUVBLE9BQU8sTUFBTSxJQUFJLENBQUNpRSx1QkFBdUIsQ0FBQzdLLFVBQVUsRUFBRUMsVUFBVSxFQUFFcUosUUFBUSxFQUFFb0QsS0FBSyxDQUFDO0lBQ3BGLENBQUMsRUFBRSxDQUFDLENBQ0wsQ0FBQztJQUVGLE9BQU9LLENBQUM7RUFDVjtFQUlBLE1BQU1jLHVCQUF1QkEsQ0FBQzdOLFVBQWtCLEVBQWlCO0lBQy9ELElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxNQUFNSyxNQUFNLEdBQUcsUUFBUTtJQUN2QixNQUFNRSxLQUFLLEdBQUcsYUFBYTtJQUMzQixNQUFNLElBQUksQ0FBQzRDLG9CQUFvQixDQUFDO01BQUU5QyxNQUFNO01BQUVMLFVBQVU7TUFBRU87SUFBTSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsQ0FBQztFQUNwRjtFQUlBLE1BQU11TixvQkFBb0JBLENBQUM5TixVQUFrQixFQUFFK04saUJBQXdDLEVBQUU7SUFDdkYsSUFBSSxDQUFDOVMsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQ2xGLFFBQVEsQ0FBQ2lULGlCQUFpQixDQUFDLEVBQUU7TUFDaEMsTUFBTSxJQUFJcFUsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsOENBQThDLENBQUM7SUFDdkYsQ0FBQyxNQUFNO01BQ0wsSUFBSXhFLENBQUMsQ0FBQ3FCLE9BQU8sQ0FBQ21ULGlCQUFpQixDQUFDQyxJQUFJLENBQUMsRUFBRTtRQUNyQyxNQUFNLElBQUlyVSxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQyxzQkFBc0IsQ0FBQztNQUMvRCxDQUFDLE1BQU0sSUFBSWdRLGlCQUFpQixDQUFDQyxJQUFJLElBQUksQ0FBQ2hULFFBQVEsQ0FBQytTLGlCQUFpQixDQUFDQyxJQUFJLENBQUMsRUFBRTtRQUN0RSxNQUFNLElBQUlyVSxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQyx3QkFBd0IsRUFBRWdRLGlCQUFpQixDQUFDQyxJQUFJLENBQUM7TUFDekY7TUFDQSxJQUFJelUsQ0FBQyxDQUFDcUIsT0FBTyxDQUFDbVQsaUJBQWlCLENBQUNFLEtBQUssQ0FBQyxFQUFFO1FBQ3RDLE1BQU0sSUFBSXRVLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFDLGdEQUFnRCxDQUFDO01BQ3pGO0lBQ0Y7SUFDQSxNQUFNc0MsTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTUUsS0FBSyxHQUFHLGFBQWE7SUFDM0IsTUFBTUQsT0FBK0IsR0FBRyxDQUFDLENBQUM7SUFFMUMsTUFBTTROLHVCQUF1QixHQUFHO01BQzlCQyx3QkFBd0IsRUFBRTtRQUN4QkMsSUFBSSxFQUFFTCxpQkFBaUIsQ0FBQ0MsSUFBSTtRQUM1QkssSUFBSSxFQUFFTixpQkFBaUIsQ0FBQ0U7TUFDMUI7SUFDRixDQUFDO0lBRUQsTUFBTWxELE9BQU8sR0FBRyxJQUFJdFIsTUFBTSxDQUFDa0QsT0FBTyxDQUFDO01BQUVDLFVBQVUsRUFBRTtRQUFFQyxNQUFNLEVBQUU7TUFBTSxDQUFDO01BQUVDLFFBQVEsRUFBRTtJQUFLLENBQUMsQ0FBQztJQUNyRixNQUFNZ0csT0FBTyxHQUFHaUksT0FBTyxDQUFDaEcsV0FBVyxDQUFDbUosdUJBQXVCLENBQUM7SUFDNUQ1TixPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUczRSxLQUFLLENBQUNtSCxPQUFPLENBQUM7SUFDdkMsTUFBTSxJQUFJLENBQUNLLG9CQUFvQixDQUFDO01BQUU5QyxNQUFNO01BQUVMLFVBQVU7TUFBRU8sS0FBSztNQUFFRDtJQUFRLENBQUMsRUFBRXdDLE9BQU8sQ0FBQztFQUNsRjtFQUlBLE1BQU13TCxvQkFBb0JBLENBQUN0TyxVQUFrQixFQUFFO0lBQzdDLElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxNQUFNSyxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNRSxLQUFLLEdBQUcsYUFBYTtJQUUzQixNQUFNb0wsT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDOUksZ0JBQWdCLENBQUM7TUFBRXhDLE1BQU07TUFBRUwsVUFBVTtNQUFFTztJQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDMUYsTUFBTXFMLFNBQVMsR0FBRyxNQUFNelAsWUFBWSxDQUFDd1AsT0FBTyxDQUFDO0lBQzdDLE9BQU9sUCxVQUFVLENBQUM4UixzQkFBc0IsQ0FBQzNDLFNBQVMsQ0FBQztFQUNyRDtFQVFBLE1BQU00QyxrQkFBa0JBLENBQ3RCeE8sVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCNkYsT0FBbUMsRUFDUDtJQUM1QixJQUFJLENBQUM3SyxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDN0UsaUJBQWlCLENBQUM4RSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUl0RyxNQUFNLENBQUNvTSxzQkFBc0IsQ0FBRSx3QkFBdUI5RixVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUVBLElBQUk2RixPQUFPLEVBQUU7TUFDWCxJQUFJLENBQUNoTCxRQUFRLENBQUNnTCxPQUFPLENBQUMsRUFBRTtRQUN0QixNQUFNLElBQUlqRyxTQUFTLENBQUMsb0NBQW9DLENBQUM7TUFDM0QsQ0FBQyxNQUFNLElBQUlnQixNQUFNLENBQUM0TixJQUFJLENBQUMzSSxPQUFPLENBQUMsQ0FBQzlDLE1BQU0sR0FBRyxDQUFDLElBQUk4QyxPQUFPLENBQUM4QixTQUFTLElBQUksQ0FBQzVNLFFBQVEsQ0FBQzhLLE9BQU8sQ0FBQzhCLFNBQVMsQ0FBQyxFQUFFO1FBQy9GLE1BQU0sSUFBSS9ILFNBQVMsQ0FBQyxzQ0FBc0MsRUFBRWlHLE9BQU8sQ0FBQzhCLFNBQVMsQ0FBQztNQUNoRjtJQUNGO0lBRUEsTUFBTXZILE1BQU0sR0FBRyxLQUFLO0lBQ3BCLElBQUlFLEtBQUssR0FBRyxZQUFZO0lBRXhCLElBQUl1RixPQUFPLGFBQVBBLE9BQU8sZUFBUEEsT0FBTyxDQUFFOEIsU0FBUyxFQUFFO01BQ3RCckgsS0FBSyxJQUFLLGNBQWF1RixPQUFPLENBQUM4QixTQUFVLEVBQUM7SUFDNUM7SUFFQSxNQUFNK0QsT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDOUksZ0JBQWdCLENBQUM7TUFBRXhDLE1BQU07TUFBRUwsVUFBVTtNQUFFQyxVQUFVO01BQUVNO0lBQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pHLE1BQU1tTyxNQUFNLEdBQUcsTUFBTXZTLFlBQVksQ0FBQ3dQLE9BQU8sQ0FBQztJQUMxQyxPQUFPcFAsMEJBQTBCLENBQUNtUyxNQUFNLENBQUM7RUFDM0M7RUFHQSxNQUFNQyxrQkFBa0JBLENBQ3RCM08sVUFBa0IsRUFDbEJDLFVBQWtCLEVBQ2xCMk8sT0FBTyxHQUFHO0lBQ1JDLE1BQU0sRUFBRWhWLGlCQUFpQixDQUFDaVY7RUFDNUIsQ0FBOEIsRUFDZjtJQUNmLElBQUksQ0FBQzdULGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBRUEsSUFBSSxDQUFDbkYsUUFBUSxDQUFDOFQsT0FBTyxDQUFDLEVBQUU7TUFDdEIsTUFBTSxJQUFJL08sU0FBUyxDQUFDLG9DQUFvQyxDQUFDO0lBQzNELENBQUMsTUFBTTtNQUNMLElBQUksQ0FBQyxDQUFDaEcsaUJBQWlCLENBQUNpVixPQUFPLEVBQUVqVixpQkFBaUIsQ0FBQ2tWLFFBQVEsQ0FBQyxDQUFDN08sUUFBUSxDQUFDME8sT0FBTyxhQUFQQSxPQUFPLHVCQUFQQSxPQUFPLENBQUVDLE1BQU0sQ0FBQyxFQUFFO1FBQ3RGLE1BQU0sSUFBSWhQLFNBQVMsQ0FBQyxrQkFBa0IsR0FBRytPLE9BQU8sQ0FBQ0MsTUFBTSxDQUFDO01BQzFEO01BQ0EsSUFBSUQsT0FBTyxDQUFDaEgsU0FBUyxJQUFJLENBQUNnSCxPQUFPLENBQUNoSCxTQUFTLENBQUM1RSxNQUFNLEVBQUU7UUFDbEQsTUFBTSxJQUFJbkQsU0FBUyxDQUFDLHNDQUFzQyxHQUFHK08sT0FBTyxDQUFDaEgsU0FBUyxDQUFDO01BQ2pGO0lBQ0Y7SUFFQSxNQUFNdkgsTUFBTSxHQUFHLEtBQUs7SUFDcEIsSUFBSUUsS0FBSyxHQUFHLFlBQVk7SUFFeEIsSUFBSXFPLE9BQU8sQ0FBQ2hILFNBQVMsRUFBRTtNQUNyQnJILEtBQUssSUFBSyxjQUFhcU8sT0FBTyxDQUFDaEgsU0FBVSxFQUFDO0lBQzVDO0lBRUEsTUFBTW9ILE1BQU0sR0FBRztNQUNiQyxNQUFNLEVBQUVMLE9BQU8sQ0FBQ0M7SUFDbEIsQ0FBQztJQUVELE1BQU05RCxPQUFPLEdBQUcsSUFBSXRSLE1BQU0sQ0FBQ2tELE9BQU8sQ0FBQztNQUFFdVMsUUFBUSxFQUFFLFdBQVc7TUFBRXRTLFVBQVUsRUFBRTtRQUFFQyxNQUFNLEVBQUU7TUFBTSxDQUFDO01BQUVDLFFBQVEsRUFBRTtJQUFLLENBQUMsQ0FBQztJQUM1RyxNQUFNZ0csT0FBTyxHQUFHaUksT0FBTyxDQUFDaEcsV0FBVyxDQUFDaUssTUFBTSxDQUFDO0lBQzNDLE1BQU0xTyxPQUErQixHQUFHLENBQUMsQ0FBQztJQUMxQ0EsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHM0UsS0FBSyxDQUFDbUgsT0FBTyxDQUFDO0lBRXZDLE1BQU0sSUFBSSxDQUFDSyxvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVDLFVBQVU7TUFBRU0sS0FBSztNQUFFRDtJQUFRLENBQUMsRUFBRXdDLE9BQU8sQ0FBQztFQUM5Rjs7RUFFQTtBQUNGO0FBQ0E7RUFDRSxNQUFNcU0sZ0JBQWdCQSxDQUFDblAsVUFBa0IsRUFBa0I7SUFDekQsSUFBSSxDQUFDL0UsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBRSx3QkFBdUI5RCxVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUVBLE1BQU1LLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLE1BQU1FLEtBQUssR0FBRyxTQUFTO0lBQ3ZCLE1BQU1nSyxjQUFjLEdBQUc7TUFBRWxLLE1BQU07TUFBRUwsVUFBVTtNQUFFTztJQUFNLENBQUM7SUFFcEQsTUFBTXNCLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQ2dCLGdCQUFnQixDQUFDMEgsY0FBYyxDQUFDO0lBQzVELE1BQU1qSCxJQUFJLEdBQUcsTUFBTW5ILFlBQVksQ0FBQzBGLFFBQVEsQ0FBQztJQUN6QyxPQUFPcEYsVUFBVSxDQUFDMlMsWUFBWSxDQUFDOUwsSUFBSSxDQUFDO0VBQ3RDOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU0rTCxnQkFBZ0JBLENBQUNyUCxVQUFrQixFQUFFQyxVQUFrQixFQUFFNkYsT0FBNkIsR0FBRyxDQUFDLENBQUMsRUFBa0I7SUFDakgsTUFBTXpGLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLElBQUlFLEtBQUssR0FBRyxTQUFTO0lBRXJCLElBQUksQ0FBQ3RGLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHN0QsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDbkYsUUFBUSxDQUFDZ0wsT0FBTyxDQUFDLEVBQUU7TUFDdEIsTUFBTSxJQUFJbk0sTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsb0NBQW9DLENBQUM7SUFDN0U7SUFFQSxJQUFJK0gsT0FBTyxJQUFJQSxPQUFPLENBQUM4QixTQUFTLEVBQUU7TUFDaENySCxLQUFLLEdBQUksR0FBRUEsS0FBTSxjQUFhdUYsT0FBTyxDQUFDOEIsU0FBVSxFQUFDO0lBQ25EO0lBQ0EsTUFBTTJDLGNBQTZCLEdBQUc7TUFBRWxLLE1BQU07TUFBRUwsVUFBVTtNQUFFTztJQUFNLENBQUM7SUFDbkUsSUFBSU4sVUFBVSxFQUFFO01BQ2RzSyxjQUFjLENBQUMsWUFBWSxDQUFDLEdBQUd0SyxVQUFVO0lBQzNDO0lBRUEsTUFBTTRCLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQ2dCLGdCQUFnQixDQUFDMEgsY0FBYyxDQUFDO0lBQzVELE1BQU1qSCxJQUFJLEdBQUcsTUFBTW5ILFlBQVksQ0FBQzBGLFFBQVEsQ0FBQztJQUN6QyxPQUFPcEYsVUFBVSxDQUFDMlMsWUFBWSxDQUFDOUwsSUFBSSxDQUFDO0VBQ3RDOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1nTSxlQUFlQSxDQUFDdFAsVUFBa0IsRUFBRXVQLE1BQWMsRUFBaUI7SUFDdkU7SUFDQSxJQUFJLENBQUN0VSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFFLHdCQUF1QjlELFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDaEYsUUFBUSxDQUFDdVUsTUFBTSxDQUFDLEVBQUU7TUFDckIsTUFBTSxJQUFJNVYsTUFBTSxDQUFDNlYsd0JBQXdCLENBQUUsMEJBQXlCRCxNQUFPLHFCQUFvQixDQUFDO0lBQ2xHO0lBRUEsTUFBTWhQLEtBQUssR0FBRyxRQUFRO0lBRXRCLElBQUlGLE1BQU0sR0FBRyxRQUFRO0lBQ3JCLElBQUlrUCxNQUFNLEVBQUU7TUFDVmxQLE1BQU0sR0FBRyxLQUFLO0lBQ2hCO0lBRUEsTUFBTSxJQUFJLENBQUM4QyxvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVPO0lBQU0sQ0FBQyxFQUFFZ1AsTUFBTSxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDO0VBQ25GOztFQUVBO0FBQ0Y7QUFDQTtFQUNFLE1BQU1FLGVBQWVBLENBQUN6UCxVQUFrQixFQUFtQjtJQUN6RDtJQUNBLElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUUsd0JBQXVCOUQsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFFQSxNQUFNSyxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNRSxLQUFLLEdBQUcsUUFBUTtJQUN0QixNQUFNOEMsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDUixnQkFBZ0IsQ0FBQztNQUFFeEMsTUFBTTtNQUFFTCxVQUFVO01BQUVPO0lBQU0sQ0FBQyxDQUFDO0lBQ3RFLE9BQU8sTUFBTXBFLFlBQVksQ0FBQ2tILEdBQUcsQ0FBQztFQUNoQztFQUVBLE1BQU1xTSxrQkFBa0JBLENBQUMxUCxVQUFrQixFQUFFQyxVQUFrQixFQUFFMFAsYUFBd0IsR0FBRyxDQUFDLENBQUMsRUFBaUI7SUFDN0csSUFBSSxDQUFDMVUsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBRSx3QkFBdUI5RCxVQUFXLEVBQUMsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQzdFLGlCQUFpQixDQUFDOEUsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJdEcsTUFBTSxDQUFDb00sc0JBQXNCLENBQUUsd0JBQXVCOUYsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUNuRixRQUFRLENBQUM2VSxhQUFhLENBQUMsRUFBRTtNQUM1QixNQUFNLElBQUloVyxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQywwQ0FBMEMsQ0FBQztJQUNuRixDQUFDLE1BQU07TUFDTCxJQUFJNFIsYUFBYSxDQUFDNUgsZ0JBQWdCLElBQUksQ0FBQ3JOLFNBQVMsQ0FBQ2lWLGFBQWEsQ0FBQzVILGdCQUFnQixDQUFDLEVBQUU7UUFDaEYsTUFBTSxJQUFJcE8sTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsdUNBQXNDNFIsYUFBYSxDQUFDNUgsZ0JBQWlCLEVBQUMsQ0FBQztNQUNoSDtNQUNBLElBQ0U0SCxhQUFhLENBQUNDLElBQUksSUFDbEIsQ0FBQyxDQUFDOVYsZUFBZSxDQUFDK1YsVUFBVSxFQUFFL1YsZUFBZSxDQUFDZ1csVUFBVSxDQUFDLENBQUM1UCxRQUFRLENBQUN5UCxhQUFhLENBQUNDLElBQUksQ0FBQyxFQUN0RjtRQUNBLE1BQU0sSUFBSWpXLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFFLGtDQUFpQzRSLGFBQWEsQ0FBQ0MsSUFBSyxFQUFDLENBQUM7TUFDL0Y7TUFDQSxJQUFJRCxhQUFhLENBQUNJLGVBQWUsSUFBSSxDQUFDL1UsUUFBUSxDQUFDMlUsYUFBYSxDQUFDSSxlQUFlLENBQUMsRUFBRTtRQUM3RSxNQUFNLElBQUlwVyxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBRSxzQ0FBcUM0UixhQUFhLENBQUNJLGVBQWdCLEVBQUMsQ0FBQztNQUM5RztNQUNBLElBQUlKLGFBQWEsQ0FBQy9ILFNBQVMsSUFBSSxDQUFDNU0sUUFBUSxDQUFDMlUsYUFBYSxDQUFDL0gsU0FBUyxDQUFDLEVBQUU7UUFDakUsTUFBTSxJQUFJak8sTUFBTSxDQUFDb0Usb0JBQW9CLENBQUUsZ0NBQStCNFIsYUFBYSxDQUFDL0gsU0FBVSxFQUFDLENBQUM7TUFDbEc7SUFDRjtJQUVBLE1BQU12SCxNQUFNLEdBQUcsS0FBSztJQUNwQixJQUFJRSxLQUFLLEdBQUcsV0FBVztJQUV2QixNQUFNRCxPQUF1QixHQUFHLENBQUMsQ0FBQztJQUNsQyxJQUFJcVAsYUFBYSxDQUFDNUgsZ0JBQWdCLEVBQUU7TUFDbEN6SCxPQUFPLENBQUMsbUNBQW1DLENBQUMsR0FBRyxJQUFJO0lBQ3JEO0lBRUEsTUFBTXlLLE9BQU8sR0FBRyxJQUFJdFIsTUFBTSxDQUFDa0QsT0FBTyxDQUFDO01BQUV1UyxRQUFRLEVBQUUsV0FBVztNQUFFdFMsVUFBVSxFQUFFO1FBQUVDLE1BQU0sRUFBRTtNQUFNLENBQUM7TUFBRUMsUUFBUSxFQUFFO0lBQUssQ0FBQyxDQUFDO0lBQzVHLE1BQU1TLE1BQThCLEdBQUcsQ0FBQyxDQUFDO0lBRXpDLElBQUlvUyxhQUFhLENBQUNDLElBQUksRUFBRTtNQUN0QnJTLE1BQU0sQ0FBQ3lTLElBQUksR0FBR0wsYUFBYSxDQUFDQyxJQUFJO0lBQ2xDO0lBQ0EsSUFBSUQsYUFBYSxDQUFDSSxlQUFlLEVBQUU7TUFDakN4UyxNQUFNLENBQUMwUyxlQUFlLEdBQUdOLGFBQWEsQ0FBQ0ksZUFBZTtJQUN4RDtJQUNBLElBQUlKLGFBQWEsQ0FBQy9ILFNBQVMsRUFBRTtNQUMzQnJILEtBQUssSUFBSyxjQUFhb1AsYUFBYSxDQUFDL0gsU0FBVSxFQUFDO0lBQ2xEO0lBRUEsTUFBTTlFLE9BQU8sR0FBR2lJLE9BQU8sQ0FBQ2hHLFdBQVcsQ0FBQ3hILE1BQU0sQ0FBQztJQUUzQytDLE9BQU8sQ0FBQyxhQUFhLENBQUMsR0FBRzNFLEtBQUssQ0FBQ21ILE9BQU8sQ0FBQztJQUN2QyxNQUFNLElBQUksQ0FBQ0ssb0JBQW9CLENBQUM7TUFBRTlDLE1BQU07TUFBRUwsVUFBVTtNQUFFQyxVQUFVO01BQUVNLEtBQUs7TUFBRUQ7SUFBUSxDQUFDLEVBQUV3QyxPQUFPLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDMUc7RUFLQSxNQUFNb04sbUJBQW1CQSxDQUFDbFEsVUFBa0IsRUFBRTtJQUM1QyxJQUFJLENBQUMvRSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsTUFBTUssTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTUUsS0FBSyxHQUFHLGFBQWE7SUFFM0IsTUFBTW9MLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQzlJLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRU87SUFBTSxDQUFDLENBQUM7SUFDMUUsTUFBTXFMLFNBQVMsR0FBRyxNQUFNelAsWUFBWSxDQUFDd1AsT0FBTyxDQUFDO0lBQzdDLE9BQU9sUCxVQUFVLENBQUMwVCxxQkFBcUIsQ0FBQ3ZFLFNBQVMsQ0FBQztFQUNwRDtFQU9BLE1BQU13RSxtQkFBbUJBLENBQUNwUSxVQUFrQixFQUFFcVEsY0FBeUQsRUFBRTtJQUN2RyxNQUFNQyxjQUFjLEdBQUcsQ0FBQ3hXLGVBQWUsQ0FBQytWLFVBQVUsRUFBRS9WLGVBQWUsQ0FBQ2dXLFVBQVUsQ0FBQztJQUMvRSxNQUFNUyxVQUFVLEdBQUcsQ0FBQ3hXLHdCQUF3QixDQUFDeVcsSUFBSSxFQUFFelcsd0JBQXdCLENBQUMwVyxLQUFLLENBQUM7SUFFbEYsSUFBSSxDQUFDeFYsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUVBLElBQUlxUSxjQUFjLENBQUNULElBQUksSUFBSSxDQUFDVSxjQUFjLENBQUNwUSxRQUFRLENBQUNtUSxjQUFjLENBQUNULElBQUksQ0FBQyxFQUFFO01BQ3hFLE1BQU0sSUFBSS9QLFNBQVMsQ0FBRSx3Q0FBdUN5USxjQUFlLEVBQUMsQ0FBQztJQUMvRTtJQUNBLElBQUlELGNBQWMsQ0FBQ0ssSUFBSSxJQUFJLENBQUNILFVBQVUsQ0FBQ3JRLFFBQVEsQ0FBQ21RLGNBQWMsQ0FBQ0ssSUFBSSxDQUFDLEVBQUU7TUFDcEUsTUFBTSxJQUFJN1EsU0FBUyxDQUFFLHdDQUF1QzBRLFVBQVcsRUFBQyxDQUFDO0lBQzNFO0lBQ0EsSUFBSUYsY0FBYyxDQUFDTSxRQUFRLElBQUksQ0FBQzlWLFFBQVEsQ0FBQ3dWLGNBQWMsQ0FBQ00sUUFBUSxDQUFDLEVBQUU7TUFDakUsTUFBTSxJQUFJOVEsU0FBUyxDQUFFLDRDQUEyQyxDQUFDO0lBQ25FO0lBRUEsTUFBTVEsTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTUUsS0FBSyxHQUFHLGFBQWE7SUFFM0IsTUFBTXlPLE1BQTZCLEdBQUc7TUFDcEM0QixpQkFBaUIsRUFBRTtJQUNyQixDQUFDO0lBQ0QsTUFBTUMsVUFBVSxHQUFHaFEsTUFBTSxDQUFDNE4sSUFBSSxDQUFDNEIsY0FBYyxDQUFDO0lBRTlDLE1BQU1TLFlBQVksR0FBRyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsVUFBVSxDQUFDLENBQUNDLEtBQUssQ0FBRUMsR0FBRyxJQUFLSCxVQUFVLENBQUMzUSxRQUFRLENBQUM4USxHQUFHLENBQUMsQ0FBQztJQUMxRjtJQUNBLElBQUlILFVBQVUsQ0FBQzdOLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDekIsSUFBSSxDQUFDOE4sWUFBWSxFQUFFO1FBQ2pCLE1BQU0sSUFBSWpSLFNBQVMsQ0FDaEIseUdBQ0gsQ0FBQztNQUNILENBQUMsTUFBTTtRQUNMbVAsTUFBTSxDQUFDWCxJQUFJLEdBQUc7VUFDWjRDLGdCQUFnQixFQUFFLENBQUM7UUFDckIsQ0FBQztRQUNELElBQUlaLGNBQWMsQ0FBQ1QsSUFBSSxFQUFFO1VBQ3ZCWixNQUFNLENBQUNYLElBQUksQ0FBQzRDLGdCQUFnQixDQUFDakIsSUFBSSxHQUFHSyxjQUFjLENBQUNULElBQUk7UUFDekQ7UUFDQSxJQUFJUyxjQUFjLENBQUNLLElBQUksS0FBSzNXLHdCQUF3QixDQUFDeVcsSUFBSSxFQUFFO1VBQ3pEeEIsTUFBTSxDQUFDWCxJQUFJLENBQUM0QyxnQkFBZ0IsQ0FBQ0MsSUFBSSxHQUFHYixjQUFjLENBQUNNLFFBQVE7UUFDN0QsQ0FBQyxNQUFNLElBQUlOLGNBQWMsQ0FBQ0ssSUFBSSxLQUFLM1csd0JBQXdCLENBQUMwVyxLQUFLLEVBQUU7VUFDakV6QixNQUFNLENBQUNYLElBQUksQ0FBQzRDLGdCQUFnQixDQUFDRSxLQUFLLEdBQUdkLGNBQWMsQ0FBQ00sUUFBUTtRQUM5RDtNQUNGO0lBQ0Y7SUFFQSxNQUFNNUYsT0FBTyxHQUFHLElBQUl0UixNQUFNLENBQUNrRCxPQUFPLENBQUM7TUFDakN1UyxRQUFRLEVBQUUseUJBQXlCO01BQ25DdFMsVUFBVSxFQUFFO1FBQUVDLE1BQU0sRUFBRTtNQUFNLENBQUM7TUFDN0JDLFFBQVEsRUFBRTtJQUNaLENBQUMsQ0FBQztJQUNGLE1BQU1nRyxPQUFPLEdBQUdpSSxPQUFPLENBQUNoRyxXQUFXLENBQUNpSyxNQUFNLENBQUM7SUFFM0MsTUFBTTFPLE9BQXVCLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDQSxPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUczRSxLQUFLLENBQUNtSCxPQUFPLENBQUM7SUFFdkMsTUFBTSxJQUFJLENBQUNLLG9CQUFvQixDQUFDO01BQUU5QyxNQUFNO01BQUVMLFVBQVU7TUFBRU8sS0FBSztNQUFFRDtJQUFRLENBQUMsRUFBRXdDLE9BQU8sQ0FBQztFQUNsRjtFQUVBLE1BQU1zTyxtQkFBbUJBLENBQUNwUixVQUFrQixFQUFpQjtJQUMzRCxJQUFJLENBQUMvRSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsTUFBTUssTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTUUsS0FBSyxHQUFHLFlBQVk7SUFFMUIsTUFBTW9MLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQzlJLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRU87SUFBTSxDQUFDLENBQUM7SUFDMUUsTUFBTXFMLFNBQVMsR0FBRyxNQUFNelAsWUFBWSxDQUFDd1AsT0FBTyxDQUFDO0lBQzdDLE9BQU8sTUFBTWxQLFVBQVUsQ0FBQzRVLDJCQUEyQixDQUFDekYsU0FBUyxDQUFDO0VBQ2hFO0VBRUEsTUFBTTBGLG1CQUFtQkEsQ0FBQ3RSLFVBQWtCLEVBQUV1UixhQUE0QyxFQUFpQjtJQUN6RyxJQUFJLENBQUN0VyxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDYSxNQUFNLENBQUM0TixJQUFJLENBQUM4QyxhQUFhLENBQUMsQ0FBQ3ZPLE1BQU0sRUFBRTtNQUN0QyxNQUFNLElBQUlySixNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQywwQ0FBMEMsQ0FBQztJQUNuRjtJQUVBLE1BQU1zQyxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNRSxLQUFLLEdBQUcsWUFBWTtJQUMxQixNQUFNd0ssT0FBTyxHQUFHLElBQUl0UixNQUFNLENBQUNrRCxPQUFPLENBQUM7TUFDakN1UyxRQUFRLEVBQUUseUJBQXlCO01BQ25DdFMsVUFBVSxFQUFFO1FBQUVDLE1BQU0sRUFBRTtNQUFNLENBQUM7TUFDN0JDLFFBQVEsRUFBRTtJQUNaLENBQUMsQ0FBQztJQUNGLE1BQU1nRyxPQUFPLEdBQUdpSSxPQUFPLENBQUNoRyxXQUFXLENBQUN3TSxhQUFhLENBQUM7SUFFbEQsTUFBTSxJQUFJLENBQUNwTyxvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVPO0lBQU0sQ0FBQyxFQUFFdUMsT0FBTyxDQUFDO0VBQ3pFO0VBRUEsTUFBYzBPLFVBQVVBLENBQUNDLGFBQStCLEVBQWlCO0lBQ3ZFLE1BQU07TUFBRXpSLFVBQVU7TUFBRUMsVUFBVTtNQUFFeVIsSUFBSTtNQUFFQztJQUFRLENBQUMsR0FBR0YsYUFBYTtJQUMvRCxNQUFNcFIsTUFBTSxHQUFHLEtBQUs7SUFDcEIsSUFBSUUsS0FBSyxHQUFHLFNBQVM7SUFFckIsSUFBSW9SLE9BQU8sSUFBSUEsT0FBTyxhQUFQQSxPQUFPLGVBQVBBLE9BQU8sQ0FBRS9KLFNBQVMsRUFBRTtNQUNqQ3JILEtBQUssR0FBSSxHQUFFQSxLQUFNLGNBQWFvUixPQUFPLENBQUMvSixTQUFVLEVBQUM7SUFDbkQ7SUFDQSxNQUFNZ0ssUUFBUSxHQUFHLEVBQUU7SUFDbkIsS0FBSyxNQUFNLENBQUN2SSxHQUFHLEVBQUV3SSxLQUFLLENBQUMsSUFBSWhSLE1BQU0sQ0FBQ0MsT0FBTyxDQUFDNFEsSUFBSSxDQUFDLEVBQUU7TUFDL0NFLFFBQVEsQ0FBQ3hMLElBQUksQ0FBQztRQUFFMEwsR0FBRyxFQUFFekksR0FBRztRQUFFMEksS0FBSyxFQUFFRjtNQUFNLENBQUMsQ0FBQztJQUMzQztJQUNBLE1BQU1HLGFBQWEsR0FBRztNQUNwQkMsT0FBTyxFQUFFO1FBQ1BDLE1BQU0sRUFBRTtVQUNOQyxHQUFHLEVBQUVQO1FBQ1A7TUFDRjtJQUNGLENBQUM7SUFDRCxNQUFNdFIsT0FBTyxHQUFHLENBQUMsQ0FBbUI7SUFDcEMsTUFBTXlLLE9BQU8sR0FBRyxJQUFJdFIsTUFBTSxDQUFDa0QsT0FBTyxDQUFDO01BQUVHLFFBQVEsRUFBRSxJQUFJO01BQUVGLFVBQVUsRUFBRTtRQUFFQyxNQUFNLEVBQUU7TUFBTTtJQUFFLENBQUMsQ0FBQztJQUNyRixNQUFNdVYsVUFBVSxHQUFHN08sTUFBTSxDQUFDOEksSUFBSSxDQUFDdEIsT0FBTyxDQUFDaEcsV0FBVyxDQUFDaU4sYUFBYSxDQUFDLENBQUM7SUFDbEUsTUFBTXpILGNBQWMsR0FBRztNQUNyQmxLLE1BQU07TUFDTkwsVUFBVTtNQUNWTyxLQUFLO01BQ0xELE9BQU87TUFFUCxJQUFJTCxVQUFVLElBQUk7UUFBRUEsVUFBVSxFQUFFQTtNQUFXLENBQUM7SUFDOUMsQ0FBQztJQUVESyxPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUczRSxLQUFLLENBQUN5VyxVQUFVLENBQUM7SUFFMUMsTUFBTSxJQUFJLENBQUNqUCxvQkFBb0IsQ0FBQ29ILGNBQWMsRUFBRTZILFVBQVUsQ0FBQztFQUM3RDtFQUVBLE1BQWNDLGFBQWFBLENBQUM7SUFBRXJTLFVBQVU7SUFBRUMsVUFBVTtJQUFFNkg7RUFBZ0MsQ0FBQyxFQUFpQjtJQUN0RyxNQUFNekgsTUFBTSxHQUFHLFFBQVE7SUFDdkIsSUFBSUUsS0FBSyxHQUFHLFNBQVM7SUFFckIsSUFBSXVILFVBQVUsSUFBSWpILE1BQU0sQ0FBQzROLElBQUksQ0FBQzNHLFVBQVUsQ0FBQyxDQUFDOUUsTUFBTSxJQUFJOEUsVUFBVSxDQUFDRixTQUFTLEVBQUU7TUFDeEVySCxLQUFLLEdBQUksR0FBRUEsS0FBTSxjQUFhdUgsVUFBVSxDQUFDRixTQUFVLEVBQUM7SUFDdEQ7SUFDQSxNQUFNMkMsY0FBYyxHQUFHO01BQUVsSyxNQUFNO01BQUVMLFVBQVU7TUFBRUMsVUFBVTtNQUFFTTtJQUFNLENBQUM7SUFFaEUsSUFBSU4sVUFBVSxFQUFFO01BQ2RzSyxjQUFjLENBQUMsWUFBWSxDQUFDLEdBQUd0SyxVQUFVO0lBQzNDO0lBQ0EsTUFBTSxJQUFJLENBQUM0QyxnQkFBZ0IsQ0FBQzBILGNBQWMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7RUFDN0Q7RUFFQSxNQUFNK0gsZ0JBQWdCQSxDQUFDdFMsVUFBa0IsRUFBRTBSLElBQVMsRUFBaUI7SUFDbkUsSUFBSSxDQUFDelcsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUksQ0FBQ2xGLFFBQVEsQ0FBQzRXLElBQUksQ0FBQyxFQUFFO01BQ25CLE1BQU0sSUFBSS9YLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFDLGlDQUFpQyxDQUFDO0lBQzFFO0lBQ0EsSUFBSThDLE1BQU0sQ0FBQzROLElBQUksQ0FBQ2lELElBQUksQ0FBQyxDQUFDMU8sTUFBTSxHQUFHLEVBQUUsRUFBRTtNQUNqQyxNQUFNLElBQUlySixNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQyw2QkFBNkIsQ0FBQztJQUN0RTtJQUVBLE1BQU0sSUFBSSxDQUFDeVQsVUFBVSxDQUFDO01BQUV4UixVQUFVO01BQUUwUjtJQUFLLENBQUMsQ0FBQztFQUM3QztFQUVBLE1BQU1hLG1CQUFtQkEsQ0FBQ3ZTLFVBQWtCLEVBQUU7SUFDNUMsSUFBSSxDQUFDL0UsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLE1BQU0sSUFBSSxDQUFDcVMsYUFBYSxDQUFDO01BQUVyUztJQUFXLENBQUMsQ0FBQztFQUMxQztFQUVBLE1BQU13UyxnQkFBZ0JBLENBQUN4UyxVQUFrQixFQUFFQyxVQUFrQixFQUFFeVIsSUFBVSxFQUFFQyxPQUFvQixFQUFFO0lBQy9GLElBQUksQ0FBQzFXLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHN0QsVUFBVSxDQUFDO0lBQy9FO0lBRUEsSUFBSSxDQUFDbkYsUUFBUSxDQUFDNFcsSUFBSSxDQUFDLEVBQUU7TUFDbkIsTUFBTSxJQUFJL1gsTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsaUNBQWlDLENBQUM7SUFDMUU7SUFDQSxJQUFJOEMsTUFBTSxDQUFDNE4sSUFBSSxDQUFDaUQsSUFBSSxDQUFDLENBQUMxTyxNQUFNLEdBQUcsRUFBRSxFQUFFO01BQ2pDLE1BQU0sSUFBSXJKLE1BQU0sQ0FBQ29FLG9CQUFvQixDQUFDLDZCQUE2QixDQUFDO0lBQ3RFO0lBRUEsTUFBTSxJQUFJLENBQUN5VCxVQUFVLENBQUM7TUFBRXhSLFVBQVU7TUFBRUMsVUFBVTtNQUFFeVIsSUFBSTtNQUFFQztJQUFRLENBQUMsQ0FBQztFQUNsRTtFQUVBLE1BQU1jLG1CQUFtQkEsQ0FBQ3pTLFVBQWtCLEVBQUVDLFVBQWtCLEVBQUU2SCxVQUF1QixFQUFFO0lBQ3pGLElBQUksQ0FBQzdNLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHN0QsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsSUFBSTZILFVBQVUsSUFBSWpILE1BQU0sQ0FBQzROLElBQUksQ0FBQzNHLFVBQVUsQ0FBQyxDQUFDOUUsTUFBTSxJQUFJLENBQUNsSSxRQUFRLENBQUNnTixVQUFVLENBQUMsRUFBRTtNQUN6RSxNQUFNLElBQUluTyxNQUFNLENBQUNvRSxvQkFBb0IsQ0FBQyx1Q0FBdUMsQ0FBQztJQUNoRjtJQUVBLE1BQU0sSUFBSSxDQUFDc1UsYUFBYSxDQUFDO01BQUVyUyxVQUFVO01BQUVDLFVBQVU7TUFBRTZIO0lBQVcsQ0FBQyxDQUFDO0VBQ2xFO0VBRUEsTUFBTTRLLG1CQUFtQkEsQ0FDdkIxUyxVQUFrQixFQUNsQkMsVUFBa0IsRUFDbEIwUyxVQUF5QixFQUNXO0lBQ3BDLElBQUksQ0FBQzFYLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUUsd0JBQXVCOUQsVUFBVyxFQUFDLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUM3RSxpQkFBaUIsQ0FBQzhFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXRHLE1BQU0sQ0FBQ29NLHNCQUFzQixDQUFFLHdCQUF1QjlGLFVBQVcsRUFBQyxDQUFDO0lBQy9FO0lBQ0EsSUFBSSxDQUFDMUcsQ0FBQyxDQUFDcUIsT0FBTyxDQUFDK1gsVUFBVSxDQUFDLEVBQUU7TUFDMUIsSUFBSSxDQUFDM1gsUUFBUSxDQUFDMlgsVUFBVSxDQUFDQyxVQUFVLENBQUMsRUFBRTtRQUNwQyxNQUFNLElBQUkvUyxTQUFTLENBQUMsMENBQTBDLENBQUM7TUFDakU7TUFDQSxJQUFJLENBQUN0RyxDQUFDLENBQUNxQixPQUFPLENBQUMrWCxVQUFVLENBQUNFLGtCQUFrQixDQUFDLEVBQUU7UUFDN0MsSUFBSSxDQUFDL1gsUUFBUSxDQUFDNlgsVUFBVSxDQUFDRSxrQkFBa0IsQ0FBQyxFQUFFO1VBQzVDLE1BQU0sSUFBSWhULFNBQVMsQ0FBQywrQ0FBK0MsQ0FBQztRQUN0RTtNQUNGLENBQUMsTUFBTTtRQUNMLE1BQU0sSUFBSUEsU0FBUyxDQUFDLGdDQUFnQyxDQUFDO01BQ3ZEO01BQ0EsSUFBSSxDQUFDdEcsQ0FBQyxDQUFDcUIsT0FBTyxDQUFDK1gsVUFBVSxDQUFDRyxtQkFBbUIsQ0FBQyxFQUFFO1FBQzlDLElBQUksQ0FBQ2hZLFFBQVEsQ0FBQzZYLFVBQVUsQ0FBQ0csbUJBQW1CLENBQUMsRUFBRTtVQUM3QyxNQUFNLElBQUlqVCxTQUFTLENBQUMsZ0RBQWdELENBQUM7UUFDdkU7TUFDRixDQUFDLE1BQU07UUFDTCxNQUFNLElBQUlBLFNBQVMsQ0FBQyxpQ0FBaUMsQ0FBQztNQUN4RDtJQUNGLENBQUMsTUFBTTtNQUNMLE1BQU0sSUFBSUEsU0FBUyxDQUFDLHdDQUF3QyxDQUFDO0lBQy9EO0lBRUEsTUFBTVEsTUFBTSxHQUFHLE1BQU07SUFDckIsTUFBTUUsS0FBSyxHQUFJLHNCQUFxQjtJQUVwQyxNQUFNeU8sTUFBaUMsR0FBRyxDQUN4QztNQUNFK0QsVUFBVSxFQUFFSixVQUFVLENBQUNDO0lBQ3pCLENBQUMsRUFDRDtNQUNFSSxjQUFjLEVBQUVMLFVBQVUsQ0FBQ00sY0FBYyxJQUFJO0lBQy9DLENBQUMsRUFDRDtNQUNFQyxrQkFBa0IsRUFBRSxDQUFDUCxVQUFVLENBQUNFLGtCQUFrQjtJQUNwRCxDQUFDLEVBQ0Q7TUFDRU0sbUJBQW1CLEVBQUUsQ0FBQ1IsVUFBVSxDQUFDRyxtQkFBbUI7SUFDdEQsQ0FBQyxDQUNGOztJQUVEO0lBQ0EsSUFBSUgsVUFBVSxDQUFDUyxlQUFlLEVBQUU7TUFDOUJwRSxNQUFNLENBQUM1SSxJQUFJLENBQUM7UUFBRWlOLGVBQWUsRUFBRVYsVUFBVSxhQUFWQSxVQUFVLHVCQUFWQSxVQUFVLENBQUVTO01BQWdCLENBQUMsQ0FBQztJQUMvRDtJQUNBO0lBQ0EsSUFBSVQsVUFBVSxDQUFDVyxTQUFTLEVBQUU7TUFDeEJ0RSxNQUFNLENBQUM1SSxJQUFJLENBQUM7UUFBRW1OLFNBQVMsRUFBRVosVUFBVSxDQUFDVztNQUFVLENBQUMsQ0FBQztJQUNsRDtJQUVBLE1BQU12SSxPQUFPLEdBQUcsSUFBSXRSLE1BQU0sQ0FBQ2tELE9BQU8sQ0FBQztNQUNqQ3VTLFFBQVEsRUFBRSw0QkFBNEI7TUFDdEN0UyxVQUFVLEVBQUU7UUFBRUMsTUFBTSxFQUFFO01BQU0sQ0FBQztNQUM3QkMsUUFBUSxFQUFFO0lBQ1osQ0FBQyxDQUFDO0lBQ0YsTUFBTWdHLE9BQU8sR0FBR2lJLE9BQU8sQ0FBQ2hHLFdBQVcsQ0FBQ2lLLE1BQU0sQ0FBQztJQUUzQyxNQUFNM0wsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDUixnQkFBZ0IsQ0FBQztNQUFFeEMsTUFBTTtNQUFFTCxVQUFVO01BQUVDLFVBQVU7TUFBRU07SUFBTSxDQUFDLEVBQUV1QyxPQUFPLENBQUM7SUFDM0YsTUFBTVEsSUFBSSxHQUFHLE1BQU1wSCxZQUFZLENBQUNtSCxHQUFHLENBQUM7SUFDcEMsT0FBTzdHLGdDQUFnQyxDQUFDOEcsSUFBSSxDQUFDO0VBQy9DO0VBRUEsTUFBY2tRLG9CQUFvQkEsQ0FBQ3hULFVBQWtCLEVBQUV5VCxZQUFrQyxFQUFpQjtJQUN4RyxNQUFNcFQsTUFBTSxHQUFHLEtBQUs7SUFDcEIsTUFBTUUsS0FBSyxHQUFHLFdBQVc7SUFFekIsTUFBTUQsT0FBdUIsR0FBRyxDQUFDLENBQUM7SUFDbEMsTUFBTXlLLE9BQU8sR0FBRyxJQUFJdFIsTUFBTSxDQUFDa0QsT0FBTyxDQUFDO01BQ2pDdVMsUUFBUSxFQUFFLHdCQUF3QjtNQUNsQ3BTLFFBQVEsRUFBRSxJQUFJO01BQ2RGLFVBQVUsRUFBRTtRQUFFQyxNQUFNLEVBQUU7TUFBTTtJQUM5QixDQUFDLENBQUM7SUFDRixNQUFNaUcsT0FBTyxHQUFHaUksT0FBTyxDQUFDaEcsV0FBVyxDQUFDME8sWUFBWSxDQUFDO0lBQ2pEblQsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHM0UsS0FBSyxDQUFDbUgsT0FBTyxDQUFDO0lBRXZDLE1BQU0sSUFBSSxDQUFDSyxvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVPLEtBQUs7TUFBRUQ7SUFBUSxDQUFDLEVBQUV3QyxPQUFPLENBQUM7RUFDbEY7RUFFQSxNQUFNNFEscUJBQXFCQSxDQUFDMVQsVUFBa0IsRUFBaUI7SUFDN0QsSUFBSSxDQUFDL0UsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLE1BQU1LLE1BQU0sR0FBRyxRQUFRO0lBQ3ZCLE1BQU1FLEtBQUssR0FBRyxXQUFXO0lBQ3pCLE1BQU0sSUFBSSxDQUFDNEMsb0JBQW9CLENBQUM7TUFBRTlDLE1BQU07TUFBRUwsVUFBVTtNQUFFTztJQUFNLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztFQUMzRTtFQUVBLE1BQU1vVCxrQkFBa0JBLENBQUMzVCxVQUFrQixFQUFFNFQsZUFBcUMsRUFBaUI7SUFDakcsSUFBSSxDQUFDM1ksaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLElBQUl6RyxDQUFDLENBQUNxQixPQUFPLENBQUNnWixlQUFlLENBQUMsRUFBRTtNQUM5QixNQUFNLElBQUksQ0FBQ0YscUJBQXFCLENBQUMxVCxVQUFVLENBQUM7SUFDOUMsQ0FBQyxNQUFNO01BQ0wsTUFBTSxJQUFJLENBQUN3VCxvQkFBb0IsQ0FBQ3hULFVBQVUsRUFBRTRULGVBQWUsQ0FBQztJQUM5RDtFQUNGO0VBRUEsTUFBTUMsa0JBQWtCQSxDQUFDN1QsVUFBa0IsRUFBbUM7SUFDNUUsSUFBSSxDQUFDL0UsaUJBQWlCLENBQUMrRSxVQUFVLENBQUMsRUFBRTtNQUNsQyxNQUFNLElBQUlyRyxNQUFNLENBQUNtSyxzQkFBc0IsQ0FBQyx1QkFBdUIsR0FBRzlELFVBQVUsQ0FBQztJQUMvRTtJQUNBLE1BQU1LLE1BQU0sR0FBRyxLQUFLO0lBQ3BCLE1BQU1FLEtBQUssR0FBRyxXQUFXO0lBRXpCLE1BQU04QyxHQUFHLEdBQUcsTUFBTSxJQUFJLENBQUNSLGdCQUFnQixDQUFDO01BQUV4QyxNQUFNO01BQUVMLFVBQVU7TUFBRU87SUFBTSxDQUFDLENBQUM7SUFDdEUsTUFBTStDLElBQUksR0FBRyxNQUFNbkgsWUFBWSxDQUFDa0gsR0FBRyxDQUFDO0lBQ3BDLE9BQU81RyxVQUFVLENBQUNxWCxvQkFBb0IsQ0FBQ3hRLElBQUksQ0FBQztFQUM5QztFQUNBLE1BQU15USxtQkFBbUJBLENBQUMvVCxVQUFrQixFQUFFZ1UsZ0JBQW1DLEVBQWlCO0lBQ2hHLElBQUksQ0FBQy9ZLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxJQUFJLENBQUN6RyxDQUFDLENBQUNxQixPQUFPLENBQUNvWixnQkFBZ0IsQ0FBQyxJQUFJQSxnQkFBZ0IsQ0FBQzNGLElBQUksQ0FBQ3JMLE1BQU0sR0FBRyxDQUFDLEVBQUU7TUFDcEUsTUFBTSxJQUFJckosTUFBTSxDQUFDb0Usb0JBQW9CLENBQUMsa0RBQWtELEdBQUdpVyxnQkFBZ0IsQ0FBQzNGLElBQUksQ0FBQztJQUNuSDtJQUVBLElBQUk0RixhQUFhLEdBQUdELGdCQUFnQjtJQUNwQyxJQUFJemEsQ0FBQyxDQUFDcUIsT0FBTyxDQUFDb1osZ0JBQWdCLENBQUMsRUFBRTtNQUMvQkMsYUFBYSxHQUFHO1FBQ2Q7UUFDQTVGLElBQUksRUFBRSxDQUNKO1VBQ0U2RixrQ0FBa0MsRUFBRTtZQUNsQ0MsWUFBWSxFQUFFO1VBQ2hCO1FBQ0YsQ0FBQztNQUVMLENBQUM7SUFDSDtJQUVBLE1BQU05VCxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNRSxLQUFLLEdBQUcsWUFBWTtJQUMxQixNQUFNd0ssT0FBTyxHQUFHLElBQUl0UixNQUFNLENBQUNrRCxPQUFPLENBQUM7TUFDakN1UyxRQUFRLEVBQUUsbUNBQW1DO01BQzdDdFMsVUFBVSxFQUFFO1FBQUVDLE1BQU0sRUFBRTtNQUFNLENBQUM7TUFDN0JDLFFBQVEsRUFBRTtJQUNaLENBQUMsQ0FBQztJQUNGLE1BQU1nRyxPQUFPLEdBQUdpSSxPQUFPLENBQUNoRyxXQUFXLENBQUNrUCxhQUFhLENBQUM7SUFFbEQsTUFBTTNULE9BQXVCLEdBQUcsQ0FBQyxDQUFDO0lBQ2xDQSxPQUFPLENBQUMsYUFBYSxDQUFDLEdBQUczRSxLQUFLLENBQUNtSCxPQUFPLENBQUM7SUFFdkMsTUFBTSxJQUFJLENBQUNLLG9CQUFvQixDQUFDO01BQUU5QyxNQUFNO01BQUVMLFVBQVU7TUFBRU8sS0FBSztNQUFFRDtJQUFRLENBQUMsRUFBRXdDLE9BQU8sQ0FBQztFQUNsRjtFQUVBLE1BQU1zUixtQkFBbUJBLENBQUNwVSxVQUFrQixFQUFFO0lBQzVDLElBQUksQ0FBQy9FLGlCQUFpQixDQUFDK0UsVUFBVSxDQUFDLEVBQUU7TUFDbEMsTUFBTSxJQUFJckcsTUFBTSxDQUFDbUssc0JBQXNCLENBQUMsdUJBQXVCLEdBQUc5RCxVQUFVLENBQUM7SUFDL0U7SUFDQSxNQUFNSyxNQUFNLEdBQUcsS0FBSztJQUNwQixNQUFNRSxLQUFLLEdBQUcsWUFBWTtJQUUxQixNQUFNOEMsR0FBRyxHQUFHLE1BQU0sSUFBSSxDQUFDUixnQkFBZ0IsQ0FBQztNQUFFeEMsTUFBTTtNQUFFTCxVQUFVO01BQUVPO0lBQU0sQ0FBQyxDQUFDO0lBQ3RFLE1BQU0rQyxJQUFJLEdBQUcsTUFBTW5ILFlBQVksQ0FBQ2tILEdBQUcsQ0FBQztJQUNwQyxPQUFPNUcsVUFBVSxDQUFDNFgsMkJBQTJCLENBQUMvUSxJQUFJLENBQUM7RUFDckQ7RUFFQSxNQUFNZ1Isc0JBQXNCQSxDQUFDdFUsVUFBa0IsRUFBRTtJQUMvQyxJQUFJLENBQUMvRSxpQkFBaUIsQ0FBQytFLFVBQVUsQ0FBQyxFQUFFO01BQ2xDLE1BQU0sSUFBSXJHLE1BQU0sQ0FBQ21LLHNCQUFzQixDQUFDLHVCQUF1QixHQUFHOUQsVUFBVSxDQUFDO0lBQy9FO0lBQ0EsTUFBTUssTUFBTSxHQUFHLFFBQVE7SUFDdkIsTUFBTUUsS0FBSyxHQUFHLFlBQVk7SUFFMUIsTUFBTSxJQUFJLENBQUM0QyxvQkFBb0IsQ0FBQztNQUFFOUMsTUFBTTtNQUFFTCxVQUFVO01BQUVPO0lBQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0VBQzNFO0FBQ0YifQ==