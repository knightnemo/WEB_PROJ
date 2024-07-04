"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var crypto = _interopRequireWildcard(require("crypto"), true);
var fs = _interopRequireWildcard(require("fs"), true);
var http = _interopRequireWildcard(require("http"), true);
var https = _interopRequireWildcard(require("https"), true);
var path = _interopRequireWildcard(require("path"), true);
var stream = _interopRequireWildcard(require("stream"), true);
var async = _interopRequireWildcard(require("async"), true);
var _blockStream = require("block-stream2");
var _browserOrNode = require("browser-or-node");
var _lodash = require("lodash");
var qs = _interopRequireWildcard(require("query-string"), true);
var _xml2js = require("xml2js");
var _CredentialProvider = require("../CredentialProvider.js");
var errors = _interopRequireWildcard(require("../errors.js"), true);
var _helpers = require("../helpers.js");
var _signing = require("../signing.js");
var _async2 = require("./async.js");
var _extensions = require("./extensions.js");
var _helper = require("./helper.js");
var _joinHostPort = require("./join-host-port.js");
var _request = require("./request.js");
var _response = require("./response.js");
var _s3Endpoints = require("./s3-endpoints.js");
var xmlParsers = _interopRequireWildcard(require("./xml-parser.js"), true);
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
const xml = new _xml2js.Builder({
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
class TypedClient {
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
    if (!(0, _helper.isValidEndpoint)(params.endPoint)) {
      throw new errors.InvalidEndpointError(`Invalid endPoint : ${params.endPoint}`);
    }
    if (!(0, _helper.isValidPort)(params.port)) {
      throw new errors.InvalidArgumentError(`Invalid port : ${params.port}`);
    }
    if (!(0, _helper.isBoolean)(params.useSSL)) {
      throw new errors.InvalidArgumentError(`Invalid useSSL flag type : ${params.useSSL}, expected to be of type "boolean"`);
    }

    // Validate region only if its set.
    if (params.region) {
      if (!(0, _helper.isString)(params.region)) {
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
      if (!(0, _helper.isObject)(params.transport)) {
        throw new errors.InvalidArgumentError(`Invalid transport type : ${params.transport}, expected to be type "object"`);
      }
      transport = params.transport;
    }

    // if custom transport agent is set, use it.
    if (params.transportAgent) {
      if (!(0, _helper.isObject)(params.transportAgent)) {
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
    this.clientExtensions = new _extensions.Extensions(this);
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
    if (!(0, _helper.isObject)(options)) {
      throw new TypeError('request options should be of type "object"');
    }
    this.reqOptions = _lodash.pick(options, requestOptionProperties);
  }

  /**
   *  This is s3 Specific and does not hold validity in any other Object storage.
   */
  getAccelerateEndPointIfSet(bucketName, objectName) {
    if (!(0, _helper.isEmpty)(this.s3AccelerateEndpoint) && !(0, _helper.isEmpty)(bucketName) && !(0, _helper.isEmpty)(objectName)) {
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
      virtualHostStyle = (0, _helper.isVirtualHostStyle)(this.host, this.protocol, bucketName, this.pathStyle);
    }
    let path = '/';
    let host = this.host;
    let port;
    if (this.port) {
      port = this.port;
    }
    if (objectName) {
      objectName = (0, _helper.uriResourceEscape)(objectName);
    }

    // For Amazon S3 endpoint, get endpoint based on region.
    if ((0, _helper.isAmazonEndpoint)(host)) {
      const accelerateEndPoint = this.getAccelerateEndPointIfSet(bucketName, objectName);
      if (accelerateEndPoint) {
        host = `${accelerateEndPoint}`;
      } else {
        host = (0, _s3Endpoints.getS3Endpoint)(region);
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
      reqOptions.headers.host = (0, _joinHostPort.joinHostPort)(host, port);
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
      headers: _lodash.mapValues(_lodash.pickBy(reqOptions.headers, _helper.isDefined), v => v.toString()),
      host,
      port,
      path
    };
  }
  async setCredentialsProvider(credentialsProvider) {
    if (!(credentialsProvider instanceof _CredentialProvider.CredentialProvider)) {
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
    if (!(0, _helper.isObject)(reqOptions)) {
      throw new TypeError('reqOptions should be of type "object"');
    }
    if (response && !(0, _helper.isReadableStream)(response)) {
      throw new TypeError('response should be of type "Stream"');
    }
    if (err && !(err instanceof Error)) {
      throw new TypeError('err should be of type "Error"');
    }
    const logStream = this.logStream;
    const logHeaders = headers => {
      Object.entries(headers).forEach(([k, v]) => {
        if (k == 'authorization') {
          if ((0, _helper.isString)(v)) {
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
    if (!(0, _helper.isObject)(options)) {
      throw new TypeError('options should be of type "object"');
    }
    if (!(0, _helper.isString)(payload) && !(0, _helper.isObject)(payload)) {
      // Buffer is of type 'object'
      throw new TypeError('payload should be of type "string" or "Buffer"');
    }
    expectedCodes.forEach(statusCode => {
      if (!(0, _helper.isNumber)(statusCode)) {
        throw new TypeError('statusCode should be of type "number"');
      }
    });
    if (!(0, _helper.isString)(region)) {
      throw new TypeError('region should be of type "string"');
    }
    if (!options.headers) {
      options.headers = {};
    }
    if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
      options.headers['content-length'] = payload.length.toString();
    }
    const sha256sum = this.enableSHA256 ? (0, _helper.toSha256)(payload) : '';
    return this.makeRequestStreamAsync(options, payload, sha256sum, expectedCodes, region);
  }

  /**
   * new request with promise
   *
   * No need to drain response, response body is not valid
   */
  async makeRequestAsyncOmit(options, payload = '', statusCodes = [200], region = '') {
    const res = await this.makeRequestAsync(options, payload, statusCodes, region);
    await (0, _response.drainResponse)(res);
    return res;
  }

  /**
   * makeRequestStream will be used directly instead of makeRequest in case the payload
   * is available as a stream. for ex. putObject
   *
   * @internal
   */
  async makeRequestStreamAsync(options, body, sha256sum, statusCodes, region) {
    if (!(0, _helper.isObject)(options)) {
      throw new TypeError('options should be of type "object"');
    }
    if (!(Buffer.isBuffer(body) || typeof body === 'string' || (0, _helper.isReadableStream)(body))) {
      throw new errors.InvalidArgumentError(`stream should be a Buffer, string or readable Stream, got ${typeof body} instead`);
    }
    if (!(0, _helper.isString)(sha256sum)) {
      throw new TypeError('sha256sum should be of type "string"');
    }
    statusCodes.forEach(statusCode => {
      if (!(0, _helper.isNumber)(statusCode)) {
        throw new TypeError('statusCode should be of type "number"');
      }
    });
    if (!(0, _helper.isString)(region)) {
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
      reqOptions.headers['x-amz-date'] = (0, _helper.makeDateLong)(date);
      reqOptions.headers['x-amz-content-sha256'] = sha256sum;
      if (this.sessionToken) {
        reqOptions.headers['x-amz-security-token'] = this.sessionToken;
      }
      reqOptions.headers.authorization = (0, _signing.signV4)(reqOptions, this.accessKey, this.secretKey, region, date, sha256sum);
    }
    const response = await (0, _request.request)(this.transport, reqOptions, body);
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
      const body = await (0, _response.readAsString)(response);
      const region = xmlParsers.parseBucketRegion(body) || _helpers.DEFAULT_REGION;
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
    const pathStyle = this.pathStyle && !_browserOrNode.isBrowser;
    let region;
    try {
      const res = await this.makeRequestAsync({
        method,
        bucketName,
        query,
        pathStyle
      }, '', [200], _helpers.DEFAULT_REGION);
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
        await (0, _response.drainResponse)(res);
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    // Backward Compatibility
    if ((0, _helper.isObject)(region)) {
      makeOpts = region;
      region = '';
    }
    if (!(0, _helper.isString)(region)) {
      throw new TypeError('region should be of type "string"');
    }
    if (!(0, _helper.isObject)(makeOpts)) {
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
    if (region && region !== _helpers.DEFAULT_REGION) {
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
      region = _helpers.DEFAULT_REGION;
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
      if (region === '' || region === _helpers.DEFAULT_REGION) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isNumber)(offset)) {
      throw new TypeError('offset should be of type "number"');
    }
    if (!(0, _helper.isNumber)(length)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(filePath)) {
      throw new TypeError('filePath should be of type "string"');
    }
    const downloadToTmpFile = async () => {
      let partFileStream;
      const objStat = await this.statObject(bucketName, objectName, getOpts);
      const partFile = `${filePath}.${objStat.etag}.part.minio`;
      await _async2.fsp.mkdir(path.dirname(filePath), {
        recursive: true
      });
      let offset = 0;
      try {
        const stats = await _async2.fsp.stat(partFile);
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
      await _async2.streamPromise.pipeline(downloadStream, partFileStream);
      const stats = await _async2.fsp.stat(partFile);
      if (stats.size === objStat.size) {
        return partFile;
      }
      throw new Error('Size mismatch between downloaded file and the object');
    };
    const partFile = await downloadToTmpFile();
    await _async2.fsp.rename(partFile, filePath);
  }

  /**
   * Stat information of the object.
   */
  async statObject(bucketName, objectName, statOpts = {}) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(statOpts)) {
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
      metaData: (0, _helper.extractMetadata)(res.headers),
      lastModified: new Date(res.headers['last-modified']),
      versionId: (0, _helper.getVersionId)(res.headers),
      etag: (0, _helper.sanitizeETag)(res.headers.etag)
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(removeOpts)) {
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
    if (!(0, _helper.isValidBucketName)(bucket)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucket);
    }
    if (!(0, _helper.isValidPrefix)(prefix)) {
      throw new errors.InvalidPrefixError(`Invalid prefix : ${prefix}`);
    }
    if (!(0, _helper.isBoolean)(recursive)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isString)(prefix)) {
      throw new TypeError('prefix should be of type "string"');
    }
    if (!(0, _helper.isString)(keyMarker)) {
      throw new TypeError('keyMarker should be of type "string"');
    }
    if (!(0, _helper.isString)(uploadIdMarker)) {
      throw new TypeError('uploadIdMarker should be of type "string"');
    }
    if (!(0, _helper.isString)(delimiter)) {
      throw new TypeError('delimiter should be of type "string"');
    }
    const queries = [];
    queries.push(`prefix=${(0, _helper.uriEscape)(prefix)}`);
    queries.push(`delimiter=${(0, _helper.uriEscape)(delimiter)}`);
    if (keyMarker) {
      queries.push(`key-marker=${(0, _helper.uriEscape)(keyMarker)}`);
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
    const body = await (0, _response.readAsString)(res);
    return xmlParsers.parseListMultipart(body);
  }

  /**
   * Initiate a new multipart upload.
   * @internal
   */
  async initiateNewMultipartUpload(bucketName, objectName, headers) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(headers)) {
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
    const body = await (0, _response.readAsBuffer)(res);
    return (0, xmlParsers.parseInitiateMultipart)(body.toString());
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(uploadId)) {
      throw new TypeError('uploadId should be of type "string"');
    }
    if (!(0, _helper.isObject)(etags)) {
      throw new TypeError('etags should be of type "Array"');
    }
    if (!uploadId) {
      throw new errors.InvalidArgumentError('uploadId cannot be empty');
    }
    const method = 'POST';
    const query = `uploadId=${(0, _helper.uriEscape)(uploadId)}`;
    const builder = new _xml2js.Builder();
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
    const body = await (0, _response.readAsBuffer)(res);
    const result = (0, xmlParsers.parseCompleteMultipart)(body.toString());
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
      versionId: (0, _helper.getVersionId)(res.headers)
    };
  }

  /**
   * Get part-info of all parts of an incomplete upload specified by uploadId.
   */
  async listParts(bucketName, objectName, uploadId) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(uploadId)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(uploadId)) {
      throw new TypeError('uploadId should be of type "string"');
    }
    if (!(0, _helper.isNumber)(marker)) {
      throw new TypeError('marker should be of type "number"');
    }
    if (!uploadId) {
      throw new errors.InvalidArgumentError('uploadId cannot be empty');
    }
    let query = `uploadId=${(0, _helper.uriEscape)(uploadId)}`;
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
    return xmlParsers.parseListParts(await (0, _response.readAsString)(res));
  }
  async listBuckets() {
    const method = 'GET';
    const httpRes = await this.makeRequestAsync({
      method
    }, '', [200], this.region ?? '');
    const xmlResult = await (0, _response.readAsString)(httpRes);
    return xmlParsers.parseListBucket(xmlResult);
  }

  /**
   * Calculate part size given the object size. Part size will be atleast this.partSize
   */
  calculatePartSize(size) {
    if (!(0, _helper.isNumber)(size)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isString)(filePath)) {
      throw new TypeError('filePath should be of type "string"');
    }
    if (!(0, _helper.isObject)(metaData)) {
      throw new TypeError('metaData should be of type "object"');
    }

    // Inserts correct `content-type` attribute based on metaData and filePath
    metaData = (0, _helper.insertContentType)(metaData, filePath);
    const stat = await _async2.fsp.lstat(filePath);
    await this.putObject(bucketName, objectName, fs.createReadStream(filePath), stat.size, metaData);
  }

  /**
   *  Uploading a stream, "Buffer" or "string".
   *  It's recommended to pass `size` argument with stream.
   */
  async putObject(bucketName, objectName, stream, size, metaData) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }

    // We'll need to shift arguments to the left because of metaData
    // and size being optional.
    if ((0, _helper.isObject)(size)) {
      metaData = size;
    }
    // Ensures Metadata has appropriate prefix for A3 API
    const headers = (0, _helper.prependXAMZMeta)(metaData);
    if (typeof stream === 'string' || stream instanceof Buffer) {
      // Adapts the non-stream interface into a stream.
      size = stream.length;
      stream = (0, _helper.readableStream)(stream);
    } else if (!(0, _helper.isReadableStream)(stream)) {
      throw new TypeError('third argument should be of type "stream.Readable" or "Buffer" or "string"');
    }
    if ((0, _helper.isNumber)(size) && size < 0) {
      throw new errors.InvalidArgumentError(`size cannot be negative, given size: ${size}`);
    }

    // Get the part size and forward that to the BlockStream. Default to the
    // largest block size possible if necessary.
    if (!(0, _helper.isNumber)(size)) {
      size = this.maxObjectSize;
    }

    // Get the part size and forward that to the BlockStream. Default to the
    // largest block size possible if necessary.
    if (size === undefined) {
      const statSize = await (0, _helper.getContentLength)(stream);
      if (statSize !== null) {
        size = statSize;
      }
    }
    if (!(0, _helper.isNumber)(size)) {
      // Backward compatibility
      size = this.maxObjectSize;
    }
    const partSize = this.calculatePartSize(size);
    if (typeof stream === 'string' || Buffer.isBuffer(stream) || size <= partSize) {
      const buf = (0, _helper.isReadableStream)(stream) ? await (0, _response.readAsBuffer)(stream) : Buffer.from(stream);
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
    } = (0, _helper.hashBinary)(buf, this.enableSHA256);
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
    await (0, _response.drainResponse)(res);
    return {
      etag: (0, _helper.sanitizeETag)(res.headers.etag),
      versionId: (0, _helper.getVersionId)(res.headers)
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
    const chunkier = new _blockStream({
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isObject)(replicationConfig)) {
      throw new errors.InvalidArgumentError('replicationConfig should be of type "object"');
    } else {
      if (_lodash.isEmpty(replicationConfig.role)) {
        throw new errors.InvalidArgumentError('Role cannot be empty');
      } else if (replicationConfig.role && !(0, _helper.isString)(replicationConfig.role)) {
        throw new errors.InvalidArgumentError('Invalid value for role', replicationConfig.role);
      }
      if (_lodash.isEmpty(replicationConfig.rules)) {
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
    const builder = new _xml2js.Builder({
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(replicationParamsConfig);
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketReplication(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'replication';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    }, '', [200, 204]);
    const xmlResult = await (0, _response.readAsString)(httpRes);
    return xmlParsers.parseReplicationConfig(xmlResult);
  }
  async getObjectLegalHold(bucketName, objectName, getOpts) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (getOpts) {
      if (!(0, _helper.isObject)(getOpts)) {
        throw new TypeError('getOpts should be of type "Object"');
      } else if (Object.keys(getOpts).length > 0 && getOpts.versionId && !(0, _helper.isString)(getOpts.versionId)) {
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
    const strRes = await (0, _response.readAsString)(httpRes);
    return (0, xmlParsers.parseObjectLegalHoldConfig)(strRes);
  }
  async setObjectLegalHold(bucketName, objectName, setOpts = {
    status: _helpers.LEGAL_HOLD_STATUS.ENABLED
  }) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(setOpts)) {
      throw new TypeError('setOpts should be of type "Object"');
    } else {
      if (![_helpers.LEGAL_HOLD_STATUS.ENABLED, _helpers.LEGAL_HOLD_STATUS.DISABLED].includes(setOpts === null || setOpts === void 0 ? void 0 : setOpts.status)) {
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
    const builder = new _xml2js.Builder({
      rootName: 'LegalHold',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(config);
    const headers = {};
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
    const body = await (0, _response.readAsString)(response);
    return xmlParsers.parseTagging(body);
  }

  /**
   *  Get the tags associated with a bucket OR an object
   */
  async getObjectTagging(bucketName, objectName, getOpts = {}) {
    const method = 'GET';
    let query = 'tagging';
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (!(0, _helper.isObject)(getOpts)) {
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
    const body = await (0, _response.readAsString)(response);
    return xmlParsers.parseTagging(body);
  }

  /**
   *  Set the policy on a bucket or an object prefix.
   */
  async setBucketPolicy(bucketName, policy) {
    // Validate arguments.
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isString)(policy)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    const method = 'GET';
    const query = 'policy';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    return await (0, _response.readAsString)(res);
  }
  async putObjectRetention(bucketName, objectName, retentionOpts = {}) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!(0, _helper.isObject)(retentionOpts)) {
      throw new errors.InvalidArgumentError('retentionOpts should be of type "object"');
    } else {
      if (retentionOpts.governanceBypass && !(0, _helper.isBoolean)(retentionOpts.governanceBypass)) {
        throw new errors.InvalidArgumentError(`Invalid value for governanceBypass: ${retentionOpts.governanceBypass}`);
      }
      if (retentionOpts.mode && ![_helpers.RETENTION_MODES.COMPLIANCE, _helpers.RETENTION_MODES.GOVERNANCE].includes(retentionOpts.mode)) {
        throw new errors.InvalidArgumentError(`Invalid object retention mode: ${retentionOpts.mode}`);
      }
      if (retentionOpts.retainUntilDate && !(0, _helper.isString)(retentionOpts.retainUntilDate)) {
        throw new errors.InvalidArgumentError(`Invalid value for retainUntilDate: ${retentionOpts.retainUntilDate}`);
      }
      if (retentionOpts.versionId && !(0, _helper.isString)(retentionOpts.versionId)) {
        throw new errors.InvalidArgumentError(`Invalid value for versionId: ${retentionOpts.versionId}`);
      }
    }
    const method = 'PUT';
    let query = 'retention';
    const headers = {};
    if (retentionOpts.governanceBypass) {
      headers['X-Amz-Bypass-Governance-Retention'] = true;
    }
    const builder = new _xml2js.Builder({
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
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      objectName,
      query,
      headers
    }, payload, [200, 204]);
  }
  async getObjectLockConfig(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'object-lock';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const xmlResult = await (0, _response.readAsString)(httpRes);
    return xmlParsers.parseObjectLockConfig(xmlResult);
  }
  async setObjectLockConfig(bucketName, lockConfigOpts) {
    const retentionModes = [_helpers.RETENTION_MODES.COMPLIANCE, _helpers.RETENTION_MODES.GOVERNANCE];
    const validUnits = [_helpers.RETENTION_VALIDITY_UNITS.DAYS, _helpers.RETENTION_VALIDITY_UNITS.YEARS];
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (lockConfigOpts.mode && !retentionModes.includes(lockConfigOpts.mode)) {
      throw new TypeError(`lockConfigOpts.mode should be one of ${retentionModes}`);
    }
    if (lockConfigOpts.unit && !validUnits.includes(lockConfigOpts.unit)) {
      throw new TypeError(`lockConfigOpts.unit should be one of ${validUnits}`);
    }
    if (lockConfigOpts.validity && !(0, _helper.isNumber)(lockConfigOpts.validity)) {
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
        if (lockConfigOpts.unit === _helpers.RETENTION_VALIDITY_UNITS.DAYS) {
          config.Rule.DefaultRetention.Days = lockConfigOpts.validity;
        } else if (lockConfigOpts.unit === _helpers.RETENTION_VALIDITY_UNITS.YEARS) {
          config.Rule.DefaultRetention.Years = lockConfigOpts.validity;
        }
      }
    }
    const builder = new _xml2js.Builder({
      rootName: 'ObjectLockConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(config);
    const headers = {};
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketVersioning(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'versioning';
    const httpRes = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const xmlResult = await (0, _response.readAsString)(httpRes);
    return await xmlParsers.parseBucketVersioningConfig(xmlResult);
  }
  async setBucketVersioning(bucketName, versionConfig) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!Object.keys(versionConfig).length) {
      throw new errors.InvalidArgumentError('versionConfig should be of type "object"');
    }
    const method = 'PUT';
    const query = 'versioning';
    const builder = new _xml2js.Builder({
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
    const builder = new _xml2js.Builder({
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
    headers['Content-MD5'] = (0, _helper.toMd5)(payloadBuf);
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isObject)(tags)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    await this.removeTagging({
      bucketName
    });
  }
  async setObjectTagging(bucketName, objectName, tags, putOpts) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (!(0, _helper.isObject)(tags)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidBucketNameError('Invalid object name: ' + objectName);
    }
    if (removeOpts && Object.keys(removeOpts).length && !(0, _helper.isObject)(removeOpts)) {
      throw new errors.InvalidArgumentError('removeOpts should be of type "object"');
    }
    await this.removeTagging({
      bucketName,
      objectName,
      removeOpts
    });
  }
  async selectObjectContent(bucketName, objectName, selectOpts) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError(`Invalid bucket name: ${bucketName}`);
    }
    if (!(0, _helper.isValidObjectName)(objectName)) {
      throw new errors.InvalidObjectNameError(`Invalid object name: ${objectName}`);
    }
    if (!_lodash.isEmpty(selectOpts)) {
      if (!(0, _helper.isString)(selectOpts.expression)) {
        throw new TypeError('sqlExpression should be of type "string"');
      }
      if (!_lodash.isEmpty(selectOpts.inputSerialization)) {
        if (!(0, _helper.isObject)(selectOpts.inputSerialization)) {
          throw new TypeError('inputSerialization should be of type "object"');
        }
      } else {
        throw new TypeError('inputSerialization is required');
      }
      if (!_lodash.isEmpty(selectOpts.outputSerialization)) {
        if (!(0, _helper.isObject)(selectOpts.outputSerialization)) {
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
    const builder = new _xml2js.Builder({
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
    const body = await (0, _response.readAsBuffer)(res);
    return (0, xmlParsers.parseSelectObjectContentResponse)(body);
  }
  async applyBucketLifecycle(bucketName, policyConfig) {
    const method = 'PUT';
    const query = 'lifecycle';
    const headers = {};
    const builder = new _xml2js.Builder({
      rootName: 'LifecycleConfiguration',
      headless: true,
      renderOpts: {
        pretty: false
      }
    });
    const payload = builder.buildObject(policyConfig);
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async removeBucketLifecycle(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (_lodash.isEmpty(lifeCycleConfig)) {
      await this.removeBucketLifecycle(bucketName);
    } else {
      await this.applyBucketLifecycle(bucketName, lifeCycleConfig);
    }
  }
  async getBucketLifecycle(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'lifecycle';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const body = await (0, _response.readAsString)(res);
    return xmlParsers.parseLifecycleConfig(body);
  }
  async setBucketEncryption(bucketName, encryptionConfig) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    if (!_lodash.isEmpty(encryptionConfig) && encryptionConfig.Rule.length > 1) {
      throw new errors.InvalidArgumentError('Invalid Rule length. Only one rule is allowed.: ' + encryptionConfig.Rule);
    }
    let encryptionObj = encryptionConfig;
    if (_lodash.isEmpty(encryptionConfig)) {
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
    const builder = new _xml2js.Builder({
      rootName: 'ServerSideEncryptionConfiguration',
      renderOpts: {
        pretty: false
      },
      headless: true
    });
    const payload = builder.buildObject(encryptionObj);
    const headers = {};
    headers['Content-MD5'] = (0, _helper.toMd5)(payload);
    await this.makeRequestAsyncOmit({
      method,
      bucketName,
      query,
      headers
    }, payload);
  }
  async getBucketEncryption(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
      throw new errors.InvalidBucketNameError('Invalid bucket name: ' + bucketName);
    }
    const method = 'GET';
    const query = 'encryption';
    const res = await this.makeRequestAsync({
      method,
      bucketName,
      query
    });
    const body = await (0, _response.readAsString)(res);
    return xmlParsers.parseBucketEncryptionConfig(body);
  }
  async removeBucketEncryption(bucketName) {
    if (!(0, _helper.isValidBucketName)(bucketName)) {
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
exports.TypedClient = TypedClient;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjcnlwdG8iLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsInJlcXVpcmUiLCJmcyIsImh0dHAiLCJodHRwcyIsInBhdGgiLCJzdHJlYW0iLCJhc3luYyIsIl9ibG9ja1N0cmVhbSIsIl9icm93c2VyT3JOb2RlIiwiX2xvZGFzaCIsInFzIiwiX3htbDJqcyIsIl9DcmVkZW50aWFsUHJvdmlkZXIiLCJlcnJvcnMiLCJfaGVscGVycyIsIl9zaWduaW5nIiwiX2FzeW5jMiIsIl9leHRlbnNpb25zIiwiX2hlbHBlciIsIl9qb2luSG9zdFBvcnQiLCJfcmVxdWVzdCIsIl9yZXNwb25zZSIsIl9zM0VuZHBvaW50cyIsInhtbFBhcnNlcnMiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0IiwieG1sIiwieG1sMmpzIiwiQnVpbGRlciIsInJlbmRlck9wdHMiLCJwcmV0dHkiLCJoZWFkbGVzcyIsIlBhY2thZ2UiLCJ2ZXJzaW9uIiwicmVxdWVzdE9wdGlvblByb3BlcnRpZXMiLCJUeXBlZENsaWVudCIsInBhcnRTaXplIiwibWF4aW11bVBhcnRTaXplIiwibWF4T2JqZWN0U2l6ZSIsImNvbnN0cnVjdG9yIiwicGFyYW1zIiwic2VjdXJlIiwidW5kZWZpbmVkIiwiRXJyb3IiLCJ1c2VTU0wiLCJwb3J0IiwiaXNWYWxpZEVuZHBvaW50IiwiZW5kUG9pbnQiLCJJbnZhbGlkRW5kcG9pbnRFcnJvciIsImlzVmFsaWRQb3J0IiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJpc0Jvb2xlYW4iLCJyZWdpb24iLCJpc1N0cmluZyIsImhvc3QiLCJ0b0xvd2VyQ2FzZSIsInByb3RvY29sIiwidHJhbnNwb3J0IiwidHJhbnNwb3J0QWdlbnQiLCJnbG9iYWxBZ2VudCIsImlzT2JqZWN0IiwibGlicmFyeUNvbW1lbnRzIiwicHJvY2VzcyIsInBsYXRmb3JtIiwiYXJjaCIsImxpYnJhcnlBZ2VudCIsInVzZXJBZ2VudCIsInBhdGhTdHlsZSIsImFjY2Vzc0tleSIsInNlY3JldEtleSIsInNlc3Npb25Ub2tlbiIsImFub255bW91cyIsImNyZWRlbnRpYWxzUHJvdmlkZXIiLCJyZWdpb25NYXAiLCJvdmVyUmlkZVBhcnRTaXplIiwiZW5hYmxlU0hBMjU2IiwiczNBY2NlbGVyYXRlRW5kcG9pbnQiLCJyZXFPcHRpb25zIiwiY2xpZW50RXh0ZW5zaW9ucyIsIkV4dGVuc2lvbnMiLCJleHRlbnNpb25zIiwic2V0UzNUcmFuc2ZlckFjY2VsZXJhdGUiLCJzZXRSZXF1ZXN0T3B0aW9ucyIsIm9wdGlvbnMiLCJUeXBlRXJyb3IiLCJfIiwicGljayIsImdldEFjY2VsZXJhdGVFbmRQb2ludElmU2V0IiwiYnVja2V0TmFtZSIsIm9iamVjdE5hbWUiLCJpc0VtcHR5IiwiaW5jbHVkZXMiLCJnZXRSZXF1ZXN0T3B0aW9ucyIsIm9wdHMiLCJtZXRob2QiLCJoZWFkZXJzIiwicXVlcnkiLCJhZ2VudCIsInZpcnR1YWxIb3N0U3R5bGUiLCJpc1ZpcnR1YWxIb3N0U3R5bGUiLCJ1cmlSZXNvdXJjZUVzY2FwZSIsImlzQW1hem9uRW5kcG9pbnQiLCJhY2NlbGVyYXRlRW5kUG9pbnQiLCJnZXRTM0VuZHBvaW50Iiwiam9pbkhvc3RQb3J0IiwiayIsInYiLCJlbnRyaWVzIiwiYXNzaWduIiwibWFwVmFsdWVzIiwicGlja0J5IiwiaXNEZWZpbmVkIiwidG9TdHJpbmciLCJzZXRDcmVkZW50aWFsc1Byb3ZpZGVyIiwiQ3JlZGVudGlhbFByb3ZpZGVyIiwiY2hlY2tBbmRSZWZyZXNoQ3JlZHMiLCJjcmVkZW50aWFsc0NvbmYiLCJnZXRDcmVkZW50aWFscyIsImdldEFjY2Vzc0tleSIsImdldFNlY3JldEtleSIsImdldFNlc3Npb25Ub2tlbiIsImUiLCJjYXVzZSIsImxvZ0hUVFAiLCJyZXNwb25zZSIsImVyciIsImxvZ1N0cmVhbSIsImlzUmVhZGFibGVTdHJlYW0iLCJsb2dIZWFkZXJzIiwiZm9yRWFjaCIsInJlZGFjdG9yIiwiUmVnRXhwIiwicmVwbGFjZSIsIndyaXRlIiwic3RhdHVzQ29kZSIsImVyckpTT04iLCJKU09OIiwic3RyaW5naWZ5IiwidHJhY2VPbiIsInN0ZG91dCIsInRyYWNlT2ZmIiwibWFrZVJlcXVlc3RBc3luYyIsInBheWxvYWQiLCJleHBlY3RlZENvZGVzIiwiaXNOdW1iZXIiLCJsZW5ndGgiLCJzaGEyNTZzdW0iLCJ0b1NoYTI1NiIsIm1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMiLCJtYWtlUmVxdWVzdEFzeW5jT21pdCIsInN0YXR1c0NvZGVzIiwicmVzIiwiZHJhaW5SZXNwb25zZSIsImJvZHkiLCJCdWZmZXIiLCJpc0J1ZmZlciIsImdldEJ1Y2tldFJlZ2lvbkFzeW5jIiwiZGF0ZSIsIkRhdGUiLCJtYWtlRGF0ZUxvbmciLCJhdXRob3JpemF0aW9uIiwic2lnblY0IiwicmVxdWVzdCIsInBhcnNlUmVzcG9uc2VFcnJvciIsImlzVmFsaWRCdWNrZXROYW1lIiwiSW52YWxpZEJ1Y2tldE5hbWVFcnJvciIsImNhY2hlZCIsImV4dHJhY3RSZWdpb25Bc3luYyIsInJlYWRBc1N0cmluZyIsInBhcnNlQnVja2V0UmVnaW9uIiwiREVGQVVMVF9SRUdJT04iLCJpc0Jyb3dzZXIiLCJuYW1lIiwiUmVnaW9uIiwibWFrZVJlcXVlc3QiLCJyZXR1cm5SZXNwb25zZSIsImNiIiwicHJvbSIsInRoZW4iLCJyZXN1bHQiLCJtYWtlUmVxdWVzdFN0cmVhbSIsImV4ZWN1dG9yIiwiZ2V0QnVja2V0UmVnaW9uIiwibWFrZUJ1Y2tldCIsIm1ha2VPcHRzIiwiYnVpbGRPYmplY3QiLCJDcmVhdGVCdWNrZXRDb25maWd1cmF0aW9uIiwiJCIsInhtbG5zIiwiTG9jYXRpb25Db25zdHJhaW50IiwiT2JqZWN0TG9ja2luZyIsImZpbmFsUmVnaW9uIiwicmVxdWVzdE9wdCIsIlMzRXJyb3IiLCJlcnJDb2RlIiwiY29kZSIsImVyclJlZ2lvbiIsImJ1Y2tldEV4aXN0cyIsInJlbW92ZUJ1Y2tldCIsImdldE9iamVjdCIsImdldE9wdHMiLCJpc1ZhbGlkT2JqZWN0TmFtZSIsIkludmFsaWRPYmplY3ROYW1lRXJyb3IiLCJnZXRQYXJ0aWFsT2JqZWN0Iiwib2Zmc2V0IiwicmFuZ2UiLCJleHBlY3RlZFN0YXR1c0NvZGVzIiwicHVzaCIsImZHZXRPYmplY3QiLCJmaWxlUGF0aCIsImRvd25sb2FkVG9UbXBGaWxlIiwicGFydEZpbGVTdHJlYW0iLCJvYmpTdGF0Iiwic3RhdE9iamVjdCIsInBhcnRGaWxlIiwiZXRhZyIsImZzcCIsIm1rZGlyIiwiZGlybmFtZSIsInJlY3Vyc2l2ZSIsInN0YXRzIiwic3RhdCIsInNpemUiLCJjcmVhdGVXcml0ZVN0cmVhbSIsImZsYWdzIiwiZG93bmxvYWRTdHJlYW0iLCJzdHJlYW1Qcm9taXNlIiwicGlwZWxpbmUiLCJyZW5hbWUiLCJzdGF0T3B0cyIsInBhcnNlSW50IiwibWV0YURhdGEiLCJleHRyYWN0TWV0YWRhdGEiLCJsYXN0TW9kaWZpZWQiLCJ2ZXJzaW9uSWQiLCJnZXRWZXJzaW9uSWQiLCJzYW5pdGl6ZUVUYWciLCJyZW1vdmVPYmplY3QiLCJyZW1vdmVPcHRzIiwiZ292ZXJuYW5jZUJ5cGFzcyIsImZvcmNlRGVsZXRlIiwicXVlcnlQYXJhbXMiLCJsaXN0SW5jb21wbGV0ZVVwbG9hZHMiLCJidWNrZXQiLCJwcmVmaXgiLCJpc1ZhbGlkUHJlZml4IiwiSW52YWxpZFByZWZpeEVycm9yIiwiZGVsaW1pdGVyIiwia2V5TWFya2VyIiwidXBsb2FkSWRNYXJrZXIiLCJ1cGxvYWRzIiwiZW5kZWQiLCJyZWFkU3RyZWFtIiwiUmVhZGFibGUiLCJvYmplY3RNb2RlIiwiX3JlYWQiLCJzaGlmdCIsImxpc3RJbmNvbXBsZXRlVXBsb2Fkc1F1ZXJ5IiwicHJlZml4ZXMiLCJlYWNoU2VyaWVzIiwidXBsb2FkIiwibGlzdFBhcnRzIiwidXBsb2FkSWQiLCJwYXJ0cyIsInJlZHVjZSIsImFjYyIsIml0ZW0iLCJlbWl0IiwiaXNUcnVuY2F0ZWQiLCJuZXh0S2V5TWFya2VyIiwibmV4dFVwbG9hZElkTWFya2VyIiwicXVlcmllcyIsInVyaUVzY2FwZSIsIm1heFVwbG9hZHMiLCJzb3J0IiwidW5zaGlmdCIsImpvaW4iLCJwYXJzZUxpc3RNdWx0aXBhcnQiLCJpbml0aWF0ZU5ld011bHRpcGFydFVwbG9hZCIsInJlYWRBc0J1ZmZlciIsInBhcnNlSW5pdGlhdGVNdWx0aXBhcnQiLCJhYm9ydE11bHRpcGFydFVwbG9hZCIsInJlcXVlc3RPcHRpb25zIiwiZmluZFVwbG9hZElkIiwiX2xhdGVzdFVwbG9hZCIsImxhdGVzdFVwbG9hZCIsImluaXRpYXRlZCIsImdldFRpbWUiLCJjb21wbGV0ZU11bHRpcGFydFVwbG9hZCIsImV0YWdzIiwiYnVpbGRlciIsIkNvbXBsZXRlTXVsdGlwYXJ0VXBsb2FkIiwiUGFydCIsIm1hcCIsIlBhcnROdW1iZXIiLCJwYXJ0IiwiRVRhZyIsInBhcnNlQ29tcGxldGVNdWx0aXBhcnQiLCJlcnJNZXNzYWdlIiwibWFya2VyIiwibGlzdFBhcnRzUXVlcnkiLCJwYXJzZUxpc3RQYXJ0cyIsImxpc3RCdWNrZXRzIiwiaHR0cFJlcyIsInhtbFJlc3VsdCIsInBhcnNlTGlzdEJ1Y2tldCIsImNhbGN1bGF0ZVBhcnRTaXplIiwiZlB1dE9iamVjdCIsImluc2VydENvbnRlbnRUeXBlIiwibHN0YXQiLCJwdXRPYmplY3QiLCJjcmVhdGVSZWFkU3RyZWFtIiwicHJlcGVuZFhBTVpNZXRhIiwicmVhZGFibGVTdHJlYW0iLCJzdGF0U2l6ZSIsImdldENvbnRlbnRMZW5ndGgiLCJidWYiLCJmcm9tIiwidXBsb2FkQnVmZmVyIiwidXBsb2FkU3RyZWFtIiwibWQ1c3VtIiwiaGFzaEJpbmFyeSIsIm9sZFBhcnRzIiwiZVRhZ3MiLCJwcmV2aW91c1VwbG9hZElkIiwib2xkVGFncyIsImNodW5raWVyIiwiQmxvY2tTdHJlYW0yIiwiemVyb1BhZGRpbmciLCJvIiwiUHJvbWlzZSIsImFsbCIsInJlc29sdmUiLCJyZWplY3QiLCJwaXBlIiwib24iLCJwYXJ0TnVtYmVyIiwiY2h1bmsiLCJtZDUiLCJjcmVhdGVIYXNoIiwidXBkYXRlIiwiZGlnZXN0Iiwib2xkUGFydCIsInJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uIiwic2V0QnVja2V0UmVwbGljYXRpb24iLCJyZXBsaWNhdGlvbkNvbmZpZyIsInJvbGUiLCJydWxlcyIsInJlcGxpY2F0aW9uUGFyYW1zQ29uZmlnIiwiUmVwbGljYXRpb25Db25maWd1cmF0aW9uIiwiUm9sZSIsIlJ1bGUiLCJ0b01kNSIsImdldEJ1Y2tldFJlcGxpY2F0aW9uIiwicGFyc2VSZXBsaWNhdGlvbkNvbmZpZyIsImdldE9iamVjdExlZ2FsSG9sZCIsImtleXMiLCJzdHJSZXMiLCJwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyIsInNldE9iamVjdExlZ2FsSG9sZCIsInNldE9wdHMiLCJzdGF0dXMiLCJMRUdBTF9IT0xEX1NUQVRVUyIsIkVOQUJMRUQiLCJESVNBQkxFRCIsImNvbmZpZyIsIlN0YXR1cyIsInJvb3ROYW1lIiwiZ2V0QnVja2V0VGFnZ2luZyIsInBhcnNlVGFnZ2luZyIsImdldE9iamVjdFRhZ2dpbmciLCJzZXRCdWNrZXRQb2xpY3kiLCJwb2xpY3kiLCJJbnZhbGlkQnVja2V0UG9saWN5RXJyb3IiLCJnZXRCdWNrZXRQb2xpY3kiLCJwdXRPYmplY3RSZXRlbnRpb24iLCJyZXRlbnRpb25PcHRzIiwibW9kZSIsIlJFVEVOVElPTl9NT0RFUyIsIkNPTVBMSUFOQ0UiLCJHT1ZFUk5BTkNFIiwicmV0YWluVW50aWxEYXRlIiwiTW9kZSIsIlJldGFpblVudGlsRGF0ZSIsImdldE9iamVjdExvY2tDb25maWciLCJwYXJzZU9iamVjdExvY2tDb25maWciLCJzZXRPYmplY3RMb2NrQ29uZmlnIiwibG9ja0NvbmZpZ09wdHMiLCJyZXRlbnRpb25Nb2RlcyIsInZhbGlkVW5pdHMiLCJSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMiLCJEQVlTIiwiWUVBUlMiLCJ1bml0IiwidmFsaWRpdHkiLCJPYmplY3RMb2NrRW5hYmxlZCIsImNvbmZpZ0tleXMiLCJpc0FsbEtleXNTZXQiLCJldmVyeSIsImxjayIsIkRlZmF1bHRSZXRlbnRpb24iLCJEYXlzIiwiWWVhcnMiLCJnZXRCdWNrZXRWZXJzaW9uaW5nIiwicGFyc2VCdWNrZXRWZXJzaW9uaW5nQ29uZmlnIiwic2V0QnVja2V0VmVyc2lvbmluZyIsInZlcnNpb25Db25maWciLCJzZXRUYWdnaW5nIiwidGFnZ2luZ1BhcmFtcyIsInRhZ3MiLCJwdXRPcHRzIiwidGFnc0xpc3QiLCJ2YWx1ZSIsIktleSIsIlZhbHVlIiwidGFnZ2luZ0NvbmZpZyIsIlRhZ2dpbmciLCJUYWdTZXQiLCJUYWciLCJwYXlsb2FkQnVmIiwicmVtb3ZlVGFnZ2luZyIsInNldEJ1Y2tldFRhZ2dpbmciLCJyZW1vdmVCdWNrZXRUYWdnaW5nIiwic2V0T2JqZWN0VGFnZ2luZyIsInJlbW92ZU9iamVjdFRhZ2dpbmciLCJzZWxlY3RPYmplY3RDb250ZW50Iiwic2VsZWN0T3B0cyIsImV4cHJlc3Npb24iLCJpbnB1dFNlcmlhbGl6YXRpb24iLCJvdXRwdXRTZXJpYWxpemF0aW9uIiwiRXhwcmVzc2lvbiIsIkV4cHJlc3Npb25UeXBlIiwiZXhwcmVzc2lvblR5cGUiLCJJbnB1dFNlcmlhbGl6YXRpb24iLCJPdXRwdXRTZXJpYWxpemF0aW9uIiwicmVxdWVzdFByb2dyZXNzIiwiUmVxdWVzdFByb2dyZXNzIiwic2NhblJhbmdlIiwiU2NhblJhbmdlIiwicGFyc2VTZWxlY3RPYmplY3RDb250ZW50UmVzcG9uc2UiLCJhcHBseUJ1Y2tldExpZmVjeWNsZSIsInBvbGljeUNvbmZpZyIsInJlbW92ZUJ1Y2tldExpZmVjeWNsZSIsInNldEJ1Y2tldExpZmVjeWNsZSIsImxpZmVDeWNsZUNvbmZpZyIsImdldEJ1Y2tldExpZmVjeWNsZSIsInBhcnNlTGlmZWN5Y2xlQ29uZmlnIiwic2V0QnVja2V0RW5jcnlwdGlvbiIsImVuY3J5cHRpb25Db25maWciLCJlbmNyeXB0aW9uT2JqIiwiQXBwbHlTZXJ2ZXJTaWRlRW5jcnlwdGlvbkJ5RGVmYXVsdCIsIlNTRUFsZ29yaXRobSIsImdldEJ1Y2tldEVuY3J5cHRpb24iLCJwYXJzZUJ1Y2tldEVuY3J5cHRpb25Db25maWciLCJyZW1vdmVCdWNrZXRFbmNyeXB0aW9uIiwiZXhwb3J0cyJdLCJzb3VyY2VzIjpbImNsaWVudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnbm9kZTpjcnlwdG8nXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdub2RlOmZzJ1xuaW1wb3J0ICogYXMgaHR0cCBmcm9tICdub2RlOmh0dHAnXG5pbXBvcnQgKiBhcyBodHRwcyBmcm9tICdub2RlOmh0dHBzJ1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdub2RlOnBhdGgnXG5pbXBvcnQgKiBhcyBzdHJlYW0gZnJvbSAnbm9kZTpzdHJlYW0nXG5cbmltcG9ydCAqIGFzIGFzeW5jIGZyb20gJ2FzeW5jJ1xuaW1wb3J0IEJsb2NrU3RyZWFtMiBmcm9tICdibG9jay1zdHJlYW0yJ1xuaW1wb3J0IHsgaXNCcm93c2VyIH0gZnJvbSAnYnJvd3Nlci1vci1ub2RlJ1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJ1xuaW1wb3J0ICogYXMgcXMgZnJvbSAncXVlcnktc3RyaW5nJ1xuaW1wb3J0IHhtbDJqcyBmcm9tICd4bWwyanMnXG5cbmltcG9ydCB7IENyZWRlbnRpYWxQcm92aWRlciB9IGZyb20gJy4uL0NyZWRlbnRpYWxQcm92aWRlci50cydcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi9lcnJvcnMudHMnXG5pbXBvcnQgdHlwZSB7IFNlbGVjdFJlc3VsdHMgfSBmcm9tICcuLi9oZWxwZXJzLnRzJ1xuaW1wb3J0IHsgREVGQVVMVF9SRUdJT04sIExFR0FMX0hPTERfU1RBVFVTLCBSRVRFTlRJT05fTU9ERVMsIFJFVEVOVElPTl9WQUxJRElUWV9VTklUUyB9IGZyb20gJy4uL2hlbHBlcnMudHMnXG5pbXBvcnQgeyBzaWduVjQgfSBmcm9tICcuLi9zaWduaW5nLnRzJ1xuaW1wb3J0IHsgZnNwLCBzdHJlYW1Qcm9taXNlIH0gZnJvbSAnLi9hc3luYy50cydcbmltcG9ydCB7IEV4dGVuc2lvbnMgfSBmcm9tICcuL2V4dGVuc2lvbnMudHMnXG5pbXBvcnQge1xuICBleHRyYWN0TWV0YWRhdGEsXG4gIGdldENvbnRlbnRMZW5ndGgsXG4gIGdldFZlcnNpb25JZCxcbiAgaGFzaEJpbmFyeSxcbiAgaW5zZXJ0Q29udGVudFR5cGUsXG4gIGlzQW1hem9uRW5kcG9pbnQsXG4gIGlzQm9vbGVhbixcbiAgaXNEZWZpbmVkLFxuICBpc0VtcHR5LFxuICBpc051bWJlcixcbiAgaXNPYmplY3QsXG4gIGlzUmVhZGFibGVTdHJlYW0sXG4gIGlzU3RyaW5nLFxuICBpc1ZhbGlkQnVja2V0TmFtZSxcbiAgaXNWYWxpZEVuZHBvaW50LFxuICBpc1ZhbGlkT2JqZWN0TmFtZSxcbiAgaXNWYWxpZFBvcnQsXG4gIGlzVmFsaWRQcmVmaXgsXG4gIGlzVmlydHVhbEhvc3RTdHlsZSxcbiAgbWFrZURhdGVMb25nLFxuICBwcmVwZW5kWEFNWk1ldGEsXG4gIHJlYWRhYmxlU3RyZWFtLFxuICBzYW5pdGl6ZUVUYWcsXG4gIHRvTWQ1LFxuICB0b1NoYTI1NixcbiAgdXJpRXNjYXBlLFxuICB1cmlSZXNvdXJjZUVzY2FwZSxcbn0gZnJvbSAnLi9oZWxwZXIudHMnXG5pbXBvcnQgeyBqb2luSG9zdFBvcnQgfSBmcm9tICcuL2pvaW4taG9zdC1wb3J0LnRzJ1xuaW1wb3J0IHsgcmVxdWVzdCB9IGZyb20gJy4vcmVxdWVzdC50cydcbmltcG9ydCB7IGRyYWluUmVzcG9uc2UsIHJlYWRBc0J1ZmZlciwgcmVhZEFzU3RyaW5nIH0gZnJvbSAnLi9yZXNwb25zZS50cydcbmltcG9ydCB0eXBlIHsgUmVnaW9uIH0gZnJvbSAnLi9zMy1lbmRwb2ludHMudHMnXG5pbXBvcnQgeyBnZXRTM0VuZHBvaW50IH0gZnJvbSAnLi9zMy1lbmRwb2ludHMudHMnXG5pbXBvcnQgdHlwZSB7XG4gIEJpbmFyeSxcbiAgQnVja2V0SXRlbUZyb21MaXN0LFxuICBCdWNrZXRJdGVtU3RhdCxcbiAgQnVja2V0U3RyZWFtLFxuICBCdWNrZXRWZXJzaW9uaW5nQ29uZmlndXJhdGlvbixcbiAgRW5jcnlwdGlvbkNvbmZpZyxcbiAgR2V0T2JqZWN0TGVnYWxIb2xkT3B0aW9ucyxcbiAgSW5jb21wbGV0ZVVwbG9hZGVkQnVja2V0SXRlbSxcbiAgSVJlcXVlc3QsXG4gIEl0ZW1CdWNrZXRNZXRhZGF0YSxcbiAgTGlmZWN5Y2xlQ29uZmlnLFxuICBMaWZlQ3ljbGVDb25maWdQYXJhbSxcbiAgT2JqZWN0TG9ja0NvbmZpZ1BhcmFtLFxuICBPYmplY3RMb2NrSW5mbyxcbiAgT2JqZWN0TWV0YURhdGEsXG4gIFB1dE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gIFB1dFRhZ2dpbmdQYXJhbXMsXG4gIFJlbW92ZVRhZ2dpbmdQYXJhbXMsXG4gIFJlcGxpY2F0aW9uQ29uZmlnLFxuICBSZXBsaWNhdGlvbkNvbmZpZ09wdHMsXG4gIFJlcXVlc3RIZWFkZXJzLFxuICBSZXNwb25zZUhlYWRlcixcbiAgUmVzdWx0Q2FsbGJhY2ssXG4gIFJldGVudGlvbixcbiAgU2VsZWN0T3B0aW9ucyxcbiAgU3RhdE9iamVjdE9wdHMsXG4gIFRhZyxcbiAgVGFnZ2luZ09wdHMsXG4gIFRhZ3MsXG4gIFRyYW5zcG9ydCxcbiAgVXBsb2FkZWRPYmplY3RJbmZvLFxuICBWZXJzaW9uSWRlbnRpZmljYXRvcixcbn0gZnJvbSAnLi90eXBlLnRzJ1xuaW1wb3J0IHR5cGUgeyBMaXN0TXVsdGlwYXJ0UmVzdWx0LCBVcGxvYWRlZFBhcnQgfSBmcm9tICcuL3htbC1wYXJzZXIudHMnXG5pbXBvcnQge1xuICBwYXJzZUNvbXBsZXRlTXVsdGlwYXJ0LFxuICBwYXJzZUluaXRpYXRlTXVsdGlwYXJ0LFxuICBwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyxcbiAgcGFyc2VTZWxlY3RPYmplY3RDb250ZW50UmVzcG9uc2UsXG59IGZyb20gJy4veG1sLXBhcnNlci50cydcbmltcG9ydCAqIGFzIHhtbFBhcnNlcnMgZnJvbSAnLi94bWwtcGFyc2VyLnRzJ1xuXG5jb25zdCB4bWwgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSwgaGVhZGxlc3M6IHRydWUgfSlcblxuLy8gd2lsbCBiZSByZXBsYWNlZCBieSBidW5kbGVyLlxuY29uc3QgUGFja2FnZSA9IHsgdmVyc2lvbjogcHJvY2Vzcy5lbnYuTUlOSU9fSlNfUEFDS0FHRV9WRVJTSU9OIHx8ICdkZXZlbG9wbWVudCcgfVxuXG5jb25zdCByZXF1ZXN0T3B0aW9uUHJvcGVydGllcyA9IFtcbiAgJ2FnZW50JyxcbiAgJ2NhJyxcbiAgJ2NlcnQnLFxuICAnY2lwaGVycycsXG4gICdjbGllbnRDZXJ0RW5naW5lJyxcbiAgJ2NybCcsXG4gICdkaHBhcmFtJyxcbiAgJ2VjZGhDdXJ2ZScsXG4gICdmYW1pbHknLFxuICAnaG9ub3JDaXBoZXJPcmRlcicsXG4gICdrZXknLFxuICAncGFzc3BocmFzZScsXG4gICdwZngnLFxuICAncmVqZWN0VW5hdXRob3JpemVkJyxcbiAgJ3NlY3VyZU9wdGlvbnMnLFxuICAnc2VjdXJlUHJvdG9jb2wnLFxuICAnc2VydmVybmFtZScsXG4gICdzZXNzaW9uSWRDb250ZXh0Jyxcbl0gYXMgY29uc3RcblxuZXhwb3J0IGludGVyZmFjZSBDbGllbnRPcHRpb25zIHtcbiAgZW5kUG9pbnQ6IHN0cmluZ1xuICBhY2Nlc3NLZXk6IHN0cmluZ1xuICBzZWNyZXRLZXk6IHN0cmluZ1xuICB1c2VTU0w/OiBib29sZWFuXG4gIHBvcnQ/OiBudW1iZXJcbiAgcmVnaW9uPzogUmVnaW9uXG4gIHRyYW5zcG9ydD86IFRyYW5zcG9ydFxuICBzZXNzaW9uVG9rZW4/OiBzdHJpbmdcbiAgcGFydFNpemU/OiBudW1iZXJcbiAgcGF0aFN0eWxlPzogYm9vbGVhblxuICBjcmVkZW50aWFsc1Byb3ZpZGVyPzogQ3JlZGVudGlhbFByb3ZpZGVyXG4gIHMzQWNjZWxlcmF0ZUVuZHBvaW50Pzogc3RyaW5nXG4gIHRyYW5zcG9ydEFnZW50PzogaHR0cC5BZ2VudFxufVxuXG5leHBvcnQgdHlwZSBSZXF1ZXN0T3B0aW9uID0gUGFydGlhbDxJUmVxdWVzdD4gJiB7XG4gIG1ldGhvZDogc3RyaW5nXG4gIGJ1Y2tldE5hbWU/OiBzdHJpbmdcbiAgb2JqZWN0TmFtZT86IHN0cmluZ1xuICBxdWVyeT86IHN0cmluZ1xuICBwYXRoU3R5bGU/OiBib29sZWFuXG59XG5cbmV4cG9ydCB0eXBlIE5vUmVzdWx0Q2FsbGJhY2sgPSAoZXJyb3I6IHVua25vd24pID0+IHZvaWRcblxuZXhwb3J0IGludGVyZmFjZSBNYWtlQnVja2V0T3B0IHtcbiAgT2JqZWN0TG9ja2luZz86IGJvb2xlYW5cbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZW1vdmVPcHRpb25zIHtcbiAgdmVyc2lvbklkPzogc3RyaW5nXG4gIGdvdmVybmFuY2VCeXBhc3M/OiBib29sZWFuXG4gIGZvcmNlRGVsZXRlPzogYm9vbGVhblxufVxuXG50eXBlIFBhcnQgPSB7XG4gIHBhcnQ6IG51bWJlclxuICBldGFnOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNsYXNzIFR5cGVkQ2xpZW50IHtcbiAgcHJvdGVjdGVkIHRyYW5zcG9ydDogVHJhbnNwb3J0XG4gIHByb3RlY3RlZCBob3N0OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHBvcnQ6IG51bWJlclxuICBwcm90ZWN0ZWQgcHJvdG9jb2w6IHN0cmluZ1xuICBwcm90ZWN0ZWQgYWNjZXNzS2V5OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHNlY3JldEtleTogc3RyaW5nXG4gIHByb3RlY3RlZCBzZXNzaW9uVG9rZW4/OiBzdHJpbmdcbiAgcHJvdGVjdGVkIHVzZXJBZ2VudDogc3RyaW5nXG4gIHByb3RlY3RlZCBhbm9ueW1vdXM6IGJvb2xlYW5cbiAgcHJvdGVjdGVkIHBhdGhTdHlsZTogYm9vbGVhblxuICBwcm90ZWN0ZWQgcmVnaW9uTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gIHB1YmxpYyByZWdpb24/OiBzdHJpbmdcbiAgcHJvdGVjdGVkIGNyZWRlbnRpYWxzUHJvdmlkZXI/OiBDcmVkZW50aWFsUHJvdmlkZXJcbiAgcGFydFNpemU6IG51bWJlciA9IDY0ICogMTAyNCAqIDEwMjRcbiAgcHJvdGVjdGVkIG92ZXJSaWRlUGFydFNpemU/OiBib29sZWFuXG5cbiAgcHJvdGVjdGVkIG1heGltdW1QYXJ0U2l6ZSA9IDUgKiAxMDI0ICogMTAyNCAqIDEwMjRcbiAgcHJvdGVjdGVkIG1heE9iamVjdFNpemUgPSA1ICogMTAyNCAqIDEwMjQgKiAxMDI0ICogMTAyNFxuICBwdWJsaWMgZW5hYmxlU0hBMjU2OiBib29sZWFuXG4gIHByb3RlY3RlZCBzM0FjY2VsZXJhdGVFbmRwb2ludD86IHN0cmluZ1xuICBwcm90ZWN0ZWQgcmVxT3B0aW9uczogUmVjb3JkPHN0cmluZywgdW5rbm93bj5cblxuICBwcm90ZWN0ZWQgdHJhbnNwb3J0QWdlbnQ6IGh0dHAuQWdlbnRcbiAgcHJpdmF0ZSByZWFkb25seSBjbGllbnRFeHRlbnNpb25zOiBFeHRlbnNpb25zXG5cbiAgY29uc3RydWN0b3IocGFyYW1zOiBDbGllbnRPcHRpb25zKSB7XG4gICAgLy8gQHRzLWV4cGVjdC1lcnJvciBkZXByZWNhdGVkIHByb3BlcnR5XG4gICAgaWYgKHBhcmFtcy5zZWN1cmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdcInNlY3VyZVwiIG9wdGlvbiBkZXByZWNhdGVkLCBcInVzZVNTTFwiIHNob3VsZCBiZSB1c2VkIGluc3RlYWQnKVxuICAgIH1cbiAgICAvLyBEZWZhdWx0IHZhbHVlcyBpZiBub3Qgc3BlY2lmaWVkLlxuICAgIGlmIChwYXJhbXMudXNlU1NMID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmFtcy51c2VTU0wgPSB0cnVlXG4gICAgfVxuICAgIGlmICghcGFyYW1zLnBvcnQpIHtcbiAgICAgIHBhcmFtcy5wb3J0ID0gMFxuICAgIH1cbiAgICAvLyBWYWxpZGF0ZSBpbnB1dCBwYXJhbXMuXG4gICAgaWYgKCFpc1ZhbGlkRW5kcG9pbnQocGFyYW1zLmVuZFBvaW50KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkRW5kcG9pbnRFcnJvcihgSW52YWxpZCBlbmRQb2ludCA6ICR7cGFyYW1zLmVuZFBvaW50fWApXG4gICAgfVxuICAgIGlmICghaXNWYWxpZFBvcnQocGFyYW1zLnBvcnQpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHBvcnQgOiAke3BhcmFtcy5wb3J0fWApXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHBhcmFtcy51c2VTU0wpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKFxuICAgICAgICBgSW52YWxpZCB1c2VTU0wgZmxhZyB0eXBlIDogJHtwYXJhbXMudXNlU1NMfSwgZXhwZWN0ZWQgdG8gYmUgb2YgdHlwZSBcImJvb2xlYW5cImAsXG4gICAgICApXG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgcmVnaW9uIG9ubHkgaWYgaXRzIHNldC5cbiAgICBpZiAocGFyYW1zLnJlZ2lvbikge1xuICAgICAgaWYgKCFpc1N0cmluZyhwYXJhbXMucmVnaW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHJlZ2lvbiA6ICR7cGFyYW1zLnJlZ2lvbn1gKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGhvc3QgPSBwYXJhbXMuZW5kUG9pbnQudG9Mb3dlckNhc2UoKVxuICAgIGxldCBwb3J0ID0gcGFyYW1zLnBvcnRcbiAgICBsZXQgcHJvdG9jb2w6IHN0cmluZ1xuICAgIGxldCB0cmFuc3BvcnRcbiAgICBsZXQgdHJhbnNwb3J0QWdlbnQ6IGh0dHAuQWdlbnRcbiAgICAvLyBWYWxpZGF0ZSBpZiBjb25maWd1cmF0aW9uIGlzIG5vdCB1c2luZyBTU0xcbiAgICAvLyBmb3IgY29uc3RydWN0aW5nIHJlbGV2YW50IGVuZHBvaW50cy5cbiAgICBpZiAocGFyYW1zLnVzZVNTTCkge1xuICAgICAgLy8gRGVmYXVsdHMgdG8gc2VjdXJlLlxuICAgICAgdHJhbnNwb3J0ID0gaHR0cHNcbiAgICAgIHByb3RvY29sID0gJ2h0dHBzOidcbiAgICAgIHBvcnQgPSBwb3J0IHx8IDQ0M1xuICAgICAgdHJhbnNwb3J0QWdlbnQgPSBodHRwcy5nbG9iYWxBZ2VudFxuICAgIH0gZWxzZSB7XG4gICAgICB0cmFuc3BvcnQgPSBodHRwXG4gICAgICBwcm90b2NvbCA9ICdodHRwOidcbiAgICAgIHBvcnQgPSBwb3J0IHx8IDgwXG4gICAgICB0cmFuc3BvcnRBZ2VudCA9IGh0dHAuZ2xvYmFsQWdlbnRcbiAgICB9XG5cbiAgICAvLyBpZiBjdXN0b20gdHJhbnNwb3J0IGlzIHNldCwgdXNlIGl0LlxuICAgIGlmIChwYXJhbXMudHJhbnNwb3J0KSB7XG4gICAgICBpZiAoIWlzT2JqZWN0KHBhcmFtcy50cmFuc3BvcnQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoXG4gICAgICAgICAgYEludmFsaWQgdHJhbnNwb3J0IHR5cGUgOiAke3BhcmFtcy50cmFuc3BvcnR9LCBleHBlY3RlZCB0byBiZSB0eXBlIFwib2JqZWN0XCJgLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICB0cmFuc3BvcnQgPSBwYXJhbXMudHJhbnNwb3J0XG4gICAgfVxuXG4gICAgLy8gaWYgY3VzdG9tIHRyYW5zcG9ydCBhZ2VudCBpcyBzZXQsIHVzZSBpdC5cbiAgICBpZiAocGFyYW1zLnRyYW5zcG9ydEFnZW50KSB7XG4gICAgICBpZiAoIWlzT2JqZWN0KHBhcmFtcy50cmFuc3BvcnRBZ2VudCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgICBgSW52YWxpZCB0cmFuc3BvcnRBZ2VudCB0eXBlOiAke3BhcmFtcy50cmFuc3BvcnRBZ2VudH0sIGV4cGVjdGVkIHRvIGJlIHR5cGUgXCJvYmplY3RcImAsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgdHJhbnNwb3J0QWdlbnQgPSBwYXJhbXMudHJhbnNwb3J0QWdlbnRcbiAgICB9XG5cbiAgICAvLyBVc2VyIEFnZW50IHNob3VsZCBhbHdheXMgZm9sbG93aW5nIHRoZSBiZWxvdyBzdHlsZS5cbiAgICAvLyBQbGVhc2Ugb3BlbiBhbiBpc3N1ZSB0byBkaXNjdXNzIGFueSBuZXcgY2hhbmdlcyBoZXJlLlxuICAgIC8vXG4gICAgLy8gICAgICAgTWluSU8gKE9TOyBBUkNIKSBMSUIvVkVSIEFQUC9WRVJcbiAgICAvL1xuICAgIGNvbnN0IGxpYnJhcnlDb21tZW50cyA9IGAoJHtwcm9jZXNzLnBsYXRmb3JtfTsgJHtwcm9jZXNzLmFyY2h9KWBcbiAgICBjb25zdCBsaWJyYXJ5QWdlbnQgPSBgTWluSU8gJHtsaWJyYXJ5Q29tbWVudHN9IG1pbmlvLWpzLyR7UGFja2FnZS52ZXJzaW9ufWBcbiAgICAvLyBVc2VyIGFnZW50IGJsb2NrIGVuZHMuXG5cbiAgICB0aGlzLnRyYW5zcG9ydCA9IHRyYW5zcG9ydFxuICAgIHRoaXMudHJhbnNwb3J0QWdlbnQgPSB0cmFuc3BvcnRBZ2VudFxuICAgIHRoaXMuaG9zdCA9IGhvc3RcbiAgICB0aGlzLnBvcnQgPSBwb3J0XG4gICAgdGhpcy5wcm90b2NvbCA9IHByb3RvY29sXG4gICAgdGhpcy51c2VyQWdlbnQgPSBgJHtsaWJyYXJ5QWdlbnR9YFxuXG4gICAgLy8gRGVmYXVsdCBwYXRoIHN0eWxlIGlzIHRydWVcbiAgICBpZiAocGFyYW1zLnBhdGhTdHlsZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnBhdGhTdHlsZSA9IHRydWVcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wYXRoU3R5bGUgPSBwYXJhbXMucGF0aFN0eWxlXG4gICAgfVxuXG4gICAgdGhpcy5hY2Nlc3NLZXkgPSBwYXJhbXMuYWNjZXNzS2V5ID8/ICcnXG4gICAgdGhpcy5zZWNyZXRLZXkgPSBwYXJhbXMuc2VjcmV0S2V5ID8/ICcnXG4gICAgdGhpcy5zZXNzaW9uVG9rZW4gPSBwYXJhbXMuc2Vzc2lvblRva2VuXG4gICAgdGhpcy5hbm9ueW1vdXMgPSAhdGhpcy5hY2Nlc3NLZXkgfHwgIXRoaXMuc2VjcmV0S2V5XG5cbiAgICBpZiAocGFyYW1zLmNyZWRlbnRpYWxzUHJvdmlkZXIpIHtcbiAgICAgIHRoaXMuY3JlZGVudGlhbHNQcm92aWRlciA9IHBhcmFtcy5jcmVkZW50aWFsc1Byb3ZpZGVyXG4gICAgfVxuXG4gICAgdGhpcy5yZWdpb25NYXAgPSB7fVxuICAgIGlmIChwYXJhbXMucmVnaW9uKSB7XG4gICAgICB0aGlzLnJlZ2lvbiA9IHBhcmFtcy5yZWdpb25cbiAgICB9XG5cbiAgICBpZiAocGFyYW1zLnBhcnRTaXplKSB7XG4gICAgICB0aGlzLnBhcnRTaXplID0gcGFyYW1zLnBhcnRTaXplXG4gICAgICB0aGlzLm92ZXJSaWRlUGFydFNpemUgPSB0cnVlXG4gICAgfVxuICAgIGlmICh0aGlzLnBhcnRTaXplIDwgNSAqIDEwMjQgKiAxMDI0KSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBQYXJ0IHNpemUgc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiA1TUJgKVxuICAgIH1cbiAgICBpZiAodGhpcy5wYXJ0U2l6ZSA+IDUgKiAxMDI0ICogMTAyNCAqIDEwMjQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYFBhcnQgc2l6ZSBzaG91bGQgYmUgbGVzcyB0aGFuIDVHQmApXG4gICAgfVxuXG4gICAgLy8gU0hBMjU2IGlzIGVuYWJsZWQgb25seSBmb3IgYXV0aGVudGljYXRlZCBodHRwIHJlcXVlc3RzLiBJZiB0aGUgcmVxdWVzdCBpcyBhdXRoZW50aWNhdGVkXG4gICAgLy8gYW5kIHRoZSBjb25uZWN0aW9uIGlzIGh0dHBzIHdlIHVzZSB4LWFtei1jb250ZW50LXNoYTI1Nj1VTlNJR05FRC1QQVlMT0FEXG4gICAgLy8gaGVhZGVyIGZvciBzaWduYXR1cmUgY2FsY3VsYXRpb24uXG4gICAgdGhpcy5lbmFibGVTSEEyNTYgPSAhdGhpcy5hbm9ueW1vdXMgJiYgIXBhcmFtcy51c2VTU0xcblxuICAgIHRoaXMuczNBY2NlbGVyYXRlRW5kcG9pbnQgPSBwYXJhbXMuczNBY2NlbGVyYXRlRW5kcG9pbnQgfHwgdW5kZWZpbmVkXG4gICAgdGhpcy5yZXFPcHRpb25zID0ge31cbiAgICB0aGlzLmNsaWVudEV4dGVuc2lvbnMgPSBuZXcgRXh0ZW5zaW9ucyh0aGlzKVxuICB9XG5cbiAgLyoqXG4gICAqIE1pbmlvIGV4dGVuc2lvbnMgdGhhdCBhcmVuJ3QgbmVjZXNzYXJ5IHByZXNlbnQgZm9yIEFtYXpvbiBTMyBjb21wYXRpYmxlIHN0b3JhZ2Ugc2VydmVyc1xuICAgKi9cbiAgZ2V0IGV4dGVuc2lvbnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuY2xpZW50RXh0ZW5zaW9uc1xuICB9XG5cbiAgLyoqXG4gICAqIEBwYXJhbSBlbmRQb2ludCAtIHZhbGlkIFMzIGFjY2VsZXJhdGlvbiBlbmQgcG9pbnRcbiAgICovXG4gIHNldFMzVHJhbnNmZXJBY2NlbGVyYXRlKGVuZFBvaW50OiBzdHJpbmcpIHtcbiAgICB0aGlzLnMzQWNjZWxlcmF0ZUVuZHBvaW50ID0gZW5kUG9pbnRcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBzdXBwb3J0ZWQgcmVxdWVzdCBvcHRpb25zLlxuICAgKi9cbiAgcHVibGljIHNldFJlcXVlc3RPcHRpb25zKG9wdGlvbnM6IFBpY2s8aHR0cHMuUmVxdWVzdE9wdGlvbnMsICh0eXBlb2YgcmVxdWVzdE9wdGlvblByb3BlcnRpZXMpW251bWJlcl0+KSB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVxdWVzdCBvcHRpb25zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICB0aGlzLnJlcU9wdGlvbnMgPSBfLnBpY2sob3B0aW9ucywgcmVxdWVzdE9wdGlvblByb3BlcnRpZXMpXG4gIH1cblxuICAvKipcbiAgICogIFRoaXMgaXMgczMgU3BlY2lmaWMgYW5kIGRvZXMgbm90IGhvbGQgdmFsaWRpdHkgaW4gYW55IG90aGVyIE9iamVjdCBzdG9yYWdlLlxuICAgKi9cbiAgcHJpdmF0ZSBnZXRBY2NlbGVyYXRlRW5kUG9pbnRJZlNldChidWNrZXROYW1lPzogc3RyaW5nLCBvYmplY3ROYW1lPzogc3RyaW5nKSB7XG4gICAgaWYgKCFpc0VtcHR5KHRoaXMuczNBY2NlbGVyYXRlRW5kcG9pbnQpICYmICFpc0VtcHR5KGJ1Y2tldE5hbWUpICYmICFpc0VtcHR5KG9iamVjdE5hbWUpKSB7XG4gICAgICAvLyBodHRwOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25TMy9sYXRlc3QvZGV2L3RyYW5zZmVyLWFjY2VsZXJhdGlvbi5odG1sXG4gICAgICAvLyBEaXNhYmxlIHRyYW5zZmVyIGFjY2VsZXJhdGlvbiBmb3Igbm9uLWNvbXBsaWFudCBidWNrZXQgbmFtZXMuXG4gICAgICBpZiAoYnVja2V0TmFtZS5pbmNsdWRlcygnLicpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVHJhbnNmZXIgQWNjZWxlcmF0aW9uIGlzIG5vdCBzdXBwb3J0ZWQgZm9yIG5vbiBjb21wbGlhbnQgYnVja2V0OiR7YnVja2V0TmFtZX1gKVxuICAgICAgfVxuICAgICAgLy8gSWYgdHJhbnNmZXIgYWNjZWxlcmF0aW9uIGlzIHJlcXVlc3RlZCBzZXQgbmV3IGhvc3QuXG4gICAgICAvLyBGb3IgbW9yZSBkZXRhaWxzIGFib3V0IGVuYWJsaW5nIHRyYW5zZmVyIGFjY2VsZXJhdGlvbiByZWFkIGhlcmUuXG4gICAgICAvLyBodHRwOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9BbWF6b25TMy9sYXRlc3QvZGV2L3RyYW5zZmVyLWFjY2VsZXJhdGlvbi5odG1sXG4gICAgICByZXR1cm4gdGhpcy5zM0FjY2VsZXJhdGVFbmRwb2ludFxuICAgIH1cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8qKlxuICAgKiByZXR1cm5zIG9wdGlvbnMgb2JqZWN0IHRoYXQgY2FuIGJlIHVzZWQgd2l0aCBodHRwLnJlcXVlc3QoKVxuICAgKiBUYWtlcyBjYXJlIG9mIGNvbnN0cnVjdGluZyB2aXJ0dWFsLWhvc3Qtc3R5bGUgb3IgcGF0aC1zdHlsZSBob3N0bmFtZVxuICAgKi9cbiAgcHJvdGVjdGVkIGdldFJlcXVlc3RPcHRpb25zKFxuICAgIG9wdHM6IFJlcXVlc3RPcHRpb24gJiB7XG4gICAgICByZWdpb246IHN0cmluZ1xuICAgIH0sXG4gICk6IElSZXF1ZXN0ICYge1xuICAgIGhvc3Q6IHN0cmluZ1xuICAgIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz5cbiAgfSB7XG4gICAgY29uc3QgbWV0aG9kID0gb3B0cy5tZXRob2RcbiAgICBjb25zdCByZWdpb24gPSBvcHRzLnJlZ2lvblxuICAgIGNvbnN0IGJ1Y2tldE5hbWUgPSBvcHRzLmJ1Y2tldE5hbWVcbiAgICBsZXQgb2JqZWN0TmFtZSA9IG9wdHMub2JqZWN0TmFtZVxuICAgIGNvbnN0IGhlYWRlcnMgPSBvcHRzLmhlYWRlcnNcbiAgICBjb25zdCBxdWVyeSA9IG9wdHMucXVlcnlcblxuICAgIGxldCByZXFPcHRpb25zID0ge1xuICAgICAgbWV0aG9kLFxuICAgICAgaGVhZGVyczoge30gYXMgUmVxdWVzdEhlYWRlcnMsXG4gICAgICBwcm90b2NvbDogdGhpcy5wcm90b2NvbCxcbiAgICAgIC8vIElmIGN1c3RvbSB0cmFuc3BvcnRBZ2VudCB3YXMgc3VwcGxpZWQgZWFybGllciwgd2UnbGwgaW5qZWN0IGl0IGhlcmVcbiAgICAgIGFnZW50OiB0aGlzLnRyYW5zcG9ydEFnZW50LFxuICAgIH1cblxuICAgIC8vIFZlcmlmeSBpZiB2aXJ0dWFsIGhvc3Qgc3VwcG9ydGVkLlxuICAgIGxldCB2aXJ0dWFsSG9zdFN0eWxlXG4gICAgaWYgKGJ1Y2tldE5hbWUpIHtcbiAgICAgIHZpcnR1YWxIb3N0U3R5bGUgPSBpc1ZpcnR1YWxIb3N0U3R5bGUodGhpcy5ob3N0LCB0aGlzLnByb3RvY29sLCBidWNrZXROYW1lLCB0aGlzLnBhdGhTdHlsZSlcbiAgICB9XG5cbiAgICBsZXQgcGF0aCA9ICcvJ1xuICAgIGxldCBob3N0ID0gdGhpcy5ob3N0XG5cbiAgICBsZXQgcG9ydDogdW5kZWZpbmVkIHwgbnVtYmVyXG4gICAgaWYgKHRoaXMucG9ydCkge1xuICAgICAgcG9ydCA9IHRoaXMucG9ydFxuICAgIH1cblxuICAgIGlmIChvYmplY3ROYW1lKSB7XG4gICAgICBvYmplY3ROYW1lID0gdXJpUmVzb3VyY2VFc2NhcGUob2JqZWN0TmFtZSlcbiAgICB9XG5cbiAgICAvLyBGb3IgQW1hem9uIFMzIGVuZHBvaW50LCBnZXQgZW5kcG9pbnQgYmFzZWQgb24gcmVnaW9uLlxuICAgIGlmIChpc0FtYXpvbkVuZHBvaW50KGhvc3QpKSB7XG4gICAgICBjb25zdCBhY2NlbGVyYXRlRW5kUG9pbnQgPSB0aGlzLmdldEFjY2VsZXJhdGVFbmRQb2ludElmU2V0KGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUpXG4gICAgICBpZiAoYWNjZWxlcmF0ZUVuZFBvaW50KSB7XG4gICAgICAgIGhvc3QgPSBgJHthY2NlbGVyYXRlRW5kUG9pbnR9YFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaG9zdCA9IGdldFMzRW5kcG9pbnQocmVnaW9uKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICh2aXJ0dWFsSG9zdFN0eWxlICYmICFvcHRzLnBhdGhTdHlsZSkge1xuICAgICAgLy8gRm9yIGFsbCBob3N0cyB3aGljaCBzdXBwb3J0IHZpcnR1YWwgaG9zdCBzdHlsZSwgYGJ1Y2tldE5hbWVgXG4gICAgICAvLyBpcyBwYXJ0IG9mIHRoZSBob3N0bmFtZSBpbiB0aGUgZm9sbG93aW5nIGZvcm1hdDpcbiAgICAgIC8vXG4gICAgICAvLyAgdmFyIGhvc3QgPSAnYnVja2V0TmFtZS5leGFtcGxlLmNvbSdcbiAgICAgIC8vXG4gICAgICBpZiAoYnVja2V0TmFtZSkge1xuICAgICAgICBob3N0ID0gYCR7YnVja2V0TmFtZX0uJHtob3N0fWBcbiAgICAgIH1cbiAgICAgIGlmIChvYmplY3ROYW1lKSB7XG4gICAgICAgIHBhdGggPSBgLyR7b2JqZWN0TmFtZX1gXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZvciBhbGwgUzMgY29tcGF0aWJsZSBzdG9yYWdlIHNlcnZpY2VzIHdlIHdpbGwgZmFsbGJhY2sgdG9cbiAgICAgIC8vIHBhdGggc3R5bGUgcmVxdWVzdHMsIHdoZXJlIGBidWNrZXROYW1lYCBpcyBwYXJ0IG9mIHRoZSBVUklcbiAgICAgIC8vIHBhdGguXG4gICAgICBpZiAoYnVja2V0TmFtZSkge1xuICAgICAgICBwYXRoID0gYC8ke2J1Y2tldE5hbWV9YFxuICAgICAgfVxuICAgICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgICAgcGF0aCA9IGAvJHtidWNrZXROYW1lfS8ke29iamVjdE5hbWV9YFxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChxdWVyeSkge1xuICAgICAgcGF0aCArPSBgPyR7cXVlcnl9YFxuICAgIH1cbiAgICByZXFPcHRpb25zLmhlYWRlcnMuaG9zdCA9IGhvc3RcbiAgICBpZiAoKHJlcU9wdGlvbnMucHJvdG9jb2wgPT09ICdodHRwOicgJiYgcG9ydCAhPT0gODApIHx8IChyZXFPcHRpb25zLnByb3RvY29sID09PSAnaHR0cHM6JyAmJiBwb3J0ICE9PSA0NDMpKSB7XG4gICAgICByZXFPcHRpb25zLmhlYWRlcnMuaG9zdCA9IGpvaW5Ib3N0UG9ydChob3N0LCBwb3J0KVxuICAgIH1cblxuICAgIHJlcU9wdGlvbnMuaGVhZGVyc1sndXNlci1hZ2VudCddID0gdGhpcy51c2VyQWdlbnRcbiAgICBpZiAoaGVhZGVycykge1xuICAgICAgLy8gaGF2ZSBhbGwgaGVhZGVyIGtleXMgaW4gbG93ZXIgY2FzZSAtIHRvIG1ha2Ugc2lnbmluZyBlYXN5XG4gICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhoZWFkZXJzKSkge1xuICAgICAgICByZXFPcHRpb25zLmhlYWRlcnNbay50b0xvd2VyQ2FzZSgpXSA9IHZcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBVc2UgYW55IHJlcXVlc3Qgb3B0aW9uIHNwZWNpZmllZCBpbiBtaW5pb0NsaWVudC5zZXRSZXF1ZXN0T3B0aW9ucygpXG4gICAgcmVxT3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucmVxT3B0aW9ucywgcmVxT3B0aW9ucylcblxuICAgIHJldHVybiB7XG4gICAgICAuLi5yZXFPcHRpb25zLFxuICAgICAgaGVhZGVyczogXy5tYXBWYWx1ZXMoXy5waWNrQnkocmVxT3B0aW9ucy5oZWFkZXJzLCBpc0RlZmluZWQpLCAodikgPT4gdi50b1N0cmluZygpKSxcbiAgICAgIGhvc3QsXG4gICAgICBwb3J0LFxuICAgICAgcGF0aCxcbiAgICB9IHNhdGlzZmllcyBodHRwcy5SZXF1ZXN0T3B0aW9uc1xuICB9XG5cbiAgcHVibGljIGFzeW5jIHNldENyZWRlbnRpYWxzUHJvdmlkZXIoY3JlZGVudGlhbHNQcm92aWRlcjogQ3JlZGVudGlhbFByb3ZpZGVyKSB7XG4gICAgaWYgKCEoY3JlZGVudGlhbHNQcm92aWRlciBpbnN0YW5jZW9mIENyZWRlbnRpYWxQcm92aWRlcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5hYmxlIHRvIGdldCBjcmVkZW50aWFscy4gRXhwZWN0ZWQgaW5zdGFuY2Ugb2YgQ3JlZGVudGlhbFByb3ZpZGVyJylcbiAgICB9XG4gICAgdGhpcy5jcmVkZW50aWFsc1Byb3ZpZGVyID0gY3JlZGVudGlhbHNQcm92aWRlclxuICAgIGF3YWl0IHRoaXMuY2hlY2tBbmRSZWZyZXNoQ3JlZHMoKVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBjaGVja0FuZFJlZnJlc2hDcmVkcygpIHtcbiAgICBpZiAodGhpcy5jcmVkZW50aWFsc1Byb3ZpZGVyKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBjcmVkZW50aWFsc0NvbmYgPSBhd2FpdCB0aGlzLmNyZWRlbnRpYWxzUHJvdmlkZXIuZ2V0Q3JlZGVudGlhbHMoKVxuICAgICAgICB0aGlzLmFjY2Vzc0tleSA9IGNyZWRlbnRpYWxzQ29uZi5nZXRBY2Nlc3NLZXkoKVxuICAgICAgICB0aGlzLnNlY3JldEtleSA9IGNyZWRlbnRpYWxzQ29uZi5nZXRTZWNyZXRLZXkoKVxuICAgICAgICB0aGlzLnNlc3Npb25Ub2tlbiA9IGNyZWRlbnRpYWxzQ29uZi5nZXRTZXNzaW9uVG9rZW4oKVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuYWJsZSB0byBnZXQgY3JlZGVudGlhbHM6ICR7ZX1gLCB7IGNhdXNlOiBlIH0pXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBsb2dTdHJlYW0/OiBzdHJlYW0uV3JpdGFibGVcblxuICAvKipcbiAgICogbG9nIHRoZSByZXF1ZXN0LCByZXNwb25zZSwgZXJyb3JcbiAgICovXG4gIHByaXZhdGUgbG9nSFRUUChyZXFPcHRpb25zOiBJUmVxdWVzdCwgcmVzcG9uc2U6IGh0dHAuSW5jb21pbmdNZXNzYWdlIHwgbnVsbCwgZXJyPzogdW5rbm93bikge1xuICAgIC8vIGlmIG5vIGxvZ1N0cmVhbSBhdmFpbGFibGUgcmV0dXJuLlxuICAgIGlmICghdGhpcy5sb2dTdHJlYW0pIHtcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KHJlcU9wdGlvbnMpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXFPcHRpb25zIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAocmVzcG9uc2UgJiYgIWlzUmVhZGFibGVTdHJlYW0ocmVzcG9uc2UpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZXNwb25zZSBzaG91bGQgYmUgb2YgdHlwZSBcIlN0cmVhbVwiJylcbiAgICB9XG4gICAgaWYgKGVyciAmJiAhKGVyciBpbnN0YW5jZW9mIEVycm9yKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZXJyIHNob3VsZCBiZSBvZiB0eXBlIFwiRXJyb3JcIicpXG4gICAgfVxuICAgIGNvbnN0IGxvZ1N0cmVhbSA9IHRoaXMubG9nU3RyZWFtXG4gICAgY29uc3QgbG9nSGVhZGVycyA9IChoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycykgPT4ge1xuICAgICAgT2JqZWN0LmVudHJpZXMoaGVhZGVycykuZm9yRWFjaCgoW2ssIHZdKSA9PiB7XG4gICAgICAgIGlmIChrID09ICdhdXRob3JpemF0aW9uJykge1xuICAgICAgICAgIGlmIChpc1N0cmluZyh2KSkge1xuICAgICAgICAgICAgY29uc3QgcmVkYWN0b3IgPSBuZXcgUmVnRXhwKCdTaWduYXR1cmU9KFswLTlhLWZdKyknKVxuICAgICAgICAgICAgdiA9IHYucmVwbGFjZShyZWRhY3RvciwgJ1NpZ25hdHVyZT0qKlJFREFDVEVEKionKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBsb2dTdHJlYW0ud3JpdGUoYCR7a306ICR7dn1cXG5gKVxuICAgICAgfSlcbiAgICAgIGxvZ1N0cmVhbS53cml0ZSgnXFxuJylcbiAgICB9XG4gICAgbG9nU3RyZWFtLndyaXRlKGBSRVFVRVNUOiAke3JlcU9wdGlvbnMubWV0aG9kfSAke3JlcU9wdGlvbnMucGF0aH1cXG5gKVxuICAgIGxvZ0hlYWRlcnMocmVxT3B0aW9ucy5oZWFkZXJzKVxuICAgIGlmIChyZXNwb25zZSkge1xuICAgICAgdGhpcy5sb2dTdHJlYW0ud3JpdGUoYFJFU1BPTlNFOiAke3Jlc3BvbnNlLnN0YXR1c0NvZGV9XFxuYClcbiAgICAgIGxvZ0hlYWRlcnMocmVzcG9uc2UuaGVhZGVycyBhcyBSZXF1ZXN0SGVhZGVycylcbiAgICB9XG4gICAgaWYgKGVycikge1xuICAgICAgbG9nU3RyZWFtLndyaXRlKCdFUlJPUiBCT0RZOlxcbicpXG4gICAgICBjb25zdCBlcnJKU09OID0gSlNPTi5zdHJpbmdpZnkoZXJyLCBudWxsLCAnXFx0JylcbiAgICAgIGxvZ1N0cmVhbS53cml0ZShgJHtlcnJKU09OfVxcbmApXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEVuYWJsZSB0cmFjaW5nXG4gICAqL1xuICBwdWJsaWMgdHJhY2VPbihzdHJlYW0/OiBzdHJlYW0uV3JpdGFibGUpIHtcbiAgICBpZiAoIXN0cmVhbSkge1xuICAgICAgc3RyZWFtID0gcHJvY2Vzcy5zdGRvdXRcbiAgICB9XG4gICAgdGhpcy5sb2dTdHJlYW0gPSBzdHJlYW1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNhYmxlIHRyYWNpbmdcbiAgICovXG4gIHB1YmxpYyB0cmFjZU9mZigpIHtcbiAgICB0aGlzLmxvZ1N0cmVhbSA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLyoqXG4gICAqIG1ha2VSZXF1ZXN0IGlzIHRoZSBwcmltaXRpdmUgdXNlZCBieSB0aGUgYXBpcyBmb3IgbWFraW5nIFMzIHJlcXVlc3RzLlxuICAgKiBwYXlsb2FkIGNhbiBiZSBlbXB0eSBzdHJpbmcgaW4gY2FzZSBvZiBubyBwYXlsb2FkLlxuICAgKiBzdGF0dXNDb2RlIGlzIHRoZSBleHBlY3RlZCBzdGF0dXNDb2RlLiBJZiByZXNwb25zZS5zdGF0dXNDb2RlIGRvZXMgbm90IG1hdGNoXG4gICAqIHdlIHBhcnNlIHRoZSBYTUwgZXJyb3IgYW5kIGNhbGwgdGhlIGNhbGxiYWNrIHdpdGggdGhlIGVycm9yIG1lc3NhZ2UuXG4gICAqXG4gICAqIEEgdmFsaWQgcmVnaW9uIGlzIHBhc3NlZCBieSB0aGUgY2FsbHMgLSBsaXN0QnVja2V0cywgbWFrZUJ1Y2tldCBhbmQgZ2V0QnVja2V0UmVnaW9uLlxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGFzeW5jIG1ha2VSZXF1ZXN0QXN5bmMoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBwYXlsb2FkOiBCaW5hcnkgPSAnJyxcbiAgICBleHBlY3RlZENvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICApOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPiB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9ucyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwYXlsb2FkKSAmJiAhaXNPYmplY3QocGF5bG9hZCkpIHtcbiAgICAgIC8vIEJ1ZmZlciBpcyBvZiB0eXBlICdvYmplY3QnXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwYXlsb2FkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCIgb3IgXCJCdWZmZXJcIicpXG4gICAgfVxuICAgIGV4cGVjdGVkQ29kZXMuZm9yRWFjaCgoc3RhdHVzQ29kZSkgPT4ge1xuICAgICAgaWYgKCFpc051bWJlcihzdGF0dXNDb2RlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzdGF0dXNDb2RlIHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgICAgfVxuICAgIH0pXG4gICAgaWYgKCFpc1N0cmluZyhyZWdpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWdpb24gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghb3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICBvcHRpb25zLmhlYWRlcnMgPSB7fVxuICAgIH1cbiAgICBpZiAob3B0aW9ucy5tZXRob2QgPT09ICdQT1NUJyB8fCBvcHRpb25zLm1ldGhvZCA9PT0gJ1BVVCcgfHwgb3B0aW9ucy5tZXRob2QgPT09ICdERUxFVEUnKSB7XG4gICAgICBvcHRpb25zLmhlYWRlcnNbJ2NvbnRlbnQtbGVuZ3RoJ10gPSBwYXlsb2FkLmxlbmd0aC50b1N0cmluZygpXG4gICAgfVxuICAgIGNvbnN0IHNoYTI1NnN1bSA9IHRoaXMuZW5hYmxlU0hBMjU2ID8gdG9TaGEyNTYocGF5bG9hZCkgOiAnJ1xuICAgIHJldHVybiB0aGlzLm1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMob3B0aW9ucywgcGF5bG9hZCwgc2hhMjU2c3VtLCBleHBlY3RlZENvZGVzLCByZWdpb24pXG4gIH1cblxuICAvKipcbiAgICogbmV3IHJlcXVlc3Qgd2l0aCBwcm9taXNlXG4gICAqXG4gICAqIE5vIG5lZWQgdG8gZHJhaW4gcmVzcG9uc2UsIHJlc3BvbnNlIGJvZHkgaXMgbm90IHZhbGlkXG4gICAqL1xuICBhc3luYyBtYWtlUmVxdWVzdEFzeW5jT21pdChcbiAgICBvcHRpb25zOiBSZXF1ZXN0T3B0aW9uLFxuICAgIHBheWxvYWQ6IEJpbmFyeSA9ICcnLFxuICAgIHN0YXR1c0NvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICApOiBQcm9taXNlPE9taXQ8aHR0cC5JbmNvbWluZ01lc3NhZ2UsICdvbic+PiB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKG9wdGlvbnMsIHBheWxvYWQsIHN0YXR1c0NvZGVzLCByZWdpb24pXG4gICAgYXdhaXQgZHJhaW5SZXNwb25zZShyZXMpXG4gICAgcmV0dXJuIHJlc1xuICB9XG5cbiAgLyoqXG4gICAqIG1ha2VSZXF1ZXN0U3RyZWFtIHdpbGwgYmUgdXNlZCBkaXJlY3RseSBpbnN0ZWFkIG9mIG1ha2VSZXF1ZXN0IGluIGNhc2UgdGhlIHBheWxvYWRcbiAgICogaXMgYXZhaWxhYmxlIGFzIGEgc3RyZWFtLiBmb3IgZXguIHB1dE9iamVjdFxuICAgKlxuICAgKiBAaW50ZXJuYWxcbiAgICovXG4gIGFzeW5jIG1ha2VSZXF1ZXN0U3RyZWFtQXN5bmMoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBib2R5OiBzdHJlYW0uUmVhZGFibGUgfCBCaW5hcnksXG4gICAgc2hhMjU2c3VtOiBzdHJpbmcsXG4gICAgc3RhdHVzQ29kZXM6IG51bWJlcltdLFxuICAgIHJlZ2lvbjogc3RyaW5nLFxuICApOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPiB7XG4gICAgaWYgKCFpc09iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9ucyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKCEoQnVmZmVyLmlzQnVmZmVyKGJvZHkpIHx8IHR5cGVvZiBib2R5ID09PSAnc3RyaW5nJyB8fCBpc1JlYWRhYmxlU3RyZWFtKGJvZHkpKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihcbiAgICAgICAgYHN0cmVhbSBzaG91bGQgYmUgYSBCdWZmZXIsIHN0cmluZyBvciByZWFkYWJsZSBTdHJlYW0sIGdvdCAke3R5cGVvZiBib2R5fSBpbnN0ZWFkYCxcbiAgICAgIClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhzaGEyNTZzdW0pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaGEyNTZzdW0gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIHN0YXR1c0NvZGVzLmZvckVhY2goKHN0YXR1c0NvZGUpID0+IHtcbiAgICAgIGlmICghaXNOdW1iZXIoc3RhdHVzQ29kZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc3RhdHVzQ29kZSBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICAgIH1cbiAgICB9KVxuICAgIGlmICghaXNTdHJpbmcocmVnaW9uKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigncmVnaW9uIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICAvLyBzaGEyNTZzdW0gd2lsbCBiZSBlbXB0eSBmb3IgYW5vbnltb3VzIG9yIGh0dHBzIHJlcXVlc3RzXG4gICAgaWYgKCF0aGlzLmVuYWJsZVNIQTI1NiAmJiBzaGEyNTZzdW0ubGVuZ3RoICE9PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBzaGEyNTZzdW0gZXhwZWN0ZWQgdG8gYmUgZW1wdHkgZm9yIGFub255bW91cyBvciBodHRwcyByZXF1ZXN0c2ApXG4gICAgfVxuICAgIC8vIHNoYTI1NnN1bSBzaG91bGQgYmUgdmFsaWQgZm9yIG5vbi1hbm9ueW1vdXMgaHR0cCByZXF1ZXN0cy5cbiAgICBpZiAodGhpcy5lbmFibGVTSEEyNTYgJiYgc2hhMjU2c3VtLmxlbmd0aCAhPT0gNjQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYEludmFsaWQgc2hhMjU2c3VtIDogJHtzaGEyNTZzdW19YClcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLmNoZWNrQW5kUmVmcmVzaENyZWRzKClcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgcmVnaW9uID0gcmVnaW9uIHx8IChhd2FpdCB0aGlzLmdldEJ1Y2tldFJlZ2lvbkFzeW5jKG9wdGlvbnMuYnVja2V0TmFtZSEpKVxuXG4gICAgY29uc3QgcmVxT3B0aW9ucyA9IHRoaXMuZ2V0UmVxdWVzdE9wdGlvbnMoeyAuLi5vcHRpb25zLCByZWdpb24gfSlcbiAgICBpZiAoIXRoaXMuYW5vbnltb3VzKSB7XG4gICAgICAvLyBGb3Igbm9uLWFub255bW91cyBodHRwcyByZXF1ZXN0cyBzaGEyNTZzdW0gaXMgJ1VOU0lHTkVELVBBWUxPQUQnIGZvciBzaWduYXR1cmUgY2FsY3VsYXRpb24uXG4gICAgICBpZiAoIXRoaXMuZW5hYmxlU0hBMjU2KSB7XG4gICAgICAgIHNoYTI1NnN1bSA9ICdVTlNJR05FRC1QQVlMT0FEJ1xuICAgICAgfVxuICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKClcbiAgICAgIHJlcU9wdGlvbnMuaGVhZGVyc1sneC1hbXotZGF0ZSddID0gbWFrZURhdGVMb25nKGRhdGUpXG4gICAgICByZXFPcHRpb25zLmhlYWRlcnNbJ3gtYW16LWNvbnRlbnQtc2hhMjU2J10gPSBzaGEyNTZzdW1cbiAgICAgIGlmICh0aGlzLnNlc3Npb25Ub2tlbikge1xuICAgICAgICByZXFPcHRpb25zLmhlYWRlcnNbJ3gtYW16LXNlY3VyaXR5LXRva2VuJ10gPSB0aGlzLnNlc3Npb25Ub2tlblxuICAgICAgfVxuICAgICAgcmVxT3B0aW9ucy5oZWFkZXJzLmF1dGhvcml6YXRpb24gPSBzaWduVjQocmVxT3B0aW9ucywgdGhpcy5hY2Nlc3NLZXksIHRoaXMuc2VjcmV0S2V5LCByZWdpb24sIGRhdGUsIHNoYTI1NnN1bSlcbiAgICB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHJlcXVlc3QodGhpcy50cmFuc3BvcnQsIHJlcU9wdGlvbnMsIGJvZHkpXG4gICAgaWYgKCFyZXNwb25zZS5zdGF0dXNDb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCVUc6IHJlc3BvbnNlIGRvZXNuJ3QgaGF2ZSBhIHN0YXR1c0NvZGVcIilcbiAgICB9XG5cbiAgICBpZiAoIXN0YXR1c0NvZGVzLmluY2x1ZGVzKHJlc3BvbnNlLnN0YXR1c0NvZGUpKSB7XG4gICAgICAvLyBGb3IgYW4gaW5jb3JyZWN0IHJlZ2lvbiwgUzMgc2VydmVyIGFsd2F5cyBzZW5kcyBiYWNrIDQwMC5cbiAgICAgIC8vIEJ1dCB3ZSB3aWxsIGRvIGNhY2hlIGludmFsaWRhdGlvbiBmb3IgYWxsIGVycm9ycyBzbyB0aGF0LFxuICAgICAgLy8gaW4gZnV0dXJlLCBpZiBBV1MgUzMgZGVjaWRlcyB0byBzZW5kIGEgZGlmZmVyZW50IHN0YXR1cyBjb2RlIG9yXG4gICAgICAvLyBYTUwgZXJyb3IgY29kZSB3ZSB3aWxsIHN0aWxsIHdvcmsgZmluZS5cbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tbm9uLW51bGwtYXNzZXJ0aW9uXG4gICAgICBkZWxldGUgdGhpcy5yZWdpb25NYXBbb3B0aW9ucy5idWNrZXROYW1lIV1cblxuICAgICAgY29uc3QgZXJyID0gYXdhaXQgeG1sUGFyc2Vycy5wYXJzZVJlc3BvbnNlRXJyb3IocmVzcG9uc2UpXG4gICAgICB0aGlzLmxvZ0hUVFAocmVxT3B0aW9ucywgcmVzcG9uc2UsIGVycilcbiAgICAgIHRocm93IGVyclxuICAgIH1cblxuICAgIHRoaXMubG9nSFRUUChyZXFPcHRpb25zLCByZXNwb25zZSlcblxuICAgIHJldHVybiByZXNwb25zZVxuICB9XG5cbiAgLyoqXG4gICAqIGdldHMgdGhlIHJlZ2lvbiBvZiB0aGUgYnVja2V0XG4gICAqXG4gICAqIEBwYXJhbSBidWNrZXROYW1lXG4gICAqXG4gICAqIEBpbnRlcm5hbFxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIGdldEJ1Y2tldFJlZ2lvbkFzeW5jKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lIDogJHtidWNrZXROYW1lfWApXG4gICAgfVxuXG4gICAgLy8gUmVnaW9uIGlzIHNldCB3aXRoIGNvbnN0cnVjdG9yLCByZXR1cm4gdGhlIHJlZ2lvbiByaWdodCBoZXJlLlxuICAgIGlmICh0aGlzLnJlZ2lvbikge1xuICAgICAgcmV0dXJuIHRoaXMucmVnaW9uXG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVkID0gdGhpcy5yZWdpb25NYXBbYnVja2V0TmFtZV1cbiAgICBpZiAoY2FjaGVkKSB7XG4gICAgICByZXR1cm4gY2FjaGVkXG4gICAgfVxuXG4gICAgY29uc3QgZXh0cmFjdFJlZ2lvbkFzeW5jID0gYXN5bmMgKHJlc3BvbnNlOiBodHRwLkluY29taW5nTWVzc2FnZSkgPT4ge1xuICAgICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXNwb25zZSlcbiAgICAgIGNvbnN0IHJlZ2lvbiA9IHhtbFBhcnNlcnMucGFyc2VCdWNrZXRSZWdpb24oYm9keSkgfHwgREVGQVVMVF9SRUdJT05cbiAgICAgIHRoaXMucmVnaW9uTWFwW2J1Y2tldE5hbWVdID0gcmVnaW9uXG4gICAgICByZXR1cm4gcmVnaW9uXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdsb2NhdGlvbidcbiAgICAvLyBgZ2V0QnVja2V0TG9jYXRpb25gIGJlaGF2ZXMgZGlmZmVyZW50bHkgaW4gZm9sbG93aW5nIHdheXMgZm9yXG4gICAgLy8gZGlmZmVyZW50IGVudmlyb25tZW50cy5cbiAgICAvL1xuICAgIC8vIC0gRm9yIG5vZGVqcyBlbnYgd2UgZGVmYXVsdCB0byBwYXRoIHN0eWxlIHJlcXVlc3RzLlxuICAgIC8vIC0gRm9yIGJyb3dzZXIgZW52IHBhdGggc3R5bGUgcmVxdWVzdHMgb24gYnVja2V0cyB5aWVsZHMgQ09SU1xuICAgIC8vICAgZXJyb3IuIFRvIGNpcmN1bXZlbnQgdGhpcyBwcm9ibGVtIHdlIG1ha2UgYSB2aXJ0dWFsIGhvc3RcbiAgICAvLyAgIHN0eWxlIHJlcXVlc3Qgc2lnbmVkIHdpdGggJ3VzLWVhc3QtMScuIFRoaXMgcmVxdWVzdCBmYWlsc1xuICAgIC8vICAgd2l0aCBhbiBlcnJvciAnQXV0aG9yaXphdGlvbkhlYWRlck1hbGZvcm1lZCcsIGFkZGl0aW9uYWxseVxuICAgIC8vICAgdGhlIGVycm9yIFhNTCBhbHNvIHByb3ZpZGVzIFJlZ2lvbiBvZiB0aGUgYnVja2V0LiBUbyB2YWxpZGF0ZVxuICAgIC8vICAgdGhpcyByZWdpb24gaXMgcHJvcGVyIHdlIHJldHJ5IHRoZSBzYW1lIHJlcXVlc3Qgd2l0aCB0aGUgbmV3bHlcbiAgICAvLyAgIG9idGFpbmVkIHJlZ2lvbi5cbiAgICBjb25zdCBwYXRoU3R5bGUgPSB0aGlzLnBhdGhTdHlsZSAmJiAhaXNCcm93c2VyXG4gICAgbGV0IHJlZ2lvbjogc3RyaW5nXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIHBhdGhTdHlsZSB9LCAnJywgWzIwMF0sIERFRkFVTFRfUkVHSU9OKVxuICAgICAgcmV0dXJuIGV4dHJhY3RSZWdpb25Bc3luYyhyZXMpXG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgaWYgKCEoZS5uYW1lID09PSAnQXV0aG9yaXphdGlvbkhlYWRlck1hbGZvcm1lZCcpKSB7XG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3Igd2Ugc2V0IGV4dHJhIHByb3BlcnRpZXMgb24gZXJyb3Igb2JqZWN0XG4gICAgICByZWdpb24gPSBlLlJlZ2lvbiBhcyBzdHJpbmdcbiAgICAgIGlmICghcmVnaW9uKSB7XG4gICAgICAgIHRocm93IGVcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5LCBwYXRoU3R5bGUgfSwgJycsIFsyMDBdLCByZWdpb24pXG4gICAgcmV0dXJuIGF3YWl0IGV4dHJhY3RSZWdpb25Bc3luYyhyZXMpXG4gIH1cblxuICAvKipcbiAgICogbWFrZVJlcXVlc3QgaXMgdGhlIHByaW1pdGl2ZSB1c2VkIGJ5IHRoZSBhcGlzIGZvciBtYWtpbmcgUzMgcmVxdWVzdHMuXG4gICAqIHBheWxvYWQgY2FuIGJlIGVtcHR5IHN0cmluZyBpbiBjYXNlIG9mIG5vIHBheWxvYWQuXG4gICAqIHN0YXR1c0NvZGUgaXMgdGhlIGV4cGVjdGVkIHN0YXR1c0NvZGUuIElmIHJlc3BvbnNlLnN0YXR1c0NvZGUgZG9lcyBub3QgbWF0Y2hcbiAgICogd2UgcGFyc2UgdGhlIFhNTCBlcnJvciBhbmQgY2FsbCB0aGUgY2FsbGJhY2sgd2l0aCB0aGUgZXJyb3IgbWVzc2FnZS5cbiAgICogQSB2YWxpZCByZWdpb24gaXMgcGFzc2VkIGJ5IHRoZSBjYWxscyAtIGxpc3RCdWNrZXRzLCBtYWtlQnVja2V0IGFuZFxuICAgKiBnZXRCdWNrZXRSZWdpb24uXG4gICAqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBgbWFrZVJlcXVlc3RBc3luY2AgaW5zdGVhZFxuICAgKi9cbiAgbWFrZVJlcXVlc3QoXG4gICAgb3B0aW9uczogUmVxdWVzdE9wdGlvbixcbiAgICBwYXlsb2FkOiBCaW5hcnkgPSAnJyxcbiAgICBleHBlY3RlZENvZGVzOiBudW1iZXJbXSA9IFsyMDBdLFxuICAgIHJlZ2lvbiA9ICcnLFxuICAgIHJldHVyblJlc3BvbnNlOiBib29sZWFuLFxuICAgIGNiOiAoY2I6IHVua25vd24sIHJlc3VsdDogaHR0cC5JbmNvbWluZ01lc3NhZ2UpID0+IHZvaWQsXG4gICkge1xuICAgIGxldCBwcm9tOiBQcm9taXNlPGh0dHAuSW5jb21pbmdNZXNzYWdlPlxuICAgIGlmIChyZXR1cm5SZXNwb25zZSkge1xuICAgICAgcHJvbSA9IHRoaXMubWFrZVJlcXVlc3RBc3luYyhvcHRpb25zLCBwYXlsb2FkLCBleHBlY3RlZENvZGVzLCByZWdpb24pXG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgY29tcGF0aWJsZSBmb3Igb2xkIGJlaGF2aW91clxuICAgICAgcHJvbSA9IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQob3B0aW9ucywgcGF5bG9hZCwgZXhwZWN0ZWRDb2RlcywgcmVnaW9uKVxuICAgIH1cblxuICAgIHByb20udGhlbihcbiAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAoZXJyKSA9PiB7XG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICBjYihlcnIpXG4gICAgICB9LFxuICAgIClcbiAgfVxuXG4gIC8qKlxuICAgKiBtYWtlUmVxdWVzdFN0cmVhbSB3aWxsIGJlIHVzZWQgZGlyZWN0bHkgaW5zdGVhZCBvZiBtYWtlUmVxdWVzdCBpbiBjYXNlIHRoZSBwYXlsb2FkXG4gICAqIGlzIGF2YWlsYWJsZSBhcyBhIHN0cmVhbS4gZm9yIGV4LiBwdXRPYmplY3RcbiAgICpcbiAgICogQGRlcHJlY2F0ZWQgdXNlIGBtYWtlUmVxdWVzdFN0cmVhbUFzeW5jYCBpbnN0ZWFkXG4gICAqL1xuICBtYWtlUmVxdWVzdFN0cmVhbShcbiAgICBvcHRpb25zOiBSZXF1ZXN0T3B0aW9uLFxuICAgIHN0cmVhbTogc3RyZWFtLlJlYWRhYmxlIHwgQnVmZmVyLFxuICAgIHNoYTI1NnN1bTogc3RyaW5nLFxuICAgIHN0YXR1c0NvZGVzOiBudW1iZXJbXSxcbiAgICByZWdpb246IHN0cmluZyxcbiAgICByZXR1cm5SZXNwb25zZTogYm9vbGVhbixcbiAgICBjYjogKGNiOiB1bmtub3duLCByZXN1bHQ6IGh0dHAuSW5jb21pbmdNZXNzYWdlKSA9PiB2b2lkLFxuICApIHtcbiAgICBjb25zdCBleGVjdXRvciA9IGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RTdHJlYW1Bc3luYyhvcHRpb25zLCBzdHJlYW0sIHNoYTI1NnN1bSwgc3RhdHVzQ29kZXMsIHJlZ2lvbilcbiAgICAgIGlmICghcmV0dXJuUmVzcG9uc2UpIHtcbiAgICAgICAgYXdhaXQgZHJhaW5SZXNwb25zZShyZXMpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXNcbiAgICB9XG5cbiAgICBleGVjdXRvcigpLnRoZW4oXG4gICAgICAocmVzdWx0KSA9PiBjYihudWxsLCByZXN1bHQpLFxuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgKGVycikgPT4gY2IoZXJyKSxcbiAgICApXG4gIH1cblxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIGBnZXRCdWNrZXRSZWdpb25Bc3luY2AgaW5zdGVhZFxuICAgKi9cbiAgZ2V0QnVja2V0UmVnaW9uKGJ1Y2tldE5hbWU6IHN0cmluZywgY2I6IChlcnI6IHVua25vd24sIHJlZ2lvbjogc3RyaW5nKSA9PiB2b2lkKSB7XG4gICAgcmV0dXJuIHRoaXMuZ2V0QnVja2V0UmVnaW9uQXN5bmMoYnVja2V0TmFtZSkudGhlbihcbiAgICAgIChyZXN1bHQpID0+IGNiKG51bGwsIHJlc3VsdCksXG4gICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAoZXJyKSA9PiBjYihlcnIpLFxuICAgIClcbiAgfVxuXG4gIC8vIEJ1Y2tldCBvcGVyYXRpb25zXG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgdGhlIGJ1Y2tldCBgYnVja2V0TmFtZWAuXG4gICAqXG4gICAqL1xuICBhc3luYyBtYWtlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZywgcmVnaW9uOiBSZWdpb24gPSAnJywgbWFrZU9wdHM6IE1ha2VCdWNrZXRPcHQgPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIC8vIEJhY2t3YXJkIENvbXBhdGliaWxpdHlcbiAgICBpZiAoaXNPYmplY3QocmVnaW9uKSkge1xuICAgICAgbWFrZU9wdHMgPSByZWdpb25cbiAgICAgIHJlZ2lvbiA9ICcnXG4gICAgfVxuXG4gICAgaWYgKCFpc1N0cmluZyhyZWdpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdyZWdpb24gc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QobWFrZU9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtYWtlT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBsZXQgcGF5bG9hZCA9ICcnXG5cbiAgICAvLyBSZWdpb24gYWxyZWFkeSBzZXQgaW4gY29uc3RydWN0b3IsIHZhbGlkYXRlIGlmXG4gICAgLy8gY2FsbGVyIHJlcXVlc3RlZCBidWNrZXQgbG9jYXRpb24gaXMgc2FtZS5cbiAgICBpZiAocmVnaW9uICYmIHRoaXMucmVnaW9uKSB7XG4gICAgICBpZiAocmVnaW9uICE9PSB0aGlzLnJlZ2lvbikge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBDb25maWd1cmVkIHJlZ2lvbiAke3RoaXMucmVnaW9ufSwgcmVxdWVzdGVkICR7cmVnaW9ufWApXG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNlbmRpbmcgbWFrZUJ1Y2tldCByZXF1ZXN0IHdpdGggWE1MIGNvbnRhaW5pbmcgJ3VzLWVhc3QtMScgZmFpbHMuIEZvclxuICAgIC8vIGRlZmF1bHQgcmVnaW9uIHNlcnZlciBleHBlY3RzIHRoZSByZXF1ZXN0IHdpdGhvdXQgYm9keVxuICAgIGlmIChyZWdpb24gJiYgcmVnaW9uICE9PSBERUZBVUxUX1JFR0lPTikge1xuICAgICAgcGF5bG9hZCA9IHhtbC5idWlsZE9iamVjdCh7XG4gICAgICAgIENyZWF0ZUJ1Y2tldENvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICAkOiB7IHhtbG5zOiAnaHR0cDovL3MzLmFtYXpvbmF3cy5jb20vZG9jLzIwMDYtMDMtMDEvJyB9LFxuICAgICAgICAgIExvY2F0aW9uQ29uc3RyYWludDogcmVnaW9uLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG5cbiAgICBpZiAobWFrZU9wdHMuT2JqZWN0TG9ja2luZykge1xuICAgICAgaGVhZGVyc1sneC1hbXotYnVja2V0LW9iamVjdC1sb2NrLWVuYWJsZWQnXSA9IHRydWVcbiAgICB9XG5cbiAgICBpZiAoIXJlZ2lvbikge1xuICAgICAgcmVnaW9uID0gREVGQVVMVF9SRUdJT05cbiAgICB9XG4gICAgY29uc3QgZmluYWxSZWdpb24gPSByZWdpb24gLy8gdHlwZSBuYXJyb3dcbiAgICBjb25zdCByZXF1ZXN0T3B0OiBSZXF1ZXN0T3B0aW9uID0geyBtZXRob2QsIGJ1Y2tldE5hbWUsIGhlYWRlcnMgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQocmVxdWVzdE9wdCwgcGF5bG9hZCwgWzIwMF0sIGZpbmFsUmVnaW9uKVxuICAgIH0gY2F0Y2ggKGVycjogdW5rbm93bikge1xuICAgICAgaWYgKHJlZ2lvbiA9PT0gJycgfHwgcmVnaW9uID09PSBERUZBVUxUX1JFR0lPTikge1xuICAgICAgICBpZiAoZXJyIGluc3RhbmNlb2YgZXJyb3JzLlMzRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlcnJDb2RlID0gZXJyLmNvZGVcbiAgICAgICAgICBjb25zdCBlcnJSZWdpb24gPSBlcnIucmVnaW9uXG4gICAgICAgICAgaWYgKGVyckNvZGUgPT09ICdBdXRob3JpemF0aW9uSGVhZGVyTWFsZm9ybWVkJyAmJiBlcnJSZWdpb24gIT09ICcnKSB7XG4gICAgICAgICAgICAvLyBSZXRyeSB3aXRoIHJlZ2lvbiByZXR1cm5lZCBhcyBwYXJ0IG9mIGVycm9yXG4gICAgICAgICAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHJlcXVlc3RPcHQsIHBheWxvYWQsIFsyMDBdLCBlcnJDb2RlKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3cgZXJyXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRvIGNoZWNrIGlmIGEgYnVja2V0IGFscmVhZHkgZXhpc3RzLlxuICAgKi9cbiAgYXN5bmMgYnVja2V0RXhpc3RzKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdIRUFEJ1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lIH0pXG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBpZiAoZXJyLmNvZGUgPT09ICdOb1N1Y2hCdWNrZXQnIHx8IGVyci5jb2RlID09PSAnTm90Rm91bmQnKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgICAgdGhyb3cgZXJyXG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUJ1Y2tldChidWNrZXROYW1lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+XG5cbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIHVzZSBwcm9taXNlIHN0eWxlIEFQSVxuICAgKi9cbiAgcmVtb3ZlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZywgY2FsbGJhY2s6IE5vUmVzdWx0Q2FsbGJhY2spOiB2b2lkXG5cbiAgYXN5bmMgcmVtb3ZlQnVja2V0KGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSB9LCAnJywgWzIwNF0pXG4gICAgZGVsZXRlIHRoaXMucmVnaW9uTWFwW2J1Y2tldE5hbWVdXG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgaXMgY2FsbGVkIHdpdGggcmVhZGFibGUgc3RyZWFtIG9mIHRoZSBvYmplY3QgY29udGVudC5cbiAgICovXG4gIGFzeW5jIGdldE9iamVjdChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGdldE9wdHM6IFZlcnNpb25JZGVudGlmaWNhdG9yID0ge30sXG4gICk6IFByb21pc2U8c3RyZWFtLlJlYWRhYmxlPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuZ2V0UGFydGlhbE9iamVjdChidWNrZXROYW1lLCBvYmplY3ROYW1lLCAwLCAwLCBnZXRPcHRzKVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIGlzIGNhbGxlZCB3aXRoIHJlYWRhYmxlIHN0cmVhbSBvZiB0aGUgcGFydGlhbCBvYmplY3QgY29udGVudC5cbiAgICogQHBhcmFtIGJ1Y2tldE5hbWVcbiAgICogQHBhcmFtIG9iamVjdE5hbWVcbiAgICogQHBhcmFtIG9mZnNldFxuICAgKiBAcGFyYW0gbGVuZ3RoIC0gbGVuZ3RoIG9mIHRoZSBvYmplY3QgdGhhdCB3aWxsIGJlIHJlYWQgaW4gdGhlIHN0cmVhbSAob3B0aW9uYWwsIGlmIG5vdCBzcGVjaWZpZWQgd2UgcmVhZCB0aGUgcmVzdCBvZiB0aGUgZmlsZSBmcm9tIHRoZSBvZmZzZXQpXG4gICAqIEBwYXJhbSBnZXRPcHRzXG4gICAqL1xuICBhc3luYyBnZXRQYXJ0aWFsT2JqZWN0KFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgb2Zmc2V0OiBudW1iZXIsXG4gICAgbGVuZ3RoID0gMCxcbiAgICBnZXRPcHRzOiBWZXJzaW9uSWRlbnRpZmljYXRvciA9IHt9LFxuICApOiBQcm9taXNlPHN0cmVhbS5SZWFkYWJsZT4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNOdW1iZXIob2Zmc2V0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb2Zmc2V0IHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgIH1cbiAgICBpZiAoIWlzTnVtYmVyKGxlbmd0aCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xlbmd0aCBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG5cbiAgICBsZXQgcmFuZ2UgPSAnJ1xuICAgIGlmIChvZmZzZXQgfHwgbGVuZ3RoKSB7XG4gICAgICBpZiAob2Zmc2V0KSB7XG4gICAgICAgIHJhbmdlID0gYGJ5dGVzPSR7K29mZnNldH0tYFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmFuZ2UgPSAnYnl0ZXM9MC0nXG4gICAgICAgIG9mZnNldCA9IDBcbiAgICAgIH1cbiAgICAgIGlmIChsZW5ndGgpIHtcbiAgICAgICAgcmFuZ2UgKz0gYCR7K2xlbmd0aCArIG9mZnNldCAtIDF9YFxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzID0ge31cbiAgICBpZiAocmFuZ2UgIT09ICcnKSB7XG4gICAgICBoZWFkZXJzLnJhbmdlID0gcmFuZ2VcbiAgICB9XG5cbiAgICBjb25zdCBleHBlY3RlZFN0YXR1c0NvZGVzID0gWzIwMF1cbiAgICBpZiAocmFuZ2UpIHtcbiAgICAgIGV4cGVjdGVkU3RhdHVzQ29kZXMucHVzaCgyMDYpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdHRVQnXG5cbiAgICBjb25zdCBxdWVyeSA9IHFzLnN0cmluZ2lmeShnZXRPcHRzKVxuICAgIHJldHVybiBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGhlYWRlcnMsIHF1ZXJ5IH0sICcnLCBleHBlY3RlZFN0YXR1c0NvZGVzKVxuICB9XG5cbiAgLyoqXG4gICAqIGRvd25sb2FkIG9iamVjdCBjb250ZW50IHRvIGEgZmlsZS5cbiAgICogVGhpcyBtZXRob2Qgd2lsbCBjcmVhdGUgYSB0ZW1wIGZpbGUgbmFtZWQgYCR7ZmlsZW5hbWV9LiR7ZXRhZ30ucGFydC5taW5pb2Agd2hlbiBkb3dubG9hZGluZy5cbiAgICpcbiAgICogQHBhcmFtIGJ1Y2tldE5hbWUgLSBuYW1lIG9mIHRoZSBidWNrZXRcbiAgICogQHBhcmFtIG9iamVjdE5hbWUgLSBuYW1lIG9mIHRoZSBvYmplY3RcbiAgICogQHBhcmFtIGZpbGVQYXRoIC0gcGF0aCB0byB3aGljaCB0aGUgb2JqZWN0IGRhdGEgd2lsbCBiZSB3cml0dGVuIHRvXG4gICAqIEBwYXJhbSBnZXRPcHRzIC0gT3B0aW9uYWwgb2JqZWN0IGdldCBvcHRpb25cbiAgICovXG4gIGFzeW5jIGZHZXRPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIGdldE9wdHM6IFZlcnNpb25JZGVudGlmaWNhdG9yID0ge30pIHtcbiAgICAvLyBJbnB1dCB2YWxpZGF0aW9uLlxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoZmlsZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdmaWxlUGF0aCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG5cbiAgICBjb25zdCBkb3dubG9hZFRvVG1wRmlsZSA9IGFzeW5jICgpOiBQcm9taXNlPHN0cmluZz4gPT4ge1xuICAgICAgbGV0IHBhcnRGaWxlU3RyZWFtOiBzdHJlYW0uV3JpdGFibGVcbiAgICAgIGNvbnN0IG9ialN0YXQgPSBhd2FpdCB0aGlzLnN0YXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZ2V0T3B0cylcbiAgICAgIGNvbnN0IHBhcnRGaWxlID0gYCR7ZmlsZVBhdGh9LiR7b2JqU3RhdC5ldGFnfS5wYXJ0Lm1pbmlvYFxuXG4gICAgICBhd2FpdCBmc3AubWtkaXIocGF0aC5kaXJuYW1lKGZpbGVQYXRoKSwgeyByZWN1cnNpdmU6IHRydWUgfSlcblxuICAgICAgbGV0IG9mZnNldCA9IDBcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHN0YXRzID0gYXdhaXQgZnNwLnN0YXQocGFydEZpbGUpXG4gICAgICAgIGlmIChvYmpTdGF0LnNpemUgPT09IHN0YXRzLnNpemUpIHtcbiAgICAgICAgICByZXR1cm4gcGFydEZpbGVcbiAgICAgICAgfVxuICAgICAgICBvZmZzZXQgPSBzdGF0cy5zaXplXG4gICAgICAgIHBhcnRGaWxlU3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ocGFydEZpbGUsIHsgZmxhZ3M6ICdhJyB9KVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yICYmIChlIGFzIHVua25vd24gYXMgeyBjb2RlOiBzdHJpbmcgfSkuY29kZSA9PT0gJ0VOT0VOVCcpIHtcbiAgICAgICAgICAvLyBmaWxlIG5vdCBleGlzdFxuICAgICAgICAgIHBhcnRGaWxlU3RyZWFtID0gZnMuY3JlYXRlV3JpdGVTdHJlYW0ocGFydEZpbGUsIHsgZmxhZ3M6ICd3JyB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG90aGVyIGVycm9yLCBtYXliZSBhY2Nlc3MgZGVueVxuICAgICAgICAgIHRocm93IGVcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBjb25zdCBkb3dubG9hZFN0cmVhbSA9IGF3YWl0IHRoaXMuZ2V0UGFydGlhbE9iamVjdChidWNrZXROYW1lLCBvYmplY3ROYW1lLCBvZmZzZXQsIDAsIGdldE9wdHMpXG5cbiAgICAgIGF3YWl0IHN0cmVhbVByb21pc2UucGlwZWxpbmUoZG93bmxvYWRTdHJlYW0sIHBhcnRGaWxlU3RyZWFtKVxuICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBmc3Auc3RhdChwYXJ0RmlsZSlcbiAgICAgIGlmIChzdGF0cy5zaXplID09PSBvYmpTdGF0LnNpemUpIHtcbiAgICAgICAgcmV0dXJuIHBhcnRGaWxlXG4gICAgICB9XG5cbiAgICAgIHRocm93IG5ldyBFcnJvcignU2l6ZSBtaXNtYXRjaCBiZXR3ZWVuIGRvd25sb2FkZWQgZmlsZSBhbmQgdGhlIG9iamVjdCcpXG4gICAgfVxuXG4gICAgY29uc3QgcGFydEZpbGUgPSBhd2FpdCBkb3dubG9hZFRvVG1wRmlsZSgpXG4gICAgYXdhaXQgZnNwLnJlbmFtZShwYXJ0RmlsZSwgZmlsZVBhdGgpXG4gIH1cblxuICAvKipcbiAgICogU3RhdCBpbmZvcm1hdGlvbiBvZiB0aGUgb2JqZWN0LlxuICAgKi9cbiAgYXN5bmMgc3RhdE9iamVjdChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgc3RhdE9wdHM6IFN0YXRPYmplY3RPcHRzID0ge30pOiBQcm9taXNlPEJ1Y2tldEl0ZW1TdGF0PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHN0YXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignc3RhdE9wdHMgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgY29uc3QgcXVlcnkgPSBxcy5zdHJpbmdpZnkoc3RhdE9wdHMpXG4gICAgY29uc3QgbWV0aG9kID0gJ0hFQUQnXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfSlcblxuICAgIHJldHVybiB7XG4gICAgICBzaXplOiBwYXJzZUludChyZXMuaGVhZGVyc1snY29udGVudC1sZW5ndGgnXSBhcyBzdHJpbmcpLFxuICAgICAgbWV0YURhdGE6IGV4dHJhY3RNZXRhZGF0YShyZXMuaGVhZGVycyBhcyBSZXNwb25zZUhlYWRlciksXG4gICAgICBsYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKHJlcy5oZWFkZXJzWydsYXN0LW1vZGlmaWVkJ10gYXMgc3RyaW5nKSxcbiAgICAgIHZlcnNpb25JZDogZ2V0VmVyc2lvbklkKHJlcy5oZWFkZXJzIGFzIFJlc3BvbnNlSGVhZGVyKSxcbiAgICAgIGV0YWc6IHNhbml0aXplRVRhZyhyZXMuaGVhZGVycy5ldGFnKSxcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlIHRoZSBzcGVjaWZpZWQgb2JqZWN0LlxuICAgKiBAZGVwcmVjYXRlZCB1c2UgbmV3IHByb21pc2Ugc3R5bGUgQVBJXG4gICAqL1xuICByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM6IFJlbW92ZU9wdGlvbnMsIGNhbGxiYWNrOiBOb1Jlc3VsdENhbGxiYWNrKTogdm9pZFxuICAvKipcbiAgICogQGRlcHJlY2F0ZWQgdXNlIG5ldyBwcm9taXNlIHN0eWxlIEFQSVxuICAgKi9cbiAgLy8gQHRzLWlnbm9yZVxuICByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBOb1Jlc3VsdENhbGxiYWNrKTogdm9pZFxuICBhc3luYyByZW1vdmVPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM/OiBSZW1vdmVPcHRpb25zKTogUHJvbWlzZTx2b2lkPlxuXG4gIGFzeW5jIHJlbW92ZU9iamVjdChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgcmVtb3ZlT3B0czogUmVtb3ZlT3B0aW9ucyA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHJlbW92ZU9wdHMpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdyZW1vdmVPcHRzIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG4gICAgaWYgKHJlbW92ZU9wdHMuZ292ZXJuYW5jZUJ5cGFzcykge1xuICAgICAgaGVhZGVyc1snWC1BbXotQnlwYXNzLUdvdmVybmFuY2UtUmV0ZW50aW9uJ10gPSB0cnVlXG4gICAgfVxuICAgIGlmIChyZW1vdmVPcHRzLmZvcmNlRGVsZXRlKSB7XG4gICAgICBoZWFkZXJzWyd4LW1pbmlvLWZvcmNlLWRlbGV0ZSddID0gdHJ1ZVxuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5UGFyYW1zOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICBpZiAocmVtb3ZlT3B0cy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5UGFyYW1zLnZlcnNpb25JZCA9IGAke3JlbW92ZU9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgcXVlcnkgPSBxcy5zdHJpbmdpZnkocXVlcnlQYXJhbXMpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzLCBxdWVyeSB9LCAnJywgWzIwMCwgMjA0XSlcbiAgfVxuXG4gIC8vIENhbGxzIGltcGxlbWVudGVkIGJlbG93IGFyZSByZWxhdGVkIHRvIG11bHRpcGFydC5cblxuICBsaXN0SW5jb21wbGV0ZVVwbG9hZHMoXG4gICAgYnVja2V0OiBzdHJpbmcsXG4gICAgcHJlZml4OiBzdHJpbmcsXG4gICAgcmVjdXJzaXZlOiBib29sZWFuLFxuICApOiBCdWNrZXRTdHJlYW08SW5jb21wbGV0ZVVwbG9hZGVkQnVja2V0SXRlbT4ge1xuICAgIGlmIChwcmVmaXggPT09IHVuZGVmaW5lZCkge1xuICAgICAgcHJlZml4ID0gJydcbiAgICB9XG4gICAgaWYgKHJlY3Vyc2l2ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZWN1cnNpdmUgPSBmYWxzZVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkUHJlZml4KHByZWZpeCkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFByZWZpeEVycm9yKGBJbnZhbGlkIHByZWZpeCA6ICR7cHJlZml4fWApXG4gICAgfVxuICAgIGlmICghaXNCb29sZWFuKHJlY3Vyc2l2ZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3JlY3Vyc2l2ZSBzaG91bGQgYmUgb2YgdHlwZSBcImJvb2xlYW5cIicpXG4gICAgfVxuICAgIGNvbnN0IGRlbGltaXRlciA9IHJlY3Vyc2l2ZSA/ICcnIDogJy8nXG4gICAgbGV0IGtleU1hcmtlciA9ICcnXG4gICAgbGV0IHVwbG9hZElkTWFya2VyID0gJydcbiAgICBjb25zdCB1cGxvYWRzOiB1bmtub3duW10gPSBbXVxuICAgIGxldCBlbmRlZCA9IGZhbHNlXG5cbiAgICAvLyBUT0RPOiByZWZhY3RvciB0aGlzIHdpdGggYXN5bmMvYXdhaXQgYW5kIGBzdHJlYW0uUmVhZGFibGUuZnJvbWBcbiAgICBjb25zdCByZWFkU3RyZWFtID0gbmV3IHN0cmVhbS5SZWFkYWJsZSh7IG9iamVjdE1vZGU6IHRydWUgfSlcbiAgICByZWFkU3RyZWFtLl9yZWFkID0gKCkgPT4ge1xuICAgICAgLy8gcHVzaCBvbmUgdXBsb2FkIGluZm8gcGVyIF9yZWFkKClcbiAgICAgIGlmICh1cGxvYWRzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKHVwbG9hZHMuc2hpZnQoKSlcbiAgICAgIH1cbiAgICAgIGlmIChlbmRlZCkge1xuICAgICAgICByZXR1cm4gcmVhZFN0cmVhbS5wdXNoKG51bGwpXG4gICAgICB9XG4gICAgICB0aGlzLmxpc3RJbmNvbXBsZXRlVXBsb2Fkc1F1ZXJ5KGJ1Y2tldCwgcHJlZml4LCBrZXlNYXJrZXIsIHVwbG9hZElkTWFya2VyLCBkZWxpbWl0ZXIpLnRoZW4oXG4gICAgICAgIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L2Jhbi10cy1jb21tZW50XG4gICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgIHJlc3VsdC5wcmVmaXhlcy5mb3JFYWNoKChwcmVmaXgpID0+IHVwbG9hZHMucHVzaChwcmVmaXgpKVxuICAgICAgICAgIGFzeW5jLmVhY2hTZXJpZXMoXG4gICAgICAgICAgICByZXN1bHQudXBsb2FkcyxcbiAgICAgICAgICAgICh1cGxvYWQsIGNiKSA9PiB7XG4gICAgICAgICAgICAgIC8vIGZvciBlYWNoIGluY29tcGxldGUgdXBsb2FkIGFkZCB0aGUgc2l6ZXMgb2YgaXRzIHVwbG9hZGVkIHBhcnRzXG4gICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICB0aGlzLmxpc3RQYXJ0cyhidWNrZXQsIHVwbG9hZC5rZXksIHVwbG9hZC51cGxvYWRJZCkudGhlbihcbiAgICAgICAgICAgICAgICAocGFydHM6IFBhcnRbXSkgPT4ge1xuICAgICAgICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgdXBsb2FkLnNpemUgPSBwYXJ0cy5yZWR1Y2UoKGFjYywgaXRlbSkgPT4gYWNjICsgaXRlbS5zaXplLCAwKVxuICAgICAgICAgICAgICAgICAgdXBsb2Fkcy5wdXNoKHVwbG9hZClcbiAgICAgICAgICAgICAgICAgIGNiKClcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIChlcnI6IEVycm9yKSA9PiBjYihlcnIpLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgKGVycikgPT4ge1xuICAgICAgICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgICAgICAgcmVhZFN0cmVhbS5lbWl0KCdlcnJvcicsIGVycilcbiAgICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAocmVzdWx0LmlzVHJ1bmNhdGVkKSB7XG4gICAgICAgICAgICAgICAga2V5TWFya2VyID0gcmVzdWx0Lm5leHRLZXlNYXJrZXJcbiAgICAgICAgICAgICAgICB1cGxvYWRJZE1hcmtlciA9IHJlc3VsdC5uZXh0VXBsb2FkSWRNYXJrZXJcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbmRlZCA9IHRydWVcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvYmFuLXRzLWNvbW1lbnRcbiAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICByZWFkU3RyZWFtLl9yZWFkKClcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKVxuICAgICAgICB9LFxuICAgICAgICAoZSkgPT4ge1xuICAgICAgICAgIHJlYWRTdHJlYW0uZW1pdCgnZXJyb3InLCBlKVxuICAgICAgICB9LFxuICAgICAgKVxuICAgIH1cbiAgICByZXR1cm4gcmVhZFN0cmVhbVxuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBieSBsaXN0SW5jb21wbGV0ZVVwbG9hZHMgdG8gZmV0Y2ggYSBiYXRjaCBvZiBpbmNvbXBsZXRlIHVwbG9hZHMuXG4gICAqL1xuICBhc3luYyBsaXN0SW5jb21wbGV0ZVVwbG9hZHNRdWVyeShcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgcHJlZml4OiBzdHJpbmcsXG4gICAga2V5TWFya2VyOiBzdHJpbmcsXG4gICAgdXBsb2FkSWRNYXJrZXI6IHN0cmluZyxcbiAgICBkZWxpbWl0ZXI6IHN0cmluZyxcbiAgKTogUHJvbWlzZTxMaXN0TXVsdGlwYXJ0UmVzdWx0PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyhwcmVmaXgpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdwcmVmaXggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoa2V5TWFya2VyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigna2V5TWFya2VyIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzU3RyaW5nKHVwbG9hZElkTWFya2VyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndXBsb2FkSWRNYXJrZXIgc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcoZGVsaW1pdGVyKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZGVsaW1pdGVyIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBjb25zdCBxdWVyaWVzID0gW11cbiAgICBxdWVyaWVzLnB1c2goYHByZWZpeD0ke3VyaUVzY2FwZShwcmVmaXgpfWApXG4gICAgcXVlcmllcy5wdXNoKGBkZWxpbWl0ZXI9JHt1cmlFc2NhcGUoZGVsaW1pdGVyKX1gKVxuXG4gICAgaWYgKGtleU1hcmtlcikge1xuICAgICAgcXVlcmllcy5wdXNoKGBrZXktbWFya2VyPSR7dXJpRXNjYXBlKGtleU1hcmtlcil9YClcbiAgICB9XG4gICAgaWYgKHVwbG9hZElkTWFya2VyKSB7XG4gICAgICBxdWVyaWVzLnB1c2goYHVwbG9hZC1pZC1tYXJrZXI9JHt1cGxvYWRJZE1hcmtlcn1gKVxuICAgIH1cblxuICAgIGNvbnN0IG1heFVwbG9hZHMgPSAxMDAwXG4gICAgcXVlcmllcy5wdXNoKGBtYXgtdXBsb2Fkcz0ke21heFVwbG9hZHN9YClcbiAgICBxdWVyaWVzLnNvcnQoKVxuICAgIHF1ZXJpZXMudW5zaGlmdCgndXBsb2FkcycpXG4gICAgbGV0IHF1ZXJ5ID0gJydcbiAgICBpZiAocXVlcmllcy5sZW5ndGggPiAwKSB7XG4gICAgICBxdWVyeSA9IGAke3F1ZXJpZXMuam9pbignJicpfWBcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0TXVsdGlwYXJ0KGJvZHkpXG4gIH1cblxuICAvKipcbiAgICogSW5pdGlhdGUgYSBuZXcgbXVsdGlwYXJ0IHVwbG9hZC5cbiAgICogQGludGVybmFsXG4gICAqL1xuICBhc3luYyBpbml0aWF0ZU5ld011bHRpcGFydFVwbG9hZChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMpOiBQcm9taXNlPHN0cmluZz4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QoaGVhZGVycykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcignY29udGVudFR5cGUgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ3VwbG9hZHMnXG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBxdWVyeSwgaGVhZGVycyB9KVxuICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZWFkQXNCdWZmZXIocmVzKVxuICAgIHJldHVybiBwYXJzZUluaXRpYXRlTXVsdGlwYXJ0KGJvZHkudG9TdHJpbmcoKSlcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBNZXRob2QgdG8gYWJvcnQgYSBtdWx0aXBhcnQgdXBsb2FkIHJlcXVlc3QgaW4gY2FzZSBvZiBhbnkgZXJyb3JzLlxuICAgKlxuICAgKiBAcGFyYW0gYnVja2V0TmFtZSAtIEJ1Y2tldCBOYW1lXG4gICAqIEBwYXJhbSBvYmplY3ROYW1lIC0gT2JqZWN0IE5hbWVcbiAgICogQHBhcmFtIHVwbG9hZElkIC0gaWQgb2YgYSBtdWx0aXBhcnQgdXBsb2FkIHRvIGNhbmNlbCBkdXJpbmcgY29tcG9zZSBvYmplY3Qgc2VxdWVuY2UuXG4gICAqL1xuICBhc3luYyBhYm9ydE11bHRpcGFydFVwbG9hZChidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgdXBsb2FkSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cGxvYWRJZH1gXG5cbiAgICBjb25zdCByZXF1ZXN0T3B0aW9ucyA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lOiBvYmplY3ROYW1lLCBxdWVyeSB9XG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdChyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDRdKVxuICB9XG5cbiAgYXN5bmMgZmluZFVwbG9hZElkKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoIWlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRPYmplY3ROYW1lRXJyb3IoYEludmFsaWQgb2JqZWN0IG5hbWU6ICR7b2JqZWN0TmFtZX1gKVxuICAgIH1cblxuICAgIGxldCBsYXRlc3RVcGxvYWQ6IExpc3RNdWx0aXBhcnRSZXN1bHRbJ3VwbG9hZHMnXVtudW1iZXJdIHwgdW5kZWZpbmVkXG4gICAgbGV0IGtleU1hcmtlciA9ICcnXG4gICAgbGV0IHVwbG9hZElkTWFya2VyID0gJydcbiAgICBmb3IgKDs7KSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmxpc3RJbmNvbXBsZXRlVXBsb2Fkc1F1ZXJ5KGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIGtleU1hcmtlciwgdXBsb2FkSWRNYXJrZXIsICcnKVxuICAgICAgZm9yIChjb25zdCB1cGxvYWQgb2YgcmVzdWx0LnVwbG9hZHMpIHtcbiAgICAgICAgaWYgKHVwbG9hZC5rZXkgPT09IG9iamVjdE5hbWUpIHtcbiAgICAgICAgICBpZiAoIWxhdGVzdFVwbG9hZCB8fCB1cGxvYWQuaW5pdGlhdGVkLmdldFRpbWUoKSA+IGxhdGVzdFVwbG9hZC5pbml0aWF0ZWQuZ2V0VGltZSgpKSB7XG4gICAgICAgICAgICBsYXRlc3RVcGxvYWQgPSB1cGxvYWRcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQuaXNUcnVuY2F0ZWQpIHtcbiAgICAgICAga2V5TWFya2VyID0gcmVzdWx0Lm5leHRLZXlNYXJrZXJcbiAgICAgICAgdXBsb2FkSWRNYXJrZXIgPSByZXN1bHQubmV4dFVwbG9hZElkTWFya2VyXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIHJldHVybiBsYXRlc3RVcGxvYWQ/LnVwbG9hZElkXG4gIH1cblxuICAvKipcbiAgICogdGhpcyBjYWxsIHdpbGwgYWdncmVnYXRlIHRoZSBwYXJ0cyBvbiB0aGUgc2VydmVyIGludG8gYSBzaW5nbGUgb2JqZWN0LlxuICAgKi9cbiAgYXN5bmMgY29tcGxldGVNdWx0aXBhcnRVcGxvYWQoXG4gICAgYnVja2V0TmFtZTogc3RyaW5nLFxuICAgIG9iamVjdE5hbWU6IHN0cmluZyxcbiAgICB1cGxvYWRJZDogc3RyaW5nLFxuICAgIGV0YWdzOiB7XG4gICAgICBwYXJ0OiBudW1iZXJcbiAgICAgIGV0YWc/OiBzdHJpbmdcbiAgICB9W10sXG4gICk6IFByb21pc2U8eyBldGFnOiBzdHJpbmc7IHZlcnNpb25JZDogc3RyaW5nIHwgbnVsbCB9PiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyh1cGxvYWRJZCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3VwbG9hZElkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzT2JqZWN0KGV0YWdzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZXRhZ3Mgc2hvdWxkIGJlIG9mIHR5cGUgXCJBcnJheVwiJylcbiAgICB9XG5cbiAgICBpZiAoIXVwbG9hZElkKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCd1cGxvYWRJZCBjYW5ub3QgYmUgZW1wdHknKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gYHVwbG9hZElkPSR7dXJpRXNjYXBlKHVwbG9hZElkKX1gXG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKClcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdCh7XG4gICAgICBDb21wbGV0ZU11bHRpcGFydFVwbG9hZDoge1xuICAgICAgICAkOiB7XG4gICAgICAgICAgeG1sbnM6ICdodHRwOi8vczMuYW1hem9uYXdzLmNvbS9kb2MvMjAwNi0wMy0wMS8nLFxuICAgICAgICB9LFxuICAgICAgICBQYXJ0OiBldGFncy5tYXAoKGV0YWcpID0+IHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgUGFydE51bWJlcjogZXRhZy5wYXJ0LFxuICAgICAgICAgICAgRVRhZzogZXRhZy5ldGFnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc0J1ZmZlcihyZXMpXG4gICAgY29uc3QgcmVzdWx0ID0gcGFyc2VDb21wbGV0ZU11bHRpcGFydChib2R5LnRvU3RyaW5nKCkpXG4gICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQlVHOiBmYWlsZWQgdG8gcGFyc2Ugc2VydmVyIHJlc3BvbnNlJylcbiAgICB9XG5cbiAgICBpZiAocmVzdWx0LmVyckNvZGUpIHtcbiAgICAgIC8vIE11bHRpcGFydCBDb21wbGV0ZSBBUEkgcmV0dXJucyBhbiBlcnJvciBYTUwgYWZ0ZXIgYSAyMDAgaHR0cCBzdGF0dXNcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuUzNFcnJvcihyZXN1bHQuZXJyTWVzc2FnZSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9iYW4tdHMtY29tbWVudFxuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgZXRhZzogcmVzdWx0LmV0YWcgYXMgc3RyaW5nLFxuICAgICAgdmVyc2lvbklkOiBnZXRWZXJzaW9uSWQocmVzLmhlYWRlcnMgYXMgUmVzcG9uc2VIZWFkZXIpLFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgcGFydC1pbmZvIG9mIGFsbCBwYXJ0cyBvZiBhbiBpbmNvbXBsZXRlIHVwbG9hZCBzcGVjaWZpZWQgYnkgdXBsb2FkSWQuXG4gICAqL1xuICBwcm90ZWN0ZWQgYXN5bmMgbGlzdFBhcnRzKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nLCB1cGxvYWRJZDogc3RyaW5nKTogUHJvbWlzZTxVcGxvYWRlZFBhcnRbXT4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcodXBsb2FkSWQpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd1cGxvYWRJZCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmluZ1wiJylcbiAgICB9XG4gICAgaWYgKCF1cGxvYWRJZCkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndXBsb2FkSWQgY2Fubm90IGJlIGVtcHR5JylcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0czogVXBsb2FkZWRQYXJ0W10gPSBbXVxuICAgIGxldCBtYXJrZXIgPSAwXG4gICAgbGV0IHJlc3VsdFxuICAgIGRvIHtcbiAgICAgIHJlc3VsdCA9IGF3YWl0IHRoaXMubGlzdFBhcnRzUXVlcnkoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdXBsb2FkSWQsIG1hcmtlcilcbiAgICAgIG1hcmtlciA9IHJlc3VsdC5tYXJrZXJcbiAgICAgIHBhcnRzLnB1c2goLi4ucmVzdWx0LnBhcnRzKVxuICAgIH0gd2hpbGUgKHJlc3VsdC5pc1RydW5jYXRlZClcblxuICAgIHJldHVybiBwYXJ0c1xuICB9XG5cbiAgLyoqXG4gICAqIENhbGxlZCBieSBsaXN0UGFydHMgdG8gZmV0Y2ggYSBiYXRjaCBvZiBwYXJ0LWluZm9cbiAgICovXG4gIHByaXZhdGUgYXN5bmMgbGlzdFBhcnRzUXVlcnkoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHVwbG9hZElkOiBzdHJpbmcsIG1hcmtlcjogbnVtYmVyKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1N0cmluZyh1cGxvYWRJZCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3VwbG9hZElkIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgIH1cbiAgICBpZiAoIWlzTnVtYmVyKG1hcmtlcikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ21hcmtlciBzaG91bGQgYmUgb2YgdHlwZSBcIm51bWJlclwiJylcbiAgICB9XG4gICAgaWYgKCF1cGxvYWRJZCkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndXBsb2FkSWQgY2Fubm90IGJlIGVtcHR5JylcbiAgICB9XG5cbiAgICBsZXQgcXVlcnkgPSBgdXBsb2FkSWQ9JHt1cmlFc2NhcGUodXBsb2FkSWQpfWBcbiAgICBpZiAobWFya2VyKSB7XG4gICAgICBxdWVyeSArPSBgJnBhcnQtbnVtYmVyLW1hcmtlcj0ke21hcmtlcn1gXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0pXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0UGFydHMoYXdhaXQgcmVhZEFzU3RyaW5nKHJlcykpXG4gIH1cblxuICBhc3luYyBsaXN0QnVja2V0cygpOiBQcm9taXNlPEJ1Y2tldEl0ZW1Gcm9tTGlzdFtdPiB7XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBodHRwUmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jKHsgbWV0aG9kIH0sICcnLCBbMjAwXSwgdGhpcy5yZWdpb24gPz8gJycpXG4gICAgY29uc3QgeG1sUmVzdWx0ID0gYXdhaXQgcmVhZEFzU3RyaW5nKGh0dHBSZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VMaXN0QnVja2V0KHhtbFJlc3VsdClcbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxjdWxhdGUgcGFydCBzaXplIGdpdmVuIHRoZSBvYmplY3Qgc2l6ZS4gUGFydCBzaXplIHdpbGwgYmUgYXRsZWFzdCB0aGlzLnBhcnRTaXplXG4gICAqL1xuICBjYWxjdWxhdGVQYXJ0U2l6ZShzaXplOiBudW1iZXIpIHtcbiAgICBpZiAoIWlzTnVtYmVyKHNpemUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzaXplIHNob3VsZCBiZSBvZiB0eXBlIFwibnVtYmVyXCInKVxuICAgIH1cbiAgICBpZiAoc2l6ZSA+IHRoaXMubWF4T2JqZWN0U2l6ZSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgc2l6ZSBzaG91bGQgbm90IGJlIG1vcmUgdGhhbiAke3RoaXMubWF4T2JqZWN0U2l6ZX1gKVxuICAgIH1cbiAgICBpZiAodGhpcy5vdmVyUmlkZVBhcnRTaXplKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJ0U2l6ZVxuICAgIH1cbiAgICBsZXQgcGFydFNpemUgPSB0aGlzLnBhcnRTaXplXG4gICAgZm9yICg7Oykge1xuICAgICAgLy8gd2hpbGUodHJ1ZSkgey4uLn0gdGhyb3dzIGxpbnRpbmcgZXJyb3IuXG4gICAgICAvLyBJZiBwYXJ0U2l6ZSBpcyBiaWcgZW5vdWdoIHRvIGFjY29tb2RhdGUgdGhlIG9iamVjdCBzaXplLCB0aGVuIHVzZSBpdC5cbiAgICAgIGlmIChwYXJ0U2l6ZSAqIDEwMDAwID4gc2l6ZSkge1xuICAgICAgICByZXR1cm4gcGFydFNpemVcbiAgICAgIH1cbiAgICAgIC8vIFRyeSBwYXJ0IHNpemVzIGFzIDY0TUIsIDgwTUIsIDk2TUIgZXRjLlxuICAgICAgcGFydFNpemUgKz0gMTYgKiAxMDI0ICogMTAyNFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGxvYWRzIHRoZSBvYmplY3QgdXNpbmcgY29udGVudHMgZnJvbSBhIGZpbGVcbiAgICovXG4gIGFzeW5jIGZQdXRPYmplY3QoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIGZpbGVQYXRoOiBzdHJpbmcsIG1ldGFEYXRhOiBPYmplY3RNZXRhRGF0YSA9IHt9KSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoIWlzU3RyaW5nKGZpbGVQYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignZmlsZVBhdGggc2hvdWxkIGJlIG9mIHR5cGUgXCJzdHJpbmdcIicpXG4gICAgfVxuICAgIGlmICghaXNPYmplY3QobWV0YURhdGEpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtZXRhRGF0YSBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICAvLyBJbnNlcnRzIGNvcnJlY3QgYGNvbnRlbnQtdHlwZWAgYXR0cmlidXRlIGJhc2VkIG9uIG1ldGFEYXRhIGFuZCBmaWxlUGF0aFxuICAgIG1ldGFEYXRhID0gaW5zZXJ0Q29udGVudFR5cGUobWV0YURhdGEsIGZpbGVQYXRoKVxuICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBmc3AubHN0YXQoZmlsZVBhdGgpXG4gICAgYXdhaXQgdGhpcy5wdXRPYmplY3QoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlUGF0aCksIHN0YXQuc2l6ZSwgbWV0YURhdGEpXG4gIH1cblxuICAvKipcbiAgICogIFVwbG9hZGluZyBhIHN0cmVhbSwgXCJCdWZmZXJcIiBvciBcInN0cmluZ1wiLlxuICAgKiAgSXQncyByZWNvbW1lbmRlZCB0byBwYXNzIGBzaXplYCBhcmd1bWVudCB3aXRoIHN0cmVhbS5cbiAgICovXG4gIGFzeW5jIHB1dE9iamVjdChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIHN0cmVhbTogc3RyZWFtLlJlYWRhYmxlIHwgQnVmZmVyIHwgc3RyaW5nLFxuICAgIHNpemU/OiBudW1iZXIsXG4gICAgbWV0YURhdGE/OiBJdGVtQnVja2V0TWV0YWRhdGEsXG4gICk6IFByb21pc2U8VXBsb2FkZWRPYmplY3RJbmZvPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICAvLyBXZSdsbCBuZWVkIHRvIHNoaWZ0IGFyZ3VtZW50cyB0byB0aGUgbGVmdCBiZWNhdXNlIG9mIG1ldGFEYXRhXG4gICAgLy8gYW5kIHNpemUgYmVpbmcgb3B0aW9uYWwuXG4gICAgaWYgKGlzT2JqZWN0KHNpemUpKSB7XG4gICAgICBtZXRhRGF0YSA9IHNpemVcbiAgICB9XG4gICAgLy8gRW5zdXJlcyBNZXRhZGF0YSBoYXMgYXBwcm9wcmlhdGUgcHJlZml4IGZvciBBMyBBUElcbiAgICBjb25zdCBoZWFkZXJzID0gcHJlcGVuZFhBTVpNZXRhKG1ldGFEYXRhKVxuICAgIGlmICh0eXBlb2Ygc3RyZWFtID09PSAnc3RyaW5nJyB8fCBzdHJlYW0gaW5zdGFuY2VvZiBCdWZmZXIpIHtcbiAgICAgIC8vIEFkYXB0cyB0aGUgbm9uLXN0cmVhbSBpbnRlcmZhY2UgaW50byBhIHN0cmVhbS5cbiAgICAgIHNpemUgPSBzdHJlYW0ubGVuZ3RoXG4gICAgICBzdHJlYW0gPSByZWFkYWJsZVN0cmVhbShzdHJlYW0pXG4gICAgfSBlbHNlIGlmICghaXNSZWFkYWJsZVN0cmVhbShzdHJlYW0pKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCd0aGlyZCBhcmd1bWVudCBzaG91bGQgYmUgb2YgdHlwZSBcInN0cmVhbS5SZWFkYWJsZVwiIG9yIFwiQnVmZmVyXCIgb3IgXCJzdHJpbmdcIicpXG4gICAgfVxuXG4gICAgaWYgKGlzTnVtYmVyKHNpemUpICYmIHNpemUgPCAwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBzaXplIGNhbm5vdCBiZSBuZWdhdGl2ZSwgZ2l2ZW4gc2l6ZTogJHtzaXplfWApXG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBwYXJ0IHNpemUgYW5kIGZvcndhcmQgdGhhdCB0byB0aGUgQmxvY2tTdHJlYW0uIERlZmF1bHQgdG8gdGhlXG4gICAgLy8gbGFyZ2VzdCBibG9jayBzaXplIHBvc3NpYmxlIGlmIG5lY2Vzc2FyeS5cbiAgICBpZiAoIWlzTnVtYmVyKHNpemUpKSB7XG4gICAgICBzaXplID0gdGhpcy5tYXhPYmplY3RTaXplXG4gICAgfVxuXG4gICAgLy8gR2V0IHRoZSBwYXJ0IHNpemUgYW5kIGZvcndhcmQgdGhhdCB0byB0aGUgQmxvY2tTdHJlYW0uIERlZmF1bHQgdG8gdGhlXG4gICAgLy8gbGFyZ2VzdCBibG9jayBzaXplIHBvc3NpYmxlIGlmIG5lY2Vzc2FyeS5cbiAgICBpZiAoc2l6ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBjb25zdCBzdGF0U2l6ZSA9IGF3YWl0IGdldENvbnRlbnRMZW5ndGgoc3RyZWFtKVxuICAgICAgaWYgKHN0YXRTaXplICE9PSBudWxsKSB7XG4gICAgICAgIHNpemUgPSBzdGF0U2l6ZVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghaXNOdW1iZXIoc2l6ZSkpIHtcbiAgICAgIC8vIEJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAgICAgIHNpemUgPSB0aGlzLm1heE9iamVjdFNpemVcbiAgICB9XG5cbiAgICBjb25zdCBwYXJ0U2l6ZSA9IHRoaXMuY2FsY3VsYXRlUGFydFNpemUoc2l6ZSlcbiAgICBpZiAodHlwZW9mIHN0cmVhbSA9PT0gJ3N0cmluZycgfHwgQnVmZmVyLmlzQnVmZmVyKHN0cmVhbSkgfHwgc2l6ZSA8PSBwYXJ0U2l6ZSkge1xuICAgICAgY29uc3QgYnVmID0gaXNSZWFkYWJsZVN0cmVhbShzdHJlYW0pID8gYXdhaXQgcmVhZEFzQnVmZmVyKHN0cmVhbSkgOiBCdWZmZXIuZnJvbShzdHJlYW0pXG4gICAgICByZXR1cm4gdGhpcy51cGxvYWRCdWZmZXIoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycywgYnVmKVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLnVwbG9hZFN0cmVhbShidWNrZXROYW1lLCBvYmplY3ROYW1lLCBoZWFkZXJzLCBzdHJlYW0sIHBhcnRTaXplKVxuICB9XG5cbiAgLyoqXG4gICAqIG1ldGhvZCB0byB1cGxvYWQgYnVmZmVyIGluIG9uZSBjYWxsXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHVwbG9hZEJ1ZmZlcihcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzLFxuICAgIGJ1ZjogQnVmZmVyLFxuICApOiBQcm9taXNlPFVwbG9hZGVkT2JqZWN0SW5mbz4ge1xuICAgIGNvbnN0IHsgbWQ1c3VtLCBzaGEyNTZzdW0gfSA9IGhhc2hCaW5hcnkoYnVmLCB0aGlzLmVuYWJsZVNIQTI1NilcbiAgICBoZWFkZXJzWydDb250ZW50LUxlbmd0aCddID0gYnVmLmxlbmd0aFxuICAgIGlmICghdGhpcy5lbmFibGVTSEEyNTYpIHtcbiAgICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSBtZDVzdW1cbiAgICB9XG4gICAgY29uc3QgcmVzID0gYXdhaXQgdGhpcy5tYWtlUmVxdWVzdFN0cmVhbUFzeW5jKFxuICAgICAge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBidWNrZXROYW1lLFxuICAgICAgICBvYmplY3ROYW1lLFxuICAgICAgICBoZWFkZXJzLFxuICAgICAgfSxcbiAgICAgIGJ1ZixcbiAgICAgIHNoYTI1NnN1bSxcbiAgICAgIFsyMDBdLFxuICAgICAgJycsXG4gICAgKVxuICAgIGF3YWl0IGRyYWluUmVzcG9uc2UocmVzKVxuICAgIHJldHVybiB7XG4gICAgICBldGFnOiBzYW5pdGl6ZUVUYWcocmVzLmhlYWRlcnMuZXRhZyksXG4gICAgICB2ZXJzaW9uSWQ6IGdldFZlcnNpb25JZChyZXMuaGVhZGVycyBhcyBSZXNwb25zZUhlYWRlciksXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIHVwbG9hZCBzdHJlYW0gd2l0aCBNdWx0aXBhcnRVcGxvYWRcbiAgICogQHByaXZhdGVcbiAgICovXG4gIHByaXZhdGUgYXN5bmMgdXBsb2FkU3RyZWFtKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMsXG4gICAgYm9keTogc3RyZWFtLlJlYWRhYmxlLFxuICAgIHBhcnRTaXplOiBudW1iZXIsXG4gICk6IFByb21pc2U8VXBsb2FkZWRPYmplY3RJbmZvPiB7XG4gICAgLy8gQSBtYXAgb2YgdGhlIHByZXZpb3VzbHkgdXBsb2FkZWQgY2h1bmtzLCBmb3IgcmVzdW1pbmcgYSBmaWxlIHVwbG9hZC4gVGhpc1xuICAgIC8vIHdpbGwgYmUgbnVsbCBpZiB3ZSBhcmVuJ3QgcmVzdW1pbmcgYW4gdXBsb2FkLlxuICAgIGNvbnN0IG9sZFBhcnRzOiBSZWNvcmQ8bnVtYmVyLCBQYXJ0PiA9IHt9XG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIHRoZSBldGFncyBmb3IgYWdncmVnYXRpbmcgdGhlIGNodW5rcyB0b2dldGhlciBsYXRlci4gRWFjaFxuICAgIC8vIGV0YWcgcmVwcmVzZW50cyBhIHNpbmdsZSBjaHVuayBvZiB0aGUgZmlsZS5cbiAgICBjb25zdCBlVGFnczogUGFydFtdID0gW11cblxuICAgIGNvbnN0IHByZXZpb3VzVXBsb2FkSWQgPSBhd2FpdCB0aGlzLmZpbmRVcGxvYWRJZChidWNrZXROYW1lLCBvYmplY3ROYW1lKVxuICAgIGxldCB1cGxvYWRJZDogc3RyaW5nXG4gICAgaWYgKCFwcmV2aW91c1VwbG9hZElkKSB7XG4gICAgICB1cGxvYWRJZCA9IGF3YWl0IHRoaXMuaW5pdGlhdGVOZXdNdWx0aXBhcnRVcGxvYWQoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgaGVhZGVycylcbiAgICB9IGVsc2Uge1xuICAgICAgdXBsb2FkSWQgPSBwcmV2aW91c1VwbG9hZElkXG4gICAgICBjb25zdCBvbGRUYWdzID0gYXdhaXQgdGhpcy5saXN0UGFydHMoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcHJldmlvdXNVcGxvYWRJZClcbiAgICAgIG9sZFRhZ3MuZm9yRWFjaCgoZSkgPT4ge1xuICAgICAgICBvbGRUYWdzW2UucGFydF0gPSBlXG4gICAgICB9KVxuICAgIH1cblxuICAgIGNvbnN0IGNodW5raWVyID0gbmV3IEJsb2NrU3RyZWFtMih7IHNpemU6IHBhcnRTaXplLCB6ZXJvUGFkZGluZzogZmFsc2UgfSlcblxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdW51c2VkLXZhcnNcbiAgICBjb25zdCBbXywgb10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGJvZHkucGlwZShjaHVua2llcikub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgICBjaHVua2llci5vbignZW5kJywgcmVzb2x2ZSkub24oJ2Vycm9yJywgcmVqZWN0KVxuICAgICAgfSksXG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBsZXQgcGFydE51bWJlciA9IDFcblxuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIGNodW5raWVyKSB7XG4gICAgICAgICAgY29uc3QgbWQ1ID0gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShjaHVuaykuZGlnZXN0KClcblxuICAgICAgICAgIGNvbnN0IG9sZFBhcnQgPSBvbGRQYXJ0c1twYXJ0TnVtYmVyXVxuICAgICAgICAgIGlmIChvbGRQYXJ0KSB7XG4gICAgICAgICAgICBpZiAob2xkUGFydC5ldGFnID09PSBtZDUudG9TdHJpbmcoJ2hleCcpKSB7XG4gICAgICAgICAgICAgIGVUYWdzLnB1c2goeyBwYXJ0OiBwYXJ0TnVtYmVyLCBldGFnOiBvbGRQYXJ0LmV0YWcgfSlcbiAgICAgICAgICAgICAgcGFydE51bWJlcisrXG4gICAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcGFydE51bWJlcisrXG5cbiAgICAgICAgICAvLyBub3cgc3RhcnQgdG8gdXBsb2FkIG1pc3NpbmcgcGFydFxuICAgICAgICAgIGNvbnN0IG9wdGlvbnM6IFJlcXVlc3RPcHRpb24gPSB7XG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICAgICAgcXVlcnk6IHFzLnN0cmluZ2lmeSh7IHBhcnROdW1iZXIsIHVwbG9hZElkIH0pLFxuICAgICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBjaHVuay5sZW5ndGgsXG4gICAgICAgICAgICAgICdDb250ZW50LU1ENSc6IG1kNS50b1N0cmluZygnYmFzZTY0JyksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYnVja2V0TmFtZSxcbiAgICAgICAgICAgIG9iamVjdE5hbWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KG9wdGlvbnMsIGNodW5rKVxuXG4gICAgICAgICAgbGV0IGV0YWcgPSByZXNwb25zZS5oZWFkZXJzLmV0YWdcbiAgICAgICAgICBpZiAoZXRhZykge1xuICAgICAgICAgICAgZXRhZyA9IGV0YWcucmVwbGFjZSgvXlwiLywgJycpLnJlcGxhY2UoL1wiJC8sICcnKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBldGFnID0gJydcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBlVGFncy5wdXNoKHsgcGFydDogcGFydE51bWJlciwgZXRhZyB9KVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMuY29tcGxldGVNdWx0aXBhcnRVcGxvYWQoYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdXBsb2FkSWQsIGVUYWdzKVxuICAgICAgfSkoKSxcbiAgICBdKVxuXG4gICAgcmV0dXJuIG9cbiAgfVxuXG4gIGFzeW5jIHJlbW92ZUJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD5cbiAgcmVtb3ZlQnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBjYWxsYmFjazogTm9SZXN1bHRDYWxsYmFjayk6IHZvaWRcbiAgYXN5bmMgcmVtb3ZlQnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0RFTEVURSdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9LCAnJywgWzIwMCwgMjA0XSwgJycpXG4gIH1cblxuICBzZXRCdWNrZXRSZXBsaWNhdGlvbihidWNrZXROYW1lOiBzdHJpbmcsIHJlcGxpY2F0aW9uQ29uZmlnOiBSZXBsaWNhdGlvbkNvbmZpZ09wdHMpOiB2b2lkXG4gIGFzeW5jIHNldEJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZywgcmVwbGljYXRpb25Db25maWc6IFJlcGxpY2F0aW9uQ29uZmlnT3B0cyk6IFByb21pc2U8dm9pZD5cbiAgYXN5bmMgc2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nLCByZXBsaWNhdGlvbkNvbmZpZzogUmVwbGljYXRpb25Db25maWdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChyZXBsaWNhdGlvbkNvbmZpZykpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3JlcGxpY2F0aW9uQ29uZmlnIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXy5pc0VtcHR5KHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ1JvbGUgY2Fubm90IGJlIGVtcHR5JylcbiAgICAgIH0gZWxzZSBpZiAocmVwbGljYXRpb25Db25maWcucm9sZSAmJiAhaXNTdHJpbmcocmVwbGljYXRpb25Db25maWcucm9sZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignSW52YWxpZCB2YWx1ZSBmb3Igcm9sZScsIHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUpXG4gICAgICB9XG4gICAgICBpZiAoXy5pc0VtcHR5KHJlcGxpY2F0aW9uQ29uZmlnLnJ1bGVzKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdNaW5pbXVtIG9uZSByZXBsaWNhdGlvbiBydWxlIG11c3QgYmUgc3BlY2lmaWVkJylcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cblxuICAgIGNvbnN0IHJlcGxpY2F0aW9uUGFyYW1zQ29uZmlnID0ge1xuICAgICAgUmVwbGljYXRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICAgIFJvbGU6IHJlcGxpY2F0aW9uQ29uZmlnLnJvbGUsXG4gICAgICAgIFJ1bGU6IHJlcGxpY2F0aW9uQ29uZmlnLnJ1bGVzLFxuICAgICAgfSxcbiAgICB9XG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKHsgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sIGhlYWRsZXNzOiB0cnVlIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QocmVwbGljYXRpb25QYXJhbXNDb25maWcpXG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIGhlYWRlcnMgfSwgcGF5bG9hZClcbiAgfVxuXG4gIGdldEJ1Y2tldFJlcGxpY2F0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZyk6IHZvaWRcbiAgYXN5bmMgZ2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxSZXBsaWNhdGlvbkNvbmZpZz5cbiAgYXN5bmMgZ2V0QnVja2V0UmVwbGljYXRpb24oYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdyZXBsaWNhdGlvbidcblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwLCAyMDRdKVxuICAgIGNvbnN0IHhtbFJlc3VsdCA9IGF3YWl0IHJlYWRBc1N0cmluZyhodHRwUmVzKVxuICAgIHJldHVybiB4bWxQYXJzZXJzLnBhcnNlUmVwbGljYXRpb25Db25maWcoeG1sUmVzdWx0KVxuICB9XG5cbiAgZ2V0T2JqZWN0TGVnYWxIb2xkKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgZ2V0T3B0cz86IEdldE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gICAgY2FsbGJhY2s/OiBSZXN1bHRDYWxsYmFjazxMRUdBTF9IT0xEX1NUQVRVUz4sXG4gICk6IFByb21pc2U8TEVHQUxfSE9MRF9TVEFUVVM+XG4gIGFzeW5jIGdldE9iamVjdExlZ2FsSG9sZChcbiAgICBidWNrZXROYW1lOiBzdHJpbmcsXG4gICAgb2JqZWN0TmFtZTogc3RyaW5nLFxuICAgIGdldE9wdHM/OiBHZXRPYmplY3RMZWdhbEhvbGRPcHRpb25zLFxuICApOiBQcm9taXNlPExFR0FMX0hPTERfU1RBVFVTPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG5cbiAgICBpZiAoZ2V0T3B0cykge1xuICAgICAgaWYgKCFpc09iamVjdChnZXRPcHRzKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdnZXRPcHRzIHNob3VsZCBiZSBvZiB0eXBlIFwiT2JqZWN0XCInKVxuICAgICAgfSBlbHNlIGlmIChPYmplY3Qua2V5cyhnZXRPcHRzKS5sZW5ndGggPiAwICYmIGdldE9wdHMudmVyc2lvbklkICYmICFpc1N0cmluZyhnZXRPcHRzLnZlcnNpb25JZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmVyc2lvbklkIHNob3VsZCBiZSBvZiB0eXBlIHN0cmluZy46JywgZ2V0T3B0cy52ZXJzaW9uSWQpXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBsZXQgcXVlcnkgPSAnbGVnYWwtaG9sZCdcblxuICAgIGlmIChnZXRPcHRzPy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ICs9IGAmdmVyc2lvbklkPSR7Z2V0T3B0cy52ZXJzaW9uSWR9YFxuICAgIH1cblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjAwXSlcbiAgICBjb25zdCBzdHJSZXMgPSBhd2FpdCByZWFkQXNTdHJpbmcoaHR0cFJlcylcbiAgICByZXR1cm4gcGFyc2VPYmplY3RMZWdhbEhvbGRDb25maWcoc3RyUmVzKVxuICB9XG5cbiAgc2V0T2JqZWN0TGVnYWxIb2xkKGJ1Y2tldE5hbWU6IHN0cmluZywgb2JqZWN0TmFtZTogc3RyaW5nLCBzZXRPcHRzPzogUHV0T2JqZWN0TGVnYWxIb2xkT3B0aW9ucyk6IHZvaWRcbiAgYXN5bmMgc2V0T2JqZWN0TGVnYWxIb2xkKFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgc2V0T3B0cyA9IHtcbiAgICAgIHN0YXR1czogTEVHQUxfSE9MRF9TVEFUVVMuRU5BQkxFRCxcbiAgICB9IGFzIFB1dE9iamVjdExlZ2FsSG9sZE9wdGlvbnMsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghaXNWYWxpZE9iamVjdE5hbWUob2JqZWN0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZE9iamVjdE5hbWVFcnJvcihgSW52YWxpZCBvYmplY3QgbmFtZTogJHtvYmplY3ROYW1lfWApXG4gICAgfVxuXG4gICAgaWYgKCFpc09iamVjdChzZXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignc2V0T3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIk9iamVjdFwiJylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFbTEVHQUxfSE9MRF9TVEFUVVMuRU5BQkxFRCwgTEVHQUxfSE9MRF9TVEFUVVMuRElTQUJMRURdLmluY2x1ZGVzKHNldE9wdHM/LnN0YXR1cykpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBzdGF0dXM6ICcgKyBzZXRPcHRzLnN0YXR1cylcbiAgICAgIH1cbiAgICAgIGlmIChzZXRPcHRzLnZlcnNpb25JZCAmJiAhc2V0T3B0cy52ZXJzaW9uSWQubGVuZ3RoKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZlcnNpb25JZCBzaG91bGQgYmUgb2YgdHlwZSBzdHJpbmcuOicgKyBzZXRPcHRzLnZlcnNpb25JZClcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnUFVUJ1xuICAgIGxldCBxdWVyeSA9ICdsZWdhbC1ob2xkJ1xuXG4gICAgaWYgKHNldE9wdHMudmVyc2lvbklkKSB7XG4gICAgICBxdWVyeSArPSBgJnZlcnNpb25JZD0ke3NldE9wdHMudmVyc2lvbklkfWBcbiAgICB9XG5cbiAgICBjb25zdCBjb25maWcgPSB7XG4gICAgICBTdGF0dXM6IHNldE9wdHMuc3RhdHVzLFxuICAgIH1cblxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoeyByb290TmFtZTogJ0xlZ2FsSG9sZCcsIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LCBoZWFkbGVzczogdHJ1ZSB9KVxuICAgIGNvbnN0IHBheWxvYWQgPSBidWlsZGVyLmJ1aWxkT2JqZWN0KGNvbmZpZylcbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5LCBoZWFkZXJzIH0sIHBheWxvYWQpXG4gIH1cblxuICAvKipcbiAgICogR2V0IFRhZ3MgYXNzb2NpYXRlZCB3aXRoIGEgQnVja2V0XG4gICAqL1xuICBhc3luYyBnZXRCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8VGFnW10+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoYEludmFsaWQgYnVja2V0IG5hbWU6ICR7YnVja2V0TmFtZX1gKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdHRVQnXG4gICAgY29uc3QgcXVlcnkgPSAndGFnZ2luZydcbiAgICBjb25zdCByZXF1ZXN0T3B0aW9ucyA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyhyZXF1ZXN0T3B0aW9ucylcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEFzU3RyaW5nKHJlc3BvbnNlKVxuICAgIHJldHVybiB4bWxQYXJzZXJzLnBhcnNlVGFnZ2luZyhib2R5KVxuICB9XG5cbiAgLyoqXG4gICAqICBHZXQgdGhlIHRhZ3MgYXNzb2NpYXRlZCB3aXRoIGEgYnVja2V0IE9SIGFuIG9iamVjdFxuICAgKi9cbiAgYXN5bmMgZ2V0T2JqZWN0VGFnZ2luZyhidWNrZXROYW1lOiBzdHJpbmcsIG9iamVjdE5hbWU6IHN0cmluZywgZ2V0T3B0czogVmVyc2lvbklkZW50aWZpY2F0b3IgPSB7fSk6IFByb21pc2U8VGFnW10+IHtcbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGxldCBxdWVyeSA9ICd0YWdnaW5nJ1xuXG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChnZXRPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcignZ2V0T3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBpZiAoZ2V0T3B0cyAmJiBnZXRPcHRzLnZlcnNpb25JZCkge1xuICAgICAgcXVlcnkgPSBgJHtxdWVyeX0mdmVyc2lvbklkPSR7Z2V0T3B0cy52ZXJzaW9uSWR9YFxuICAgIH1cbiAgICBjb25zdCByZXF1ZXN0T3B0aW9uczogUmVxdWVzdE9wdGlvbiA9IHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSB9XG4gICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgIHJlcXVlc3RPcHRpb25zWydvYmplY3ROYW1lJ10gPSBvYmplY3ROYW1lXG4gICAgfVxuXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMocmVxdWVzdE9wdGlvbnMpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXNwb25zZSlcbiAgICByZXR1cm4geG1sUGFyc2Vycy5wYXJzZVRhZ2dpbmcoYm9keSlcbiAgfVxuXG4gIC8qKlxuICAgKiAgU2V0IHRoZSBwb2xpY3kgb24gYSBidWNrZXQgb3IgYW4gb2JqZWN0IHByZWZpeC5cbiAgICovXG4gIGFzeW5jIHNldEJ1Y2tldFBvbGljeShidWNrZXROYW1lOiBzdHJpbmcsIHBvbGljeTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgLy8gVmFsaWRhdGUgYXJndW1lbnRzLlxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcihgSW52YWxpZCBidWNrZXQgbmFtZTogJHtidWNrZXROYW1lfWApXG4gICAgfVxuICAgIGlmICghaXNTdHJpbmcocG9saWN5KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0UG9saWN5RXJyb3IoYEludmFsaWQgYnVja2V0IHBvbGljeTogJHtwb2xpY3l9IC0gbXVzdCBiZSBcInN0cmluZ1wiYClcbiAgICB9XG5cbiAgICBjb25zdCBxdWVyeSA9ICdwb2xpY3knXG5cbiAgICBsZXQgbWV0aG9kID0gJ0RFTEVURSdcbiAgICBpZiAocG9saWN5KSB7XG4gICAgICBtZXRob2QgPSAnUFVUJ1xuICAgIH1cblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBvbGljeSwgWzIwNF0sICcnKVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgcG9saWN5IG9uIGEgYnVja2V0IG9yIGFuIG9iamVjdCBwcmVmaXguXG4gICAqL1xuICBhc3luYyBnZXRCdWNrZXRQb2xpY3koYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICAvLyBWYWxpZGF0ZSBhcmd1bWVudHMuXG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ3BvbGljeSdcbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgcmV0dXJuIGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gIH1cblxuICBhc3luYyBwdXRPYmplY3RSZXRlbnRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJldGVudGlvbk9wdHM6IFJldGVudGlvbiA9IHt9KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdChyZXRlbnRpb25PcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigncmV0ZW50aW9uT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJldGVudGlvbk9wdHMuZ292ZXJuYW5jZUJ5cGFzcyAmJiAhaXNCb29sZWFuKHJldGVudGlvbk9wdHMuZ292ZXJuYW5jZUJ5cGFzcykpIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihgSW52YWxpZCB2YWx1ZSBmb3IgZ292ZXJuYW5jZUJ5cGFzczogJHtyZXRlbnRpb25PcHRzLmdvdmVybmFuY2VCeXBhc3N9YClcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgcmV0ZW50aW9uT3B0cy5tb2RlICYmXG4gICAgICAgICFbUkVURU5USU9OX01PREVTLkNPTVBMSUFOQ0UsIFJFVEVOVElPTl9NT0RFUy5HT1ZFUk5BTkNFXS5pbmNsdWRlcyhyZXRlbnRpb25PcHRzLm1vZGUpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcihgSW52YWxpZCBvYmplY3QgcmV0ZW50aW9uIG1vZGU6ICR7cmV0ZW50aW9uT3B0cy5tb2RlfWApXG4gICAgICB9XG4gICAgICBpZiAocmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGUgJiYgIWlzU3RyaW5nKHJldGVudGlvbk9wdHMucmV0YWluVW50aWxEYXRlKSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKGBJbnZhbGlkIHZhbHVlIGZvciByZXRhaW5VbnRpbERhdGU6ICR7cmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGV9YClcbiAgICAgIH1cbiAgICAgIGlmIChyZXRlbnRpb25PcHRzLnZlcnNpb25JZCAmJiAhaXNTdHJpbmcocmV0ZW50aW9uT3B0cy52ZXJzaW9uSWQpKSB7XG4gICAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoYEludmFsaWQgdmFsdWUgZm9yIHZlcnNpb25JZDogJHtyZXRlbnRpb25PcHRzLnZlcnNpb25JZH1gKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgbGV0IHF1ZXJ5ID0gJ3JldGVudGlvbidcblxuICAgIGNvbnN0IGhlYWRlcnM6IFJlcXVlc3RIZWFkZXJzID0ge31cbiAgICBpZiAocmV0ZW50aW9uT3B0cy5nb3Zlcm5hbmNlQnlwYXNzKSB7XG4gICAgICBoZWFkZXJzWydYLUFtei1CeXBhc3MtR292ZXJuYW5jZS1SZXRlbnRpb24nXSA9IHRydWVcbiAgICB9XG5cbiAgICBjb25zdCBidWlsZGVyID0gbmV3IHhtbDJqcy5CdWlsZGVyKHsgcm9vdE5hbWU6ICdSZXRlbnRpb24nLCByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSwgaGVhZGxlc3M6IHRydWUgfSlcbiAgICBjb25zdCBwYXJhbXM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuXG4gICAgaWYgKHJldGVudGlvbk9wdHMubW9kZSkge1xuICAgICAgcGFyYW1zLk1vZGUgPSByZXRlbnRpb25PcHRzLm1vZGVcbiAgICB9XG4gICAgaWYgKHJldGVudGlvbk9wdHMucmV0YWluVW50aWxEYXRlKSB7XG4gICAgICBwYXJhbXMuUmV0YWluVW50aWxEYXRlID0gcmV0ZW50aW9uT3B0cy5yZXRhaW5VbnRpbERhdGVcbiAgICB9XG4gICAgaWYgKHJldGVudGlvbk9wdHMudmVyc2lvbklkKSB7XG4gICAgICBxdWVyeSArPSBgJnZlcnNpb25JZD0ke3JldGVudGlvbk9wdHMudmVyc2lvbklkfWBcbiAgICB9XG5cbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChwYXJhbXMpXG5cbiAgICBoZWFkZXJzWydDb250ZW50LU1ENSddID0gdG9NZDUocGF5bG9hZClcbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBvYmplY3ROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkLCBbMjAwLCAyMDRdKVxuICB9XG5cbiAgZ2V0T2JqZWN0TG9ja0NvbmZpZyhidWNrZXROYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBSZXN1bHRDYWxsYmFjazxPYmplY3RMb2NrSW5mbz4pOiB2b2lkXG4gIGdldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nKTogdm9pZFxuICBhc3luYyBnZXRPYmplY3RMb2NrQ29uZmlnKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8T2JqZWN0TG9ja0luZm8+XG4gIGFzeW5jIGdldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICdvYmplY3QtbG9jaydcblxuICAgIGNvbnN0IGh0dHBSZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgeG1sUmVzdWx0ID0gYXdhaXQgcmVhZEFzU3RyaW5nKGh0dHBSZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VPYmplY3RMb2NrQ29uZmlnKHhtbFJlc3VsdClcbiAgfVxuXG4gIHNldE9iamVjdExvY2tDb25maWcoYnVja2V0TmFtZTogc3RyaW5nLCBsb2NrQ29uZmlnT3B0czogT21pdDxPYmplY3RMb2NrSW5mbywgJ29iamVjdExvY2tFbmFibGVkJz4pOiB2b2lkXG4gIGFzeW5jIHNldE9iamVjdExvY2tDb25maWcoXG4gICAgYnVja2V0TmFtZTogc3RyaW5nLFxuICAgIGxvY2tDb25maWdPcHRzOiBPbWl0PE9iamVjdExvY2tJbmZvLCAnb2JqZWN0TG9ja0VuYWJsZWQnPixcbiAgKTogUHJvbWlzZTx2b2lkPlxuICBhc3luYyBzZXRPYmplY3RMb2NrQ29uZmlnKGJ1Y2tldE5hbWU6IHN0cmluZywgbG9ja0NvbmZpZ09wdHM6IE9taXQ8T2JqZWN0TG9ja0luZm8sICdvYmplY3RMb2NrRW5hYmxlZCc+KSB7XG4gICAgY29uc3QgcmV0ZW50aW9uTW9kZXMgPSBbUkVURU5USU9OX01PREVTLkNPTVBMSUFOQ0UsIFJFVEVOVElPTl9NT0RFUy5HT1ZFUk5BTkNFXVxuICAgIGNvbnN0IHZhbGlkVW5pdHMgPSBbUkVURU5USU9OX1ZBTElESVRZX1VOSVRTLkRBWVMsIFJFVEVOVElPTl9WQUxJRElUWV9VTklUUy5ZRUFSU11cblxuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuXG4gICAgaWYgKGxvY2tDb25maWdPcHRzLm1vZGUgJiYgIXJldGVudGlvbk1vZGVzLmluY2x1ZGVzKGxvY2tDb25maWdPcHRzLm1vZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBsb2NrQ29uZmlnT3B0cy5tb2RlIHNob3VsZCBiZSBvbmUgb2YgJHtyZXRlbnRpb25Nb2Rlc31gKVxuICAgIH1cbiAgICBpZiAobG9ja0NvbmZpZ09wdHMudW5pdCAmJiAhdmFsaWRVbml0cy5pbmNsdWRlcyhsb2NrQ29uZmlnT3B0cy51bml0KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgbG9ja0NvbmZpZ09wdHMudW5pdCBzaG91bGQgYmUgb25lIG9mICR7dmFsaWRVbml0c31gKVxuICAgIH1cbiAgICBpZiAobG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgJiYgIWlzTnVtYmVyKGxvY2tDb25maWdPcHRzLnZhbGlkaXR5KSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgbG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgc2hvdWxkIGJlIGEgbnVtYmVyYClcbiAgICB9XG5cbiAgICBjb25zdCBtZXRob2QgPSAnUFVUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ29iamVjdC1sb2NrJ1xuXG4gICAgY29uc3QgY29uZmlnOiBPYmplY3RMb2NrQ29uZmlnUGFyYW0gPSB7XG4gICAgICBPYmplY3RMb2NrRW5hYmxlZDogJ0VuYWJsZWQnLFxuICAgIH1cbiAgICBjb25zdCBjb25maWdLZXlzID0gT2JqZWN0LmtleXMobG9ja0NvbmZpZ09wdHMpXG5cbiAgICBjb25zdCBpc0FsbEtleXNTZXQgPSBbJ3VuaXQnLCAnbW9kZScsICd2YWxpZGl0eSddLmV2ZXJ5KChsY2spID0+IGNvbmZpZ0tleXMuaW5jbHVkZXMobGNrKSlcbiAgICAvLyBDaGVjayBpZiBrZXlzIGFyZSBwcmVzZW50IGFuZCBhbGwga2V5cyBhcmUgcHJlc2VudC5cbiAgICBpZiAoY29uZmlnS2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIWlzQWxsS2V5c1NldCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBsb2NrQ29uZmlnT3B0cy5tb2RlLGxvY2tDb25maWdPcHRzLnVuaXQsbG9ja0NvbmZpZ09wdHMudmFsaWRpdHkgYWxsIHRoZSBwcm9wZXJ0aWVzIHNob3VsZCBiZSBzcGVjaWZpZWQuYCxcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uZmlnLlJ1bGUgPSB7XG4gICAgICAgICAgRGVmYXVsdFJldGVudGlvbjoge30sXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvY2tDb25maWdPcHRzLm1vZGUpIHtcbiAgICAgICAgICBjb25maWcuUnVsZS5EZWZhdWx0UmV0ZW50aW9uLk1vZGUgPSBsb2NrQ29uZmlnT3B0cy5tb2RlXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGxvY2tDb25maWdPcHRzLnVuaXQgPT09IFJFVEVOVElPTl9WQUxJRElUWV9VTklUUy5EQVlTKSB7XG4gICAgICAgICAgY29uZmlnLlJ1bGUuRGVmYXVsdFJldGVudGlvbi5EYXlzID0gbG9ja0NvbmZpZ09wdHMudmFsaWRpdHlcbiAgICAgICAgfSBlbHNlIGlmIChsb2NrQ29uZmlnT3B0cy51bml0ID09PSBSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMuWUVBUlMpIHtcbiAgICAgICAgICBjb25maWcuUnVsZS5EZWZhdWx0UmV0ZW50aW9uLlllYXJzID0gbG9ja0NvbmZpZ09wdHMudmFsaWRpdHlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdPYmplY3RMb2NrQ29uZmlndXJhdGlvbicsXG4gICAgICByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QoY29uZmlnKVxuXG4gICAgY29uc3QgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMgPSB7fVxuICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSB0b01kNShwYXlsb2FkKVxuXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdCh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnksIGhlYWRlcnMgfSwgcGF5bG9hZClcbiAgfVxuXG4gIGFzeW5jIGdldEJ1Y2tldFZlcnNpb25pbmcoYnVja2V0TmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgY29uc3QgbWV0aG9kID0gJ0dFVCdcbiAgICBjb25zdCBxdWVyeSA9ICd2ZXJzaW9uaW5nJ1xuXG4gICAgY29uc3QgaHR0cFJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSlcbiAgICBjb25zdCB4bWxSZXN1bHQgPSBhd2FpdCByZWFkQXNTdHJpbmcoaHR0cFJlcylcbiAgICByZXR1cm4gYXdhaXQgeG1sUGFyc2Vycy5wYXJzZUJ1Y2tldFZlcnNpb25pbmdDb25maWcoeG1sUmVzdWx0KVxuICB9XG5cbiAgYXN5bmMgc2V0QnVja2V0VmVyc2lvbmluZyhidWNrZXROYW1lOiBzdHJpbmcsIHZlcnNpb25Db25maWc6IEJ1Y2tldFZlcnNpb25pbmdDb25maWd1cmF0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFPYmplY3Qua2V5cyh2ZXJzaW9uQ29uZmlnKS5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ3ZlcnNpb25Db25maWcgc2hvdWxkIGJlIG9mIHR5cGUgXCJvYmplY3RcIicpXG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICd2ZXJzaW9uaW5nJ1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdWZXJzaW9uaW5nQ29uZmlndXJhdGlvbicsXG4gICAgICByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgIH0pXG4gICAgY29uc3QgcGF5bG9hZCA9IGJ1aWxkZXIuYnVpbGRPYmplY3QodmVyc2lvbkNvbmZpZylcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIHNldFRhZ2dpbmcodGFnZ2luZ1BhcmFtczogUHV0VGFnZ2luZ1BhcmFtcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHsgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgdGFncywgcHV0T3B0cyB9ID0gdGFnZ2luZ1BhcmFtc1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgbGV0IHF1ZXJ5ID0gJ3RhZ2dpbmcnXG5cbiAgICBpZiAocHV0T3B0cyAmJiBwdXRPcHRzPy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcnl9JnZlcnNpb25JZD0ke3B1dE9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgdGFnc0xpc3QgPSBbXVxuICAgIGZvciAoY29uc3QgW2tleSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKHRhZ3MpKSB7XG4gICAgICB0YWdzTGlzdC5wdXNoKHsgS2V5OiBrZXksIFZhbHVlOiB2YWx1ZSB9KVxuICAgIH1cbiAgICBjb25zdCB0YWdnaW5nQ29uZmlnID0ge1xuICAgICAgVGFnZ2luZzoge1xuICAgICAgICBUYWdTZXQ6IHtcbiAgICAgICAgICBUYWc6IHRhZ3NMaXN0LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9XG4gICAgY29uc3QgaGVhZGVycyA9IHt9IGFzIFJlcXVlc3RIZWFkZXJzXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyB4bWwyanMuQnVpbGRlcih7IGhlYWRsZXNzOiB0cnVlLCByZW5kZXJPcHRzOiB7IHByZXR0eTogZmFsc2UgfSB9KVxuICAgIGNvbnN0IHBheWxvYWRCdWYgPSBCdWZmZXIuZnJvbShidWlsZGVyLmJ1aWxkT2JqZWN0KHRhZ2dpbmdDb25maWcpKVxuICAgIGNvbnN0IHJlcXVlc3RPcHRpb25zID0ge1xuICAgICAgbWV0aG9kLFxuICAgICAgYnVja2V0TmFtZSxcbiAgICAgIHF1ZXJ5LFxuICAgICAgaGVhZGVycyxcblxuICAgICAgLi4uKG9iamVjdE5hbWUgJiYgeyBvYmplY3ROYW1lOiBvYmplY3ROYW1lIH0pLFxuICAgIH1cblxuICAgIGhlYWRlcnNbJ0NvbnRlbnQtTUQ1J10gPSB0b01kNShwYXlsb2FkQnVmKVxuXG4gICAgYXdhaXQgdGhpcy5tYWtlUmVxdWVzdEFzeW5jT21pdChyZXF1ZXN0T3B0aW9ucywgcGF5bG9hZEJ1ZilcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgcmVtb3ZlVGFnZ2luZyh7IGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHJlbW92ZU9wdHMgfTogUmVtb3ZlVGFnZ2luZ1BhcmFtcyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgbGV0IHF1ZXJ5ID0gJ3RhZ2dpbmcnXG5cbiAgICBpZiAocmVtb3ZlT3B0cyAmJiBPYmplY3Qua2V5cyhyZW1vdmVPcHRzKS5sZW5ndGggJiYgcmVtb3ZlT3B0cy52ZXJzaW9uSWQpIHtcbiAgICAgIHF1ZXJ5ID0gYCR7cXVlcnl9JnZlcnNpb25JZD0ke3JlbW92ZU9wdHMudmVyc2lvbklkfWBcbiAgICB9XG4gICAgY29uc3QgcmVxdWVzdE9wdGlvbnMgPSB7IG1ldGhvZCwgYnVja2V0TmFtZSwgb2JqZWN0TmFtZSwgcXVlcnkgfVxuXG4gICAgaWYgKG9iamVjdE5hbWUpIHtcbiAgICAgIHJlcXVlc3RPcHRpb25zWydvYmplY3ROYW1lJ10gPSBvYmplY3ROYW1lXG4gICAgfVxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyhyZXF1ZXN0T3B0aW9ucywgJycsIFsyMDAsIDIwNF0pXG4gIH1cblxuICBhc3luYyBzZXRCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZywgdGFnczogVGFnKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc09iamVjdCh0YWdzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigndGFncyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG4gICAgaWYgKE9iamVjdC5rZXlzKHRhZ3MpLmxlbmd0aCA+IDEwKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdtYXhpbXVtIHRhZ3MgYWxsb3dlZCBpcyAxMFwiJylcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnNldFRhZ2dpbmcoeyBidWNrZXROYW1lLCB0YWdzIH0pXG4gIH1cblxuICBhc3luYyByZW1vdmVCdWNrZXRUYWdnaW5nKGJ1Y2tldE5hbWU6IHN0cmluZykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGF3YWl0IHRoaXMucmVtb3ZlVGFnZ2luZyh7IGJ1Y2tldE5hbWUgfSlcbiAgfVxuXG4gIGFzeW5jIHNldE9iamVjdFRhZ2dpbmcoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHRhZ3M6IFRhZ3MsIHB1dE9wdHM6IFRhZ2dpbmdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG5cbiAgICBpZiAoIWlzT2JqZWN0KHRhZ3MpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCd0YWdzIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgIH1cbiAgICBpZiAoT2JqZWN0LmtleXModGFncykubGVuZ3RoID4gMTApIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEFyZ3VtZW50RXJyb3IoJ01heGltdW0gdGFncyBhbGxvd2VkIGlzIDEwXCInKVxuICAgIH1cblxuICAgIGF3YWl0IHRoaXMuc2V0VGFnZ2luZyh7IGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHRhZ3MsIHB1dE9wdHMgfSlcbiAgfVxuXG4gIGFzeW5jIHJlbW92ZU9iamVjdFRhZ2dpbmcoYnVja2V0TmFtZTogc3RyaW5nLCBvYmplY3ROYW1lOiBzdHJpbmcsIHJlbW92ZU9wdHM6IFRhZ2dpbmdPcHRzKSB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIGJ1Y2tldCBuYW1lOiAnICsgYnVja2V0TmFtZSlcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKCdJbnZhbGlkIG9iamVjdCBuYW1lOiAnICsgb2JqZWN0TmFtZSlcbiAgICB9XG4gICAgaWYgKHJlbW92ZU9wdHMgJiYgT2JqZWN0LmtleXMocmVtb3ZlT3B0cykubGVuZ3RoICYmICFpc09iamVjdChyZW1vdmVPcHRzKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQXJndW1lbnRFcnJvcigncmVtb3ZlT3B0cyBzaG91bGQgYmUgb2YgdHlwZSBcIm9iamVjdFwiJylcbiAgICB9XG5cbiAgICBhd2FpdCB0aGlzLnJlbW92ZVRhZ2dpbmcoeyBidWNrZXROYW1lLCBvYmplY3ROYW1lLCByZW1vdmVPcHRzIH0pXG4gIH1cblxuICBhc3luYyBzZWxlY3RPYmplY3RDb250ZW50KFxuICAgIGJ1Y2tldE5hbWU6IHN0cmluZyxcbiAgICBvYmplY3ROYW1lOiBzdHJpbmcsXG4gICAgc2VsZWN0T3B0czogU2VsZWN0T3B0aW9ucyxcbiAgKTogUHJvbWlzZTxTZWxlY3RSZXN1bHRzIHwgdW5kZWZpbmVkPiB7XG4gICAgaWYgKCFpc1ZhbGlkQnVja2V0TmFtZShidWNrZXROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkQnVja2V0TmFtZUVycm9yKGBJbnZhbGlkIGJ1Y2tldCBuYW1lOiAke2J1Y2tldE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkT2JqZWN0TmFtZUVycm9yKGBJbnZhbGlkIG9iamVjdCBuYW1lOiAke29iamVjdE5hbWV9YClcbiAgICB9XG4gICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cykpIHtcbiAgICAgIGlmICghaXNTdHJpbmcoc2VsZWN0T3B0cy5leHByZXNzaW9uKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdzcWxFeHByZXNzaW9uIHNob3VsZCBiZSBvZiB0eXBlIFwic3RyaW5nXCInKVxuICAgICAgfVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cy5pbnB1dFNlcmlhbGl6YXRpb24pKSB7XG4gICAgICAgIGlmICghaXNPYmplY3Qoc2VsZWN0T3B0cy5pbnB1dFNlcmlhbGl6YXRpb24pKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaW5wdXRTZXJpYWxpemF0aW9uIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdpbnB1dFNlcmlhbGl6YXRpb24gaXMgcmVxdWlyZWQnKVxuICAgICAgfVxuICAgICAgaWYgKCFfLmlzRW1wdHkoc2VsZWN0T3B0cy5vdXRwdXRTZXJpYWxpemF0aW9uKSkge1xuICAgICAgICBpZiAoIWlzT2JqZWN0KHNlbGVjdE9wdHMub3V0cHV0U2VyaWFsaXphdGlvbikpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvdXRwdXRTZXJpYWxpemF0aW9uIHNob3VsZCBiZSBvZiB0eXBlIFwib2JqZWN0XCInKVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdvdXRwdXRTZXJpYWxpemF0aW9uIGlzIHJlcXVpcmVkJylcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsaWQgc2VsZWN0IGNvbmZpZ3VyYXRpb24gaXMgcmVxdWlyZWQnKVxuICAgIH1cblxuICAgIGNvbnN0IG1ldGhvZCA9ICdQT1NUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gYHNlbGVjdCZzZWxlY3QtdHlwZT0yYFxuXG4gICAgY29uc3QgY29uZmlnOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdID0gW1xuICAgICAge1xuICAgICAgICBFeHByZXNzaW9uOiBzZWxlY3RPcHRzLmV4cHJlc3Npb24sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBFeHByZXNzaW9uVHlwZTogc2VsZWN0T3B0cy5leHByZXNzaW9uVHlwZSB8fCAnU1FMJyxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIElucHV0U2VyaWFsaXphdGlvbjogW3NlbGVjdE9wdHMuaW5wdXRTZXJpYWxpemF0aW9uXSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIE91dHB1dFNlcmlhbGl6YXRpb246IFtzZWxlY3RPcHRzLm91dHB1dFNlcmlhbGl6YXRpb25dLFxuICAgICAgfSxcbiAgICBdXG5cbiAgICAvLyBPcHRpb25hbFxuICAgIGlmIChzZWxlY3RPcHRzLnJlcXVlc3RQcm9ncmVzcykge1xuICAgICAgY29uZmlnLnB1c2goeyBSZXF1ZXN0UHJvZ3Jlc3M6IHNlbGVjdE9wdHM/LnJlcXVlc3RQcm9ncmVzcyB9KVxuICAgIH1cbiAgICAvLyBPcHRpb25hbFxuICAgIGlmIChzZWxlY3RPcHRzLnNjYW5SYW5nZSkge1xuICAgICAgY29uZmlnLnB1c2goeyBTY2FuUmFuZ2U6IHNlbGVjdE9wdHMuc2NhblJhbmdlIH0pXG4gICAgfVxuXG4gICAgY29uc3QgYnVpbGRlciA9IG5ldyB4bWwyanMuQnVpbGRlcih7XG4gICAgICByb290TmFtZTogJ1NlbGVjdE9iamVjdENvbnRlbnRSZXF1ZXN0JyxcbiAgICAgIHJlbmRlck9wdHM6IHsgcHJldHR5OiBmYWxzZSB9LFxuICAgICAgaGVhZGxlc3M6IHRydWUsXG4gICAgfSlcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChjb25maWcpXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIG9iamVjdE5hbWUsIHF1ZXJ5IH0sIHBheWxvYWQpXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc0J1ZmZlcihyZXMpXG4gICAgcmV0dXJuIHBhcnNlU2VsZWN0T2JqZWN0Q29udGVudFJlc3BvbnNlKGJvZHkpXG4gIH1cblxuICBwcml2YXRlIGFzeW5jIGFwcGx5QnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWU6IHN0cmluZywgcG9saWN5Q29uZmlnOiBMaWZlQ3ljbGVDb25maWdQYXJhbSk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG1ldGhvZCA9ICdQVVQnXG4gICAgY29uc3QgcXVlcnkgPSAnbGlmZWN5Y2xlJ1xuXG4gICAgY29uc3QgaGVhZGVyczogUmVxdWVzdEhlYWRlcnMgPSB7fVxuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdMaWZlY3ljbGVDb25maWd1cmF0aW9uJyxcbiAgICAgIGhlYWRsZXNzOiB0cnVlLFxuICAgICAgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sXG4gICAgfSlcbiAgICBjb25zdCBwYXlsb2FkID0gYnVpbGRlci5idWlsZE9iamVjdChwb2xpY3lDb25maWcpXG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkKVxuICB9XG5cbiAgYXN5bmMgcmVtb3ZlQnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSAnbGlmZWN5Y2xlJ1xuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSlcbiAgfVxuXG4gIGFzeW5jIHNldEJ1Y2tldExpZmVjeWNsZShidWNrZXROYW1lOiBzdHJpbmcsIGxpZmVDeWNsZUNvbmZpZzogTGlmZUN5Y2xlQ29uZmlnUGFyYW0pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBpZiAoXy5pc0VtcHR5KGxpZmVDeWNsZUNvbmZpZykpIHtcbiAgICAgIGF3YWl0IHRoaXMucmVtb3ZlQnVja2V0TGlmZWN5Y2xlKGJ1Y2tldE5hbWUpXG4gICAgfSBlbHNlIHtcbiAgICAgIGF3YWl0IHRoaXMuYXBwbHlCdWNrZXRMaWZlY3ljbGUoYnVja2V0TmFtZSwgbGlmZUN5Y2xlQ29uZmlnKVxuICAgIH1cbiAgfVxuXG4gIGFzeW5jIGdldEJ1Y2tldExpZmVjeWNsZShidWNrZXROYW1lOiBzdHJpbmcpOiBQcm9taXNlPExpZmVjeWNsZUNvbmZpZyB8IG51bGw+IHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ2xpZmVjeWNsZSdcblxuICAgIGNvbnN0IHJlcyA9IGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luYyh7IG1ldGhvZCwgYnVja2V0TmFtZSwgcXVlcnkgfSlcbiAgICBjb25zdCBib2R5ID0gYXdhaXQgcmVhZEFzU3RyaW5nKHJlcylcbiAgICByZXR1cm4geG1sUGFyc2Vycy5wYXJzZUxpZmVjeWNsZUNvbmZpZyhib2R5KVxuICB9XG4gIGFzeW5jIHNldEJ1Y2tldEVuY3J5cHRpb24oYnVja2V0TmFtZTogc3RyaW5nLCBlbmNyeXB0aW9uQ29uZmlnPzogRW5jcnlwdGlvbkNvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGlmICghXy5pc0VtcHR5KGVuY3J5cHRpb25Db25maWcpICYmIGVuY3J5cHRpb25Db25maWcuUnVsZS5sZW5ndGggPiAxKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRBcmd1bWVudEVycm9yKCdJbnZhbGlkIFJ1bGUgbGVuZ3RoLiBPbmx5IG9uZSBydWxlIGlzIGFsbG93ZWQuOiAnICsgZW5jcnlwdGlvbkNvbmZpZy5SdWxlKVxuICAgIH1cblxuICAgIGxldCBlbmNyeXB0aW9uT2JqID0gZW5jcnlwdGlvbkNvbmZpZ1xuICAgIGlmIChfLmlzRW1wdHkoZW5jcnlwdGlvbkNvbmZpZykpIHtcbiAgICAgIGVuY3J5cHRpb25PYmogPSB7XG4gICAgICAgIC8vIERlZmF1bHQgTWluSU8gU2VydmVyIFN1cHBvcnRlZCBSdWxlXG4gICAgICAgIFJ1bGU6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBBcHBseVNlcnZlclNpZGVFbmNyeXB0aW9uQnlEZWZhdWx0OiB7XG4gICAgICAgICAgICAgIFNTRUFsZ29yaXRobTogJ0FFUzI1NicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbWV0aG9kID0gJ1BVVCdcbiAgICBjb25zdCBxdWVyeSA9ICdlbmNyeXB0aW9uJ1xuICAgIGNvbnN0IGJ1aWxkZXIgPSBuZXcgeG1sMmpzLkJ1aWxkZXIoe1xuICAgICAgcm9vdE5hbWU6ICdTZXJ2ZXJTaWRlRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb24nLFxuICAgICAgcmVuZGVyT3B0czogeyBwcmV0dHk6IGZhbHNlIH0sXG4gICAgICBoZWFkbGVzczogdHJ1ZSxcbiAgICB9KVxuICAgIGNvbnN0IHBheWxvYWQgPSBidWlsZGVyLmJ1aWxkT2JqZWN0KGVuY3J5cHRpb25PYmopXG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZXF1ZXN0SGVhZGVycyA9IHt9XG4gICAgaGVhZGVyc1snQ29udGVudC1NRDUnXSA9IHRvTWQ1KHBheWxvYWQpXG5cbiAgICBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmNPbWl0KHsgbWV0aG9kLCBidWNrZXROYW1lLCBxdWVyeSwgaGVhZGVycyB9LCBwYXlsb2FkKVxuICB9XG5cbiAgYXN5bmMgZ2V0QnVja2V0RW5jcnlwdGlvbihidWNrZXROYW1lOiBzdHJpbmcpIHtcbiAgICBpZiAoIWlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldE5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRCdWNrZXROYW1lRXJyb3IoJ0ludmFsaWQgYnVja2V0IG5hbWU6ICcgKyBidWNrZXROYW1lKVxuICAgIH1cbiAgICBjb25zdCBtZXRob2QgPSAnR0VUJ1xuICAgIGNvbnN0IHF1ZXJ5ID0gJ2VuY3J5cHRpb24nXG5cbiAgICBjb25zdCByZXMgPSBhd2FpdCB0aGlzLm1ha2VSZXF1ZXN0QXN5bmMoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0pXG4gICAgY29uc3QgYm9keSA9IGF3YWl0IHJlYWRBc1N0cmluZyhyZXMpXG4gICAgcmV0dXJuIHhtbFBhcnNlcnMucGFyc2VCdWNrZXRFbmNyeXB0aW9uQ29uZmlnKGJvZHkpXG4gIH1cblxuICBhc3luYyByZW1vdmVCdWNrZXRFbmNyeXB0aW9uKGJ1Y2tldE5hbWU6IHN0cmluZykge1xuICAgIGlmICghaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0TmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZEJ1Y2tldE5hbWVFcnJvcignSW52YWxpZCBidWNrZXQgbmFtZTogJyArIGJ1Y2tldE5hbWUpXG4gICAgfVxuICAgIGNvbnN0IG1ldGhvZCA9ICdERUxFVEUnXG4gICAgY29uc3QgcXVlcnkgPSAnZW5jcnlwdGlvbidcblxuICAgIGF3YWl0IHRoaXMubWFrZVJlcXVlc3RBc3luY09taXQoeyBtZXRob2QsIGJ1Y2tldE5hbWUsIHF1ZXJ5IH0sICcnLCBbMjA0XSlcbiAgfVxufVxuIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBLElBQUFBLE1BQUEsR0FBQUMsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFDLEVBQUEsR0FBQUYsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFFLElBQUEsR0FBQUgsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFHLEtBQUEsR0FBQUosdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFJLElBQUEsR0FBQUwsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFLLE1BQUEsR0FBQU4sdUJBQUEsQ0FBQUMsT0FBQTtBQUVBLElBQUFNLEtBQUEsR0FBQVAsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFPLFlBQUEsR0FBQVAsT0FBQTtBQUNBLElBQUFRLGNBQUEsR0FBQVIsT0FBQTtBQUNBLElBQUFTLE9BQUEsR0FBQVQsT0FBQTtBQUNBLElBQUFVLEVBQUEsR0FBQVgsdUJBQUEsQ0FBQUMsT0FBQTtBQUNBLElBQUFXLE9BQUEsR0FBQVgsT0FBQTtBQUVBLElBQUFZLG1CQUFBLEdBQUFaLE9BQUE7QUFDQSxJQUFBYSxNQUFBLEdBQUFkLHVCQUFBLENBQUFDLE9BQUE7QUFFQSxJQUFBYyxRQUFBLEdBQUFkLE9BQUE7QUFDQSxJQUFBZSxRQUFBLEdBQUFmLE9BQUE7QUFDQSxJQUFBZ0IsT0FBQSxHQUFBaEIsT0FBQTtBQUNBLElBQUFp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