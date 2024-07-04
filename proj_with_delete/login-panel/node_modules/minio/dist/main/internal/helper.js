"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.calculateEvenSplits = calculateEvenSplits;
exports.extractMetadata = extractMetadata;
exports.getContentLength = getContentLength;
exports.getEncryptionHeaders = getEncryptionHeaders;
exports.getScope = getScope;
exports.getSourceVersionId = getSourceVersionId;
exports.getVersionId = getVersionId;
exports.hashBinary = hashBinary;
exports.insertContentType = insertContentType;
exports.isAmazonEndpoint = isAmazonEndpoint;
exports.isAmzHeader = isAmzHeader;
exports.isBoolean = isBoolean;
exports.isDefined = isDefined;
exports.isEmpty = isEmpty;
exports.isEmptyObject = isEmptyObject;
exports.isFunction = isFunction;
exports.isNumber = isNumber;
exports.isObject = isObject;
exports.isReadableStream = isReadableStream;
exports.isStorageClassHeader = isStorageClassHeader;
exports.isString = isString;
exports.isSupportedHeader = isSupportedHeader;
exports.isValidBucketName = isValidBucketName;
exports.isValidDate = isValidDate;
exports.isValidDomain = isValidDomain;
exports.isValidEndpoint = isValidEndpoint;
exports.isValidIP = isValidIP;
exports.isValidObjectName = isValidObjectName;
exports.isValidPort = isValidPort;
exports.isValidPrefix = isValidPrefix;
exports.isVirtualHostStyle = isVirtualHostStyle;
exports.makeDateLong = makeDateLong;
exports.makeDateShort = makeDateShort;
exports.parseXml = parseXml;
exports.partsRequired = partsRequired;
exports.pipesetup = pipesetup;
exports.prependXAMZMeta = prependXAMZMeta;
exports.probeContentType = probeContentType;
exports.readableStream = readableStream;
exports.sanitizeETag = sanitizeETag;
exports.sanitizeObjectKey = sanitizeObjectKey;
exports.sanitizeSize = sanitizeSize;
exports.toArray = toArray;
exports.toMd5 = toMd5;
exports.toSha256 = toSha256;
exports.uriEscape = uriEscape;
exports.uriResourceEscape = uriResourceEscape;
var crypto = _interopRequireWildcard(require("crypto"), true);
var stream = _interopRequireWildcard(require("stream"), true);
var _fastXmlParser = require("fast-xml-parser");
var _ipaddr = require("ipaddr.js");
var _lodash = require("lodash");
var mime = _interopRequireWildcard(require("mime-types"), true);
var _async = require("./async.js");
var _type = require("./type.js");
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

const MetaDataHeaderPrefix = 'x-amz-meta-';
function hashBinary(buf, enableSHA256) {
  let sha256sum = '';
  if (enableSHA256) {
    sha256sum = crypto.createHash('sha256').update(buf).digest('hex');
  }
  const md5sum = crypto.createHash('md5').update(buf).digest('base64');
  return {
    md5sum,
    sha256sum
  };
}

// S3 percent-encodes some extra non-standard characters in a URI . So comply with S3.
const encodeAsHex = c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`;
function uriEscape(uriStr) {
  return encodeURIComponent(uriStr).replace(/[!'()*]/g, encodeAsHex);
}
function uriResourceEscape(string) {
  return uriEscape(string).replace(/%2F/g, '/');
}
function getScope(region, date, serviceName = 's3') {
  return `${makeDateShort(date)}/${region}/${serviceName}/aws4_request`;
}

/**
 * isAmazonEndpoint - true if endpoint is 's3.amazonaws.com' or 's3.cn-north-1.amazonaws.com.cn'
 */
function isAmazonEndpoint(endpoint) {
  return endpoint === 's3.amazonaws.com' || endpoint === 's3.cn-north-1.amazonaws.com.cn';
}

/**
 * isVirtualHostStyle - verify if bucket name is support with virtual
 * hosts. bucketNames with periods should be always treated as path
 * style if the protocol is 'https:', this is due to SSL wildcard
 * limitation. For all other buckets and Amazon S3 endpoint we will
 * default to virtual host style.
 */
function isVirtualHostStyle(endpoint, protocol, bucket, pathStyle) {
  if (protocol === 'https:' && bucket.includes('.')) {
    return false;
  }
  return isAmazonEndpoint(endpoint) || !pathStyle;
}
function isValidIP(ip) {
  return _ipaddr.isValid(ip);
}

/**
 * @returns if endpoint is valid domain.
 */
function isValidEndpoint(endpoint) {
  return isValidDomain(endpoint) || isValidIP(endpoint);
}

/**
 * @returns if input host is a valid domain.
 */
function isValidDomain(host) {
  if (!isString(host)) {
    return false;
  }
  // See RFC 1035, RFC 3696.
  if (host.length === 0 || host.length > 255) {
    return false;
  }
  // Host cannot start or end with a '-'
  if (host[0] === '-' || host.slice(-1) === '-') {
    return false;
  }
  // Host cannot start or end with a '_'
  if (host[0] === '_' || host.slice(-1) === '_') {
    return false;
  }
  // Host cannot start with a '.'
  if (host[0] === '.') {
    return false;
  }
  const nonAlphaNumerics = '`~!@#$%^&*()+={}[]|\\"\';:><?/';
  // All non alphanumeric characters are invalid.
  for (const char of nonAlphaNumerics) {
    if (host.includes(char)) {
      return false;
    }
  }
  // No need to regexp match, since the list is non-exhaustive.
  // We let it be valid and fail later.
  return true;
}

/**
 * Probes contentType using file extensions.
 *
 * @example
 * ```
 * // return 'image/png'
 * probeContentType('file.png')
 * ```
 */
function probeContentType(path) {
  let contentType = mime.lookup(path);
  if (!contentType) {
    contentType = 'application/octet-stream';
  }
  return contentType;
}

/**
 * is input port valid.
 */
function isValidPort(port) {
  // verify if port is a number.
  if (!isNumber(port)) {
    return false;
  }

  // port `0` is valid and special case
  return 0 <= port && port <= 65535;
}
function isValidBucketName(bucket) {
  if (!isString(bucket)) {
    return false;
  }

  // bucket length should be less than and no more than 63
  // characters long.
  if (bucket.length < 3 || bucket.length > 63) {
    return false;
  }
  // bucket with successive periods is invalid.
  if (bucket.includes('..')) {
    return false;
  }
  // bucket cannot have ip address style.
  if (/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/.test(bucket)) {
    return false;
  }
  // bucket should begin with alphabet/number and end with alphabet/number,
  // with alphabet/number/.- in the middle.
  if (/^[a-z0-9][a-z0-9.-]+[a-z0-9]$/.test(bucket)) {
    return true;
  }
  return false;
}

/**
 * check if objectName is a valid object name
 */
function isValidObjectName(objectName) {
  if (!isValidPrefix(objectName)) {
    return false;
  }
  return objectName.length !== 0;
}

/**
 * check if prefix is valid
 */
function isValidPrefix(prefix) {
  if (!isString(prefix)) {
    return false;
  }
  if (prefix.length > 1024) {
    return false;
  }
  return true;
}

/**
 * check if typeof arg number
 */
function isNumber(arg) {
  return typeof arg === 'number';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any

/**
 * check if typeof arg function
 */
function isFunction(arg) {
  return typeof arg === 'function';
}

/**
 * check if typeof arg string
 */
function isString(arg) {
  return typeof arg === 'string';
}

/**
 * check if typeof arg object
 */
function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

/**
 * check if object is readable stream
 */
function isReadableStream(arg) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return isObject(arg) && isFunction(arg._read);
}

/**
 * check if arg is boolean
 */
function isBoolean(arg) {
  return typeof arg === 'boolean';
}
function isEmpty(o) {
  return _lodash.isEmpty(o);
}
function isEmptyObject(o) {
  return Object.values(o).filter(x => x !== undefined).length !== 0;
}
function isDefined(o) {
  return o !== null && o !== undefined;
}

/**
 * check if arg is a valid date
 */
function isValidDate(arg) {
  // @ts-expect-error checknew Date(Math.NaN)
  return arg instanceof Date && !isNaN(arg);
}

/**
 * Create a Date string with format: 'YYYYMMDDTHHmmss' + Z
 */
function makeDateLong(date) {
  date = date || new Date();

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString();
  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 13) + s.slice(14, 16) + s.slice(17, 19) + 'Z';
}

/**
 * Create a Date string with format: 'YYYYMMDD'
 */
function makeDateShort(date) {
  date = date || new Date();

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString();
  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 10);
}

/**
 * pipesetup sets up pipe() from left to right os streams array
 * pipesetup will also make sure that error emitted at any of the upstream Stream
 * will be emitted at the last stream. This makes error handling simple
 */
function pipesetup(...streams) {
  // @ts-expect-error ts can't narrow this
  return streams.reduce((src, dst) => {
    src.on('error', err => dst.emit('error', err));
    return src.pipe(dst);
  });
}

/**
 * return a Readable stream that emits data
 */
function readableStream(data) {
  const s = new stream.Readable();
  s._read = () => {};
  s.push(data);
  s.push(null);
  return s;
}

/**
 * Process metadata to insert appropriate value to `content-type` attribute
 */
function insertContentType(metaData, filePath) {
  // check if content-type attribute present in metaData
  for (const key in metaData) {
    if (key.toLowerCase() === 'content-type') {
      return metaData;
    }
  }

  // if `content-type` attribute is not present in metadata, then infer it from the extension in filePath
  return {
    ...metaData,
    'content-type': probeContentType(filePath)
  };
}

/**
 * Function prepends metadata with the appropriate prefix if it is not already on
 */
function prependXAMZMeta(metaData) {
  if (!metaData) {
    return {};
  }
  return _lodash.mapKeys(metaData, (value, key) => {
    if (isAmzHeader(key) || isSupportedHeader(key) || isStorageClassHeader(key)) {
      return key;
    }
    return MetaDataHeaderPrefix + key;
  });
}

/**
 * Checks if it is a valid header according to the AmazonS3 API
 */
function isAmzHeader(key) {
  const temp = key.toLowerCase();
  return temp.startsWith(MetaDataHeaderPrefix) || temp === 'x-amz-acl' || temp.startsWith('x-amz-server-side-encryption-') || temp === 'x-amz-server-side-encryption';
}

/**
 * Checks if it is a supported Header
 */
function isSupportedHeader(key) {
  const supported_headers = ['content-type', 'cache-control', 'content-encoding', 'content-disposition', 'content-language', 'x-amz-website-redirect-location'];
  return supported_headers.includes(key.toLowerCase());
}

/**
 * Checks if it is a storage header
 */
function isStorageClassHeader(key) {
  return key.toLowerCase() === 'x-amz-storage-class';
}
function extractMetadata(headers) {
  return _lodash.mapKeys(_lodash.pickBy(headers, (value, key) => isSupportedHeader(key) || isStorageClassHeader(key) || isAmzHeader(key)), (value, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith(MetaDataHeaderPrefix)) {
      return lower.slice(MetaDataHeaderPrefix.length);
    }
    return key;
  });
}
function getVersionId(headers = {}) {
  return headers['x-amz-version-id'] || null;
}
function getSourceVersionId(headers = {}) {
  return headers['x-amz-copy-source-version-id'] || null;
}
function sanitizeETag(etag = '') {
  const replaceChars = {
    '"': '',
    '&quot;': '',
    '&#34;': '',
    '&QUOT;': '',
    '&#x00022': ''
  };
  return etag.replace(/^("|&quot;|&#34;)|("|&quot;|&#34;)$/g, m => replaceChars[m]);
}
function toMd5(payload) {
  // use string from browser and buffer from nodejs
  // browser support is tested only against minio server
  return crypto.createHash('md5').update(Buffer.from(payload)).digest().toString('base64');
}
function toSha256(payload) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * toArray returns a single element array with param being the element,
 * if param is just a string, and returns 'param' back if it is an array
 * So, it makes sure param is always an array
 */
function toArray(param) {
  if (!Array.isArray(param)) {
    return [param];
  }
  return param;
}
function sanitizeObjectKey(objectName) {
  // + symbol characters are not decoded as spaces in JS. so replace them first and decode to get the correct result.
  const asStrName = (objectName ? objectName.toString() : '').replace(/\+/g, ' ');
  return decodeURIComponent(asStrName);
}
function sanitizeSize(size) {
  return size ? Number.parseInt(size) : undefined;
}
const PART_CONSTRAINTS = {
  // absMinPartSize - absolute minimum part size (5 MiB)
  ABS_MIN_PART_SIZE: 1024 * 1024 * 5,
  // MIN_PART_SIZE - minimum part size 16MiB per object after which
  MIN_PART_SIZE: 1024 * 1024 * 16,
  // MAX_PARTS_COUNT - maximum number of parts for a single multipart session.
  MAX_PARTS_COUNT: 10000,
  // MAX_PART_SIZE - maximum part size 5GiB for a single multipart upload
  // operation.
  MAX_PART_SIZE: 1024 * 1024 * 1024 * 5,
  // MAX_SINGLE_PUT_OBJECT_SIZE - maximum size 5GiB of object per PUT
  // operation.
  MAX_SINGLE_PUT_OBJECT_SIZE: 1024 * 1024 * 1024 * 5,
  // MAX_MULTIPART_PUT_OBJECT_SIZE - maximum size 5TiB of object for
  // Multipart operation.
  MAX_MULTIPART_PUT_OBJECT_SIZE: 1024 * 1024 * 1024 * 1024 * 5
};
exports.PART_CONSTRAINTS = PART_CONSTRAINTS;
const GENERIC_SSE_HEADER = 'X-Amz-Server-Side-Encryption';
const ENCRYPTION_HEADERS = {
  // sseGenericHeader is the AWS SSE header used for SSE-S3 and SSE-KMS.
  sseGenericHeader: GENERIC_SSE_HEADER,
  // sseKmsKeyID is the AWS SSE-KMS key id.
  sseKmsKeyID: GENERIC_SSE_HEADER + '-Aws-Kms-Key-Id'
};

/**
 * Return Encryption headers
 * @param encConfig
 * @returns an object with key value pairs that can be used in headers.
 */
function getEncryptionHeaders(encConfig) {
  const encType = encConfig.type;
  if (!isEmpty(encType)) {
    if (encType === _type.ENCRYPTION_TYPES.SSEC) {
      return {
        [ENCRYPTION_HEADERS.sseGenericHeader]: 'AES256'
      };
    } else if (encType === _type.ENCRYPTION_TYPES.KMS) {
      return {
        [ENCRYPTION_HEADERS.sseGenericHeader]: encConfig.SSEAlgorithm,
        [ENCRYPTION_HEADERS.sseKmsKeyID]: encConfig.KMSMasterKeyID
      };
    }
  }
  return {};
}
function partsRequired(size) {
  const maxPartSize = PART_CONSTRAINTS.MAX_MULTIPART_PUT_OBJECT_SIZE / (PART_CONSTRAINTS.MAX_PARTS_COUNT - 1);
  let requiredPartSize = size / maxPartSize;
  if (size % maxPartSize > 0) {
    requiredPartSize++;
  }
  requiredPartSize = Math.trunc(requiredPartSize);
  return requiredPartSize;
}

/**
 * calculateEvenSplits - computes splits for a source and returns
 * start and end index slices. Splits happen evenly to be sure that no
 * part is less than 5MiB, as that could fail the multipart request if
 * it is not the last part.
 */
function calculateEvenSplits(size, objInfo) {
  if (size === 0) {
    return null;
  }
  const reqParts = partsRequired(size);
  const startIndexParts = [];
  const endIndexParts = [];
  let start = objInfo.Start;
  if (isEmpty(start) || start === -1) {
    start = 0;
  }
  const divisorValue = Math.trunc(size / reqParts);
  const reminderValue = size % reqParts;
  let nextStart = start;
  for (let i = 0; i < reqParts; i++) {
    let curPartSize = divisorValue;
    if (i < reminderValue) {
      curPartSize++;
    }
    const currentStart = nextStart;
    const currentEnd = currentStart + curPartSize - 1;
    nextStart = currentEnd + 1;
    startIndexParts.push(currentStart);
    endIndexParts.push(currentEnd);
  }
  return {
    startIndex: startIndexParts,
    endIndex: endIndexParts,
    objInfo: objInfo
  };
}
const fxp = new _fastXmlParser.XMLParser();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseXml(xml) {
  const result = fxp.parse(xml);
  if (result.Error) {
    throw result.Error;
  }
  return result;
}

/**
 * get content size of object content to upload
 */
async function getContentLength(s) {
  // use length property of string | Buffer
  if (typeof s === 'string' || Buffer.isBuffer(s)) {
    return s.length;
  }

  // property of `fs.ReadStream`
  const filePath = s.path;
  if (filePath && typeof filePath === 'string') {
    const stat = await _async.fsp.lstat(filePath);
    return stat.size;
  }

  // property of `fs.ReadStream`
  const fd = s.fd;
  if (fd && typeof fd === 'number') {
    const stat = await (0, _async.fstat)(fd);
    return stat.size;
  }
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjcnlwdG8iLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsInJlcXVpcmUiLCJzdHJlYW0iLCJfZmFzdFhtbFBhcnNlciIsIl9pcGFkZHIiLCJfbG9kYXNoIiwibWltZSIsIl9hc3luYyIsIl90eXBlIiwiX2dldFJlcXVpcmVXaWxkY2FyZENhY2hlIiwibm9kZUludGVyb3AiLCJXZWFrTWFwIiwiY2FjaGVCYWJlbEludGVyb3AiLCJjYWNoZU5vZGVJbnRlcm9wIiwib2JqIiwiX19lc01vZHVsZSIsImRlZmF1bHQiLCJjYWNoZSIsImhhcyIsImdldCIsIm5ld09iaiIsImhhc1Byb3BlcnR5RGVzY3JpcHRvciIsIk9iamVjdCIsImRlZmluZVByb3BlcnR5IiwiZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yIiwia2V5IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJjYWxsIiwiZGVzYyIsInNldCIsIk1ldGFEYXRhSGVhZGVyUHJlZml4IiwiaGFzaEJpbmFyeSIsImJ1ZiIsImVuYWJsZVNIQTI1NiIsInNoYTI1NnN1bSIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJtZDVzdW0iLCJlbmNvZGVBc0hleCIsImMiLCJjaGFyQ29kZUF0IiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsInVyaUVzY2FwZSIsInVyaVN0ciIsImVuY29kZVVSSUNvbXBvbmVudCIsInJlcGxhY2UiLCJ1cmlSZXNvdXJjZUVzY2FwZSIsInN0cmluZyIsImdldFNjb3BlIiwicmVnaW9uIiwiZGF0ZSIsInNlcnZpY2VOYW1lIiwibWFrZURhdGVTaG9ydCIsImlzQW1hem9uRW5kcG9pbnQiLCJlbmRwb2ludCIsImlzVmlydHVhbEhvc3RTdHlsZSIsInByb3RvY29sIiwiYnVja2V0IiwicGF0aFN0eWxlIiwiaW5jbHVkZXMiLCJpc1ZhbGlkSVAiLCJpcCIsImlwYWRkciIsImlzVmFsaWQiLCJpc1ZhbGlkRW5kcG9pbnQiLCJpc1ZhbGlkRG9tYWluIiwiaG9zdCIsImlzU3RyaW5nIiwibGVuZ3RoIiwic2xpY2UiLCJub25BbHBoYU51bWVyaWNzIiwiY2hhciIsInByb2JlQ29udGVudFR5cGUiLCJwYXRoIiwiY29udGVudFR5cGUiLCJsb29rdXAiLCJpc1ZhbGlkUG9ydCIsInBvcnQiLCJpc051bWJlciIsImlzVmFsaWRCdWNrZXROYW1lIiwidGVzdCIsImlzVmFsaWRPYmplY3ROYW1lIiwib2JqZWN0TmFtZSIsImlzVmFsaWRQcmVmaXgiLCJwcmVmaXgiLCJhcmciLCJpc0Z1bmN0aW9uIiwiaXNPYmplY3QiLCJpc1JlYWRhYmxlU3RyZWFtIiwiX3JlYWQiLCJpc0Jvb2xlYW4iLCJpc0VtcHR5IiwibyIsIl8iLCJpc0VtcHR5T2JqZWN0IiwidmFsdWVzIiwiZmlsdGVyIiwieCIsInVuZGVmaW5lZCIsImlzRGVmaW5lZCIsImlzVmFsaWREYXRlIiwiRGF0ZSIsImlzTmFOIiwibWFrZURhdGVMb25nIiwicyIsInRvSVNPU3RyaW5nIiwicGlwZXNldHVwIiwic3RyZWFtcyIsInJlZHVjZSIsInNyYyIsImRzdCIsIm9uIiwiZXJyIiwiZW1pdCIsInBpcGUiLCJyZWFkYWJsZVN0cmVhbSIsImRhdGEiLCJSZWFkYWJsZSIsInB1c2giLCJpbnNlcnRDb250ZW50VHlwZSIsIm1ldGFEYXRhIiwiZmlsZVBhdGgiLCJ0b0xvd2VyQ2FzZSIsInByZXBlbmRYQU1aTWV0YSIsIm1hcEtleXMiLCJ2YWx1ZSIsImlzQW16SGVhZGVyIiwiaXNTdXBwb3J0ZWRIZWFkZXIiLCJpc1N0b3JhZ2VDbGFzc0hlYWRlciIsInRlbXAiLCJzdGFydHNXaXRoIiwic3VwcG9ydGVkX2hlYWRlcnMiLCJleHRyYWN0TWV0YWRhdGEiLCJoZWFkZXJzIiwicGlja0J5IiwibG93ZXIiLCJnZXRWZXJzaW9uSWQiLCJnZXRTb3VyY2VWZXJzaW9uSWQiLCJzYW5pdGl6ZUVUYWciLCJldGFnIiwicmVwbGFjZUNoYXJzIiwibSIsInRvTWQ1IiwicGF5bG9hZCIsIkJ1ZmZlciIsImZyb20iLCJ0b1NoYTI1NiIsInRvQXJyYXkiLCJwYXJhbSIsIkFycmF5IiwiaXNBcnJheSIsInNhbml0aXplT2JqZWN0S2V5IiwiYXNTdHJOYW1lIiwiZGVjb2RlVVJJQ29tcG9uZW50Iiwic2FuaXRpemVTaXplIiwic2l6ZSIsIk51bWJlciIsInBhcnNlSW50IiwiUEFSVF9DT05TVFJBSU5UUyIsIkFCU19NSU5fUEFSVF9TSVpFIiwiTUlOX1BBUlRfU0laRSIsIk1BWF9QQVJUU19DT1VOVCIsIk1BWF9QQVJUX1NJWkUiLCJNQVhfU0lOR0xFX1BVVF9PQkpFQ1RfU0laRSIsIk1BWF9NVUxUSVBBUlRfUFVUX09CSkVDVF9TSVpFIiwiZXhwb3J0cyIsIkdFTkVSSUNfU1NFX0hFQURFUiIsIkVOQ1JZUFRJT05fSEVBREVSUyIsInNzZUdlbmVyaWNIZWFkZXIiLCJzc2VLbXNLZXlJRCIsImdldEVuY3J5cHRpb25IZWFkZXJzIiwiZW5jQ29uZmlnIiwiZW5jVHlwZSIsInR5cGUiLCJFTkNSWVBUSU9OX1RZUEVTIiwiU1NFQyIsIktNUyIsIlNTRUFsZ29yaXRobSIsIktNU01hc3RlcktleUlEIiwicGFydHNSZXF1aXJlZCIsIm1heFBhcnRTaXplIiwicmVxdWlyZWRQYXJ0U2l6ZSIsIk1hdGgiLCJ0cnVuYyIsImNhbGN1bGF0ZUV2ZW5TcGxpdHMiLCJvYmpJbmZvIiwicmVxUGFydHMiLCJzdGFydEluZGV4UGFydHMiLCJlbmRJbmRleFBhcnRzIiwic3RhcnQiLCJTdGFydCIsImRpdmlzb3JWYWx1ZSIsInJlbWluZGVyVmFsdWUiLCJuZXh0U3RhcnQiLCJpIiwiY3VyUGFydFNpemUiLCJjdXJyZW50U3RhcnQiLCJjdXJyZW50RW5kIiwic3RhcnRJbmRleCIsImVuZEluZGV4IiwiZnhwIiwiWE1MUGFyc2VyIiwicGFyc2VYbWwiLCJ4bWwiLCJyZXN1bHQiLCJwYXJzZSIsIkVycm9yIiwiZ2V0Q29udGVudExlbmd0aCIsImlzQnVmZmVyIiwic3RhdCIsImZzcCIsImxzdGF0IiwiZmQiLCJmc3RhdCJdLCJzb3VyY2VzIjpbImhlbHBlci50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogTWluSU8gSmF2YXNjcmlwdCBMaWJyYXJ5IGZvciBBbWF6b24gUzMgQ29tcGF0aWJsZSBDbG91ZCBTdG9yYWdlLCAoQykgMjAxNSBNaW5JTywgSW5jLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXG4gKlxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cbiAqL1xuXG5pbXBvcnQgKiBhcyBjcnlwdG8gZnJvbSAnbm9kZTpjcnlwdG8nXG5pbXBvcnQgKiBhcyBzdHJlYW0gZnJvbSAnbm9kZTpzdHJlYW0nXG5cbmltcG9ydCB7IFhNTFBhcnNlciB9IGZyb20gJ2Zhc3QteG1sLXBhcnNlcidcbmltcG9ydCBpcGFkZHIgZnJvbSAnaXBhZGRyLmpzJ1xuaW1wb3J0IF8gZnJvbSAnbG9kYXNoJ1xuaW1wb3J0ICogYXMgbWltZSBmcm9tICdtaW1lLXR5cGVzJ1xuXG5pbXBvcnQgeyBmc3AsIGZzdGF0IH0gZnJvbSAnLi9hc3luYy50cydcbmltcG9ydCB0eXBlIHsgQmluYXJ5LCBFbmNyeXB0aW9uLCBPYmplY3RNZXRhRGF0YSwgUmVxdWVzdEhlYWRlcnMsIFJlc3BvbnNlSGVhZGVyIH0gZnJvbSAnLi90eXBlLnRzJ1xuaW1wb3J0IHsgRU5DUllQVElPTl9UWVBFUyB9IGZyb20gJy4vdHlwZS50cydcblxuY29uc3QgTWV0YURhdGFIZWFkZXJQcmVmaXggPSAneC1hbXotbWV0YS0nXG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNoQmluYXJ5KGJ1ZjogQnVmZmVyLCBlbmFibGVTSEEyNTY6IGJvb2xlYW4pIHtcbiAgbGV0IHNoYTI1NnN1bSA9ICcnXG4gIGlmIChlbmFibGVTSEEyNTYpIHtcbiAgICBzaGEyNTZzdW0gPSBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKGJ1ZikuZGlnZXN0KCdoZXgnKVxuICB9XG4gIGNvbnN0IG1kNXN1bSA9IGNyeXB0by5jcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoYnVmKS5kaWdlc3QoJ2Jhc2U2NCcpXG5cbiAgcmV0dXJuIHsgbWQ1c3VtLCBzaGEyNTZzdW0gfVxufVxuXG4vLyBTMyBwZXJjZW50LWVuY29kZXMgc29tZSBleHRyYSBub24tc3RhbmRhcmQgY2hhcmFjdGVycyBpbiBhIFVSSSAuIFNvIGNvbXBseSB3aXRoIFMzLlxuY29uc3QgZW5jb2RlQXNIZXggPSAoYzogc3RyaW5nKSA9PiBgJSR7Yy5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpfWBcbmV4cG9ydCBmdW5jdGlvbiB1cmlFc2NhcGUodXJpU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gZW5jb2RlVVJJQ29tcG9uZW50KHVyaVN0cikucmVwbGFjZSgvWyEnKCkqXS9nLCBlbmNvZGVBc0hleClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVyaVJlc291cmNlRXNjYXBlKHN0cmluZzogc3RyaW5nKSB7XG4gIHJldHVybiB1cmlFc2NhcGUoc3RyaW5nKS5yZXBsYWNlKC8lMkYvZywgJy8nKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U2NvcGUocmVnaW9uOiBzdHJpbmcsIGRhdGU6IERhdGUsIHNlcnZpY2VOYW1lID0gJ3MzJykge1xuICByZXR1cm4gYCR7bWFrZURhdGVTaG9ydChkYXRlKX0vJHtyZWdpb259LyR7c2VydmljZU5hbWV9L2F3czRfcmVxdWVzdGBcbn1cblxuLyoqXG4gKiBpc0FtYXpvbkVuZHBvaW50IC0gdHJ1ZSBpZiBlbmRwb2ludCBpcyAnczMuYW1hem9uYXdzLmNvbScgb3IgJ3MzLmNuLW5vcnRoLTEuYW1hem9uYXdzLmNvbS5jbidcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQW1hem9uRW5kcG9pbnQoZW5kcG9pbnQ6IHN0cmluZykge1xuICByZXR1cm4gZW5kcG9pbnQgPT09ICdzMy5hbWF6b25hd3MuY29tJyB8fCBlbmRwb2ludCA9PT0gJ3MzLmNuLW5vcnRoLTEuYW1hem9uYXdzLmNvbS5jbidcbn1cblxuLyoqXG4gKiBpc1ZpcnR1YWxIb3N0U3R5bGUgLSB2ZXJpZnkgaWYgYnVja2V0IG5hbWUgaXMgc3VwcG9ydCB3aXRoIHZpcnR1YWxcbiAqIGhvc3RzLiBidWNrZXROYW1lcyB3aXRoIHBlcmlvZHMgc2hvdWxkIGJlIGFsd2F5cyB0cmVhdGVkIGFzIHBhdGhcbiAqIHN0eWxlIGlmIHRoZSBwcm90b2NvbCBpcyAnaHR0cHM6JywgdGhpcyBpcyBkdWUgdG8gU1NMIHdpbGRjYXJkXG4gKiBsaW1pdGF0aW9uLiBGb3IgYWxsIG90aGVyIGJ1Y2tldHMgYW5kIEFtYXpvbiBTMyBlbmRwb2ludCB3ZSB3aWxsXG4gKiBkZWZhdWx0IHRvIHZpcnR1YWwgaG9zdCBzdHlsZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmlydHVhbEhvc3RTdHlsZShlbmRwb2ludDogc3RyaW5nLCBwcm90b2NvbDogc3RyaW5nLCBidWNrZXQ6IHN0cmluZywgcGF0aFN0eWxlOiBib29sZWFuKSB7XG4gIGlmIChwcm90b2NvbCA9PT0gJ2h0dHBzOicgJiYgYnVja2V0LmluY2x1ZGVzKCcuJykpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gaXNBbWF6b25FbmRwb2ludChlbmRwb2ludCkgfHwgIXBhdGhTdHlsZVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZElQKGlwOiBzdHJpbmcpIHtcbiAgcmV0dXJuIGlwYWRkci5pc1ZhbGlkKGlwKVxufVxuXG4vKipcbiAqIEByZXR1cm5zIGlmIGVuZHBvaW50IGlzIHZhbGlkIGRvbWFpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRFbmRwb2ludChlbmRwb2ludDogc3RyaW5nKSB7XG4gIHJldHVybiBpc1ZhbGlkRG9tYWluKGVuZHBvaW50KSB8fCBpc1ZhbGlkSVAoZW5kcG9pbnQpXG59XG5cbi8qKlxuICogQHJldHVybnMgaWYgaW5wdXQgaG9zdCBpcyBhIHZhbGlkIGRvbWFpbi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWREb21haW4oaG9zdDogc3RyaW5nKSB7XG4gIGlmICghaXNTdHJpbmcoaG9zdCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBTZWUgUkZDIDEwMzUsIFJGQyAzNjk2LlxuICBpZiAoaG9zdC5sZW5ndGggPT09IDAgfHwgaG9zdC5sZW5ndGggPiAyNTUpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBIb3N0IGNhbm5vdCBzdGFydCBvciBlbmQgd2l0aCBhICctJ1xuICBpZiAoaG9zdFswXSA9PT0gJy0nIHx8IGhvc3Quc2xpY2UoLTEpID09PSAnLScpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBIb3N0IGNhbm5vdCBzdGFydCBvciBlbmQgd2l0aCBhICdfJ1xuICBpZiAoaG9zdFswXSA9PT0gJ18nIHx8IGhvc3Quc2xpY2UoLTEpID09PSAnXycpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBIb3N0IGNhbm5vdCBzdGFydCB3aXRoIGEgJy4nXG4gIGlmIChob3N0WzBdID09PSAnLicpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIGNvbnN0IG5vbkFscGhhTnVtZXJpY3MgPSAnYH4hQCMkJV4mKigpKz17fVtdfFxcXFxcIlxcJzs6Pjw/LydcbiAgLy8gQWxsIG5vbiBhbHBoYW51bWVyaWMgY2hhcmFjdGVycyBhcmUgaW52YWxpZC5cbiAgZm9yIChjb25zdCBjaGFyIG9mIG5vbkFscGhhTnVtZXJpY3MpIHtcbiAgICBpZiAoaG9zdC5pbmNsdWRlcyhjaGFyKSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG4gIC8vIE5vIG5lZWQgdG8gcmVnZXhwIG1hdGNoLCBzaW5jZSB0aGUgbGlzdCBpcyBub24tZXhoYXVzdGl2ZS5cbiAgLy8gV2UgbGV0IGl0IGJlIHZhbGlkIGFuZCBmYWlsIGxhdGVyLlxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIFByb2JlcyBjb250ZW50VHlwZSB1c2luZyBmaWxlIGV4dGVuc2lvbnMuXG4gKlxuICogQGV4YW1wbGVcbiAqIGBgYFxuICogLy8gcmV0dXJuICdpbWFnZS9wbmcnXG4gKiBwcm9iZUNvbnRlbnRUeXBlKCdmaWxlLnBuZycpXG4gKiBgYGBcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByb2JlQ29udGVudFR5cGUocGF0aDogc3RyaW5nKSB7XG4gIGxldCBjb250ZW50VHlwZSA9IG1pbWUubG9va3VwKHBhdGgpXG4gIGlmICghY29udGVudFR5cGUpIHtcbiAgICBjb250ZW50VHlwZSA9ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nXG4gIH1cbiAgcmV0dXJuIGNvbnRlbnRUeXBlXG59XG5cbi8qKlxuICogaXMgaW5wdXQgcG9ydCB2YWxpZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRQb3J0KHBvcnQ6IHVua25vd24pOiBwb3J0IGlzIG51bWJlciB7XG4gIC8vIHZlcmlmeSBpZiBwb3J0IGlzIGEgbnVtYmVyLlxuICBpZiAoIWlzTnVtYmVyKHBvcnQpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICAvLyBwb3J0IGAwYCBpcyB2YWxpZCBhbmQgc3BlY2lhbCBjYXNlXG4gIHJldHVybiAwIDw9IHBvcnQgJiYgcG9ydCA8PSA2NTUzNVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZEJ1Y2tldE5hbWUoYnVja2V0OiB1bmtub3duKSB7XG4gIGlmICghaXNTdHJpbmcoYnVja2V0KSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLy8gYnVja2V0IGxlbmd0aCBzaG91bGQgYmUgbGVzcyB0aGFuIGFuZCBubyBtb3JlIHRoYW4gNjNcbiAgLy8gY2hhcmFjdGVycyBsb25nLlxuICBpZiAoYnVja2V0Lmxlbmd0aCA8IDMgfHwgYnVja2V0Lmxlbmd0aCA+IDYzKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gYnVja2V0IHdpdGggc3VjY2Vzc2l2ZSBwZXJpb2RzIGlzIGludmFsaWQuXG4gIGlmIChidWNrZXQuaW5jbHVkZXMoJy4uJykpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBidWNrZXQgY2Fubm90IGhhdmUgaXAgYWRkcmVzcyBzdHlsZS5cbiAgaWYgKC9bMC05XStcXC5bMC05XStcXC5bMC05XStcXC5bMC05XSsvLnRlc3QoYnVja2V0KSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIC8vIGJ1Y2tldCBzaG91bGQgYmVnaW4gd2l0aCBhbHBoYWJldC9udW1iZXIgYW5kIGVuZCB3aXRoIGFscGhhYmV0L251bWJlcixcbiAgLy8gd2l0aCBhbHBoYWJldC9udW1iZXIvLi0gaW4gdGhlIG1pZGRsZS5cbiAgaWYgKC9eW2EtejAtOV1bYS16MC05Li1dK1thLXowLTldJC8udGVzdChidWNrZXQpKSB7XG4gICAgcmV0dXJuIHRydWVcbiAgfVxuICByZXR1cm4gZmFsc2Vcbn1cblxuLyoqXG4gKiBjaGVjayBpZiBvYmplY3ROYW1lIGlzIGEgdmFsaWQgb2JqZWN0IG5hbWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRPYmplY3ROYW1lKG9iamVjdE5hbWU6IHVua25vd24pIHtcbiAgaWYgKCFpc1ZhbGlkUHJlZml4KG9iamVjdE5hbWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICByZXR1cm4gb2JqZWN0TmFtZS5sZW5ndGggIT09IDBcbn1cblxuLyoqXG4gKiBjaGVjayBpZiBwcmVmaXggaXMgdmFsaWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRQcmVmaXgocHJlZml4OiB1bmtub3duKTogcHJlZml4IGlzIHN0cmluZyB7XG4gIGlmICghaXNTdHJpbmcocHJlZml4KSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIGlmIChwcmVmaXgubGVuZ3RoID4gMTAyNCkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIHJldHVybiB0cnVlXG59XG5cbi8qKlxuICogY2hlY2sgaWYgdHlwZW9mIGFyZyBudW1iZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTnVtYmVyKGFyZzogdW5rbm93bik6IGFyZyBpcyBudW1iZXIge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcidcbn1cblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbmV4cG9ydCB0eXBlIEFueUZ1bmN0aW9uID0gKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnlcblxuLyoqXG4gKiBjaGVjayBpZiB0eXBlb2YgYXJnIGZ1bmN0aW9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZzogdW5rbm93bik6IGFyZyBpcyBBbnlGdW5jdGlvbiB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nXG59XG5cbi8qKlxuICogY2hlY2sgaWYgdHlwZW9mIGFyZyBzdHJpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3RyaW5nKGFyZzogdW5rbm93bik6IGFyZyBpcyBzdHJpbmcge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZydcbn1cblxuLyoqXG4gKiBjaGVjayBpZiB0eXBlb2YgYXJnIG9iamVjdFxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNPYmplY3QoYXJnOiB1bmtub3duKTogYXJnIGlzIG9iamVjdCB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGxcbn1cblxuLyoqXG4gKiBjaGVjayBpZiBvYmplY3QgaXMgcmVhZGFibGUgc3RyZWFtXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1JlYWRhYmxlU3RyZWFtKGFyZzogdW5rbm93bik6IGFyZyBpcyBzdHJlYW0uUmVhZGFibGUge1xuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L3VuYm91bmQtbWV0aG9kXG4gIHJldHVybiBpc09iamVjdChhcmcpICYmIGlzRnVuY3Rpb24oKGFyZyBhcyBzdHJlYW0uUmVhZGFibGUpLl9yZWFkKVxufVxuXG4vKipcbiAqIGNoZWNrIGlmIGFyZyBpcyBib29sZWFuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0Jvb2xlYW4oYXJnOiB1bmtub3duKTogYXJnIGlzIGJvb2xlYW4ge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KG86IHVua25vd24pOiBvIGlzIG51bGwgfCB1bmRlZmluZWQge1xuICByZXR1cm4gXy5pc0VtcHR5KG8pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5T2JqZWN0KG86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogYm9vbGVhbiB7XG4gIHJldHVybiBPYmplY3QudmFsdWVzKG8pLmZpbHRlcigoeCkgPT4geCAhPT0gdW5kZWZpbmVkKS5sZW5ndGggIT09IDBcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRGVmaW5lZDxUPihvOiBUKTogbyBpcyBFeGNsdWRlPFQsIG51bGwgfCB1bmRlZmluZWQ+IHtcbiAgcmV0dXJuIG8gIT09IG51bGwgJiYgbyAhPT0gdW5kZWZpbmVkXG59XG5cbi8qKlxuICogY2hlY2sgaWYgYXJnIGlzIGEgdmFsaWQgZGF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZERhdGUoYXJnOiB1bmtub3duKTogYXJnIGlzIERhdGUge1xuICAvLyBAdHMtZXhwZWN0LWVycm9yIGNoZWNrbmV3IERhdGUoTWF0aC5OYU4pXG4gIHJldHVybiBhcmcgaW5zdGFuY2VvZiBEYXRlICYmICFpc05hTihhcmcpXG59XG5cbi8qKlxuICogQ3JlYXRlIGEgRGF0ZSBzdHJpbmcgd2l0aCBmb3JtYXQ6ICdZWVlZTU1ERFRISG1tc3MnICsgWlxuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZURhdGVMb25nKGRhdGU/OiBEYXRlKTogc3RyaW5nIHtcbiAgZGF0ZSA9IGRhdGUgfHwgbmV3IERhdGUoKVxuXG4gIC8vIEdpdmVzIGZvcm1hdCBsaWtlOiAnMjAxNy0wOC0wN1QxNjoyODo1OS44ODlaJ1xuICBjb25zdCBzID0gZGF0ZS50b0lTT1N0cmluZygpXG5cbiAgcmV0dXJuIHMuc2xpY2UoMCwgNCkgKyBzLnNsaWNlKDUsIDcpICsgcy5zbGljZSg4LCAxMykgKyBzLnNsaWNlKDE0LCAxNikgKyBzLnNsaWNlKDE3LCAxOSkgKyAnWidcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBEYXRlIHN0cmluZyB3aXRoIGZvcm1hdDogJ1lZWVlNTUREJ1xuICovXG5leHBvcnQgZnVuY3Rpb24gbWFrZURhdGVTaG9ydChkYXRlPzogRGF0ZSkge1xuICBkYXRlID0gZGF0ZSB8fCBuZXcgRGF0ZSgpXG5cbiAgLy8gR2l2ZXMgZm9ybWF0IGxpa2U6ICcyMDE3LTA4LTA3VDE2OjI4OjU5Ljg4OVonXG4gIGNvbnN0IHMgPSBkYXRlLnRvSVNPU3RyaW5nKClcblxuICByZXR1cm4gcy5zbGljZSgwLCA0KSArIHMuc2xpY2UoNSwgNykgKyBzLnNsaWNlKDgsIDEwKVxufVxuXG4vKipcbiAqIHBpcGVzZXR1cCBzZXRzIHVwIHBpcGUoKSBmcm9tIGxlZnQgdG8gcmlnaHQgb3Mgc3RyZWFtcyBhcnJheVxuICogcGlwZXNldHVwIHdpbGwgYWxzbyBtYWtlIHN1cmUgdGhhdCBlcnJvciBlbWl0dGVkIGF0IGFueSBvZiB0aGUgdXBzdHJlYW0gU3RyZWFtXG4gKiB3aWxsIGJlIGVtaXR0ZWQgYXQgdGhlIGxhc3Qgc3RyZWFtLiBUaGlzIG1ha2VzIGVycm9yIGhhbmRsaW5nIHNpbXBsZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcGlwZXNldHVwKC4uLnN0cmVhbXM6IFtzdHJlYW0uUmVhZGFibGUsIC4uLnN0cmVhbS5EdXBsZXhbXSwgc3RyZWFtLldyaXRhYmxlXSkge1xuICAvLyBAdHMtZXhwZWN0LWVycm9yIHRzIGNhbid0IG5hcnJvdyB0aGlzXG4gIHJldHVybiBzdHJlYW1zLnJlZHVjZSgoc3JjOiBzdHJlYW0uUmVhZGFibGUsIGRzdDogc3RyZWFtLldyaXRhYmxlKSA9PiB7XG4gICAgc3JjLm9uKCdlcnJvcicsIChlcnIpID0+IGRzdC5lbWl0KCdlcnJvcicsIGVycikpXG4gICAgcmV0dXJuIHNyYy5waXBlKGRzdClcbiAgfSlcbn1cblxuLyoqXG4gKiByZXR1cm4gYSBSZWFkYWJsZSBzdHJlYW0gdGhhdCBlbWl0cyBkYXRhXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWFkYWJsZVN0cmVhbShkYXRhOiB1bmtub3duKTogc3RyZWFtLlJlYWRhYmxlIHtcbiAgY29uc3QgcyA9IG5ldyBzdHJlYW0uUmVhZGFibGUoKVxuICBzLl9yZWFkID0gKCkgPT4ge31cbiAgcy5wdXNoKGRhdGEpXG4gIHMucHVzaChudWxsKVxuICByZXR1cm4gc1xufVxuXG4vKipcbiAqIFByb2Nlc3MgbWV0YWRhdGEgdG8gaW5zZXJ0IGFwcHJvcHJpYXRlIHZhbHVlIHRvIGBjb250ZW50LXR5cGVgIGF0dHJpYnV0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0Q29udGVudFR5cGUobWV0YURhdGE6IE9iamVjdE1ldGFEYXRhLCBmaWxlUGF0aDogc3RyaW5nKTogT2JqZWN0TWV0YURhdGEge1xuICAvLyBjaGVjayBpZiBjb250ZW50LXR5cGUgYXR0cmlidXRlIHByZXNlbnQgaW4gbWV0YURhdGFcbiAgZm9yIChjb25zdCBrZXkgaW4gbWV0YURhdGEpIHtcbiAgICBpZiAoa2V5LnRvTG93ZXJDYXNlKCkgPT09ICdjb250ZW50LXR5cGUnKSB7XG4gICAgICByZXR1cm4gbWV0YURhdGFcbiAgICB9XG4gIH1cblxuICAvLyBpZiBgY29udGVudC10eXBlYCBhdHRyaWJ1dGUgaXMgbm90IHByZXNlbnQgaW4gbWV0YWRhdGEsIHRoZW4gaW5mZXIgaXQgZnJvbSB0aGUgZXh0ZW5zaW9uIGluIGZpbGVQYXRoXG4gIHJldHVybiB7XG4gICAgLi4ubWV0YURhdGEsXG4gICAgJ2NvbnRlbnQtdHlwZSc6IHByb2JlQ29udGVudFR5cGUoZmlsZVBhdGgpLFxuICB9XG59XG5cbi8qKlxuICogRnVuY3Rpb24gcHJlcGVuZHMgbWV0YWRhdGEgd2l0aCB0aGUgYXBwcm9wcmlhdGUgcHJlZml4IGlmIGl0IGlzIG5vdCBhbHJlYWR5IG9uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcmVwZW5kWEFNWk1ldGEobWV0YURhdGE/OiBPYmplY3RNZXRhRGF0YSk6IFJlcXVlc3RIZWFkZXJzIHtcbiAgaWYgKCFtZXRhRGF0YSkge1xuICAgIHJldHVybiB7fVxuICB9XG5cbiAgcmV0dXJuIF8ubWFwS2V5cyhtZXRhRGF0YSwgKHZhbHVlLCBrZXkpID0+IHtcbiAgICBpZiAoaXNBbXpIZWFkZXIoa2V5KSB8fCBpc1N1cHBvcnRlZEhlYWRlcihrZXkpIHx8IGlzU3RvcmFnZUNsYXNzSGVhZGVyKGtleSkpIHtcbiAgICAgIHJldHVybiBrZXlcbiAgICB9XG5cbiAgICByZXR1cm4gTWV0YURhdGFIZWFkZXJQcmVmaXggKyBrZXlcbiAgfSlcbn1cblxuLyoqXG4gKiBDaGVja3MgaWYgaXQgaXMgYSB2YWxpZCBoZWFkZXIgYWNjb3JkaW5nIHRvIHRoZSBBbWF6b25TMyBBUElcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzQW16SGVhZGVyKGtleTogc3RyaW5nKSB7XG4gIGNvbnN0IHRlbXAgPSBrZXkudG9Mb3dlckNhc2UoKVxuICByZXR1cm4gKFxuICAgIHRlbXAuc3RhcnRzV2l0aChNZXRhRGF0YUhlYWRlclByZWZpeCkgfHxcbiAgICB0ZW1wID09PSAneC1hbXotYWNsJyB8fFxuICAgIHRlbXAuc3RhcnRzV2l0aCgneC1hbXotc2VydmVyLXNpZGUtZW5jcnlwdGlvbi0nKSB8fFxuICAgIHRlbXAgPT09ICd4LWFtei1zZXJ2ZXItc2lkZS1lbmNyeXB0aW9uJ1xuICApXG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGl0IGlzIGEgc3VwcG9ydGVkIEhlYWRlclxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNTdXBwb3J0ZWRIZWFkZXIoa2V5OiBzdHJpbmcpIHtcbiAgY29uc3Qgc3VwcG9ydGVkX2hlYWRlcnMgPSBbXG4gICAgJ2NvbnRlbnQtdHlwZScsXG4gICAgJ2NhY2hlLWNvbnRyb2wnLFxuICAgICdjb250ZW50LWVuY29kaW5nJyxcbiAgICAnY29udGVudC1kaXNwb3NpdGlvbicsXG4gICAgJ2NvbnRlbnQtbGFuZ3VhZ2UnLFxuICAgICd4LWFtei13ZWJzaXRlLXJlZGlyZWN0LWxvY2F0aW9uJyxcbiAgXVxuICByZXR1cm4gc3VwcG9ydGVkX2hlYWRlcnMuaW5jbHVkZXMoa2V5LnRvTG93ZXJDYXNlKCkpXG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGl0IGlzIGEgc3RvcmFnZSBoZWFkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3RvcmFnZUNsYXNzSGVhZGVyKGtleTogc3RyaW5nKSB7XG4gIHJldHVybiBrZXkudG9Mb3dlckNhc2UoKSA9PT0gJ3gtYW16LXN0b3JhZ2UtY2xhc3MnXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0TWV0YWRhdGEoaGVhZGVyczogUmVzcG9uc2VIZWFkZXIpIHtcbiAgcmV0dXJuIF8ubWFwS2V5cyhcbiAgICBfLnBpY2tCeShoZWFkZXJzLCAodmFsdWUsIGtleSkgPT4gaXNTdXBwb3J0ZWRIZWFkZXIoa2V5KSB8fCBpc1N0b3JhZ2VDbGFzc0hlYWRlcihrZXkpIHx8IGlzQW16SGVhZGVyKGtleSkpLFxuICAgICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgICBjb25zdCBsb3dlciA9IGtleS50b0xvd2VyQ2FzZSgpXG4gICAgICBpZiAobG93ZXIuc3RhcnRzV2l0aChNZXRhRGF0YUhlYWRlclByZWZpeCkpIHtcbiAgICAgICAgcmV0dXJuIGxvd2VyLnNsaWNlKE1ldGFEYXRhSGVhZGVyUHJlZml4Lmxlbmd0aClcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGtleVxuICAgIH0sXG4gIClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFZlcnNpb25JZChoZWFkZXJzOiBSZXNwb25zZUhlYWRlciA9IHt9KSB7XG4gIHJldHVybiBoZWFkZXJzWyd4LWFtei12ZXJzaW9uLWlkJ10gfHwgbnVsbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U291cmNlVmVyc2lvbklkKGhlYWRlcnM6IFJlc3BvbnNlSGVhZGVyID0ge30pIHtcbiAgcmV0dXJuIGhlYWRlcnNbJ3gtYW16LWNvcHktc291cmNlLXZlcnNpb24taWQnXSB8fCBudWxsXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZUVUYWcoZXRhZyA9ICcnKTogc3RyaW5nIHtcbiAgY29uc3QgcmVwbGFjZUNoYXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICdcIic6ICcnLFxuICAgICcmcXVvdDsnOiAnJyxcbiAgICAnJiMzNDsnOiAnJyxcbiAgICAnJlFVT1Q7JzogJycsXG4gICAgJyYjeDAwMDIyJzogJycsXG4gIH1cbiAgcmV0dXJuIGV0YWcucmVwbGFjZSgvXihcInwmcXVvdDt8JiMzNDspfChcInwmcXVvdDt8JiMzNDspJC9nLCAobSkgPT4gcmVwbGFjZUNoYXJzW21dIGFzIHN0cmluZylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvTWQ1KHBheWxvYWQ6IEJpbmFyeSk6IHN0cmluZyB7XG4gIC8vIHVzZSBzdHJpbmcgZnJvbSBicm93c2VyIGFuZCBidWZmZXIgZnJvbSBub2RlanNcbiAgLy8gYnJvd3NlciBzdXBwb3J0IGlzIHRlc3RlZCBvbmx5IGFnYWluc3QgbWluaW8gc2VydmVyXG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKEJ1ZmZlci5mcm9tKHBheWxvYWQpKS5kaWdlc3QoKS50b1N0cmluZygnYmFzZTY0Jylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvU2hhMjU2KHBheWxvYWQ6IEJpbmFyeSk6IHN0cmluZyB7XG4gIHJldHVybiBjcnlwdG8uY3JlYXRlSGFzaCgnc2hhMjU2JykudXBkYXRlKHBheWxvYWQpLmRpZ2VzdCgnaGV4Jylcbn1cblxuLyoqXG4gKiB0b0FycmF5IHJldHVybnMgYSBzaW5nbGUgZWxlbWVudCBhcnJheSB3aXRoIHBhcmFtIGJlaW5nIHRoZSBlbGVtZW50LFxuICogaWYgcGFyYW0gaXMganVzdCBhIHN0cmluZywgYW5kIHJldHVybnMgJ3BhcmFtJyBiYWNrIGlmIGl0IGlzIGFuIGFycmF5XG4gKiBTbywgaXQgbWFrZXMgc3VyZSBwYXJhbSBpcyBhbHdheXMgYW4gYXJyYXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvQXJyYXk8VCA9IHVua25vd24+KHBhcmFtOiBUIHwgVFtdKTogQXJyYXk8VD4ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocGFyYW0pKSB7XG4gICAgcmV0dXJuIFtwYXJhbV0gYXMgVFtdXG4gIH1cbiAgcmV0dXJuIHBhcmFtXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzYW5pdGl6ZU9iamVjdEtleShvYmplY3ROYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAvLyArIHN5bWJvbCBjaGFyYWN0ZXJzIGFyZSBub3QgZGVjb2RlZCBhcyBzcGFjZXMgaW4gSlMuIHNvIHJlcGxhY2UgdGhlbSBmaXJzdCBhbmQgZGVjb2RlIHRvIGdldCB0aGUgY29ycmVjdCByZXN1bHQuXG4gIGNvbnN0IGFzU3RyTmFtZSA9IChvYmplY3ROYW1lID8gb2JqZWN0TmFtZS50b1N0cmluZygpIDogJycpLnJlcGxhY2UoL1xcKy9nLCAnICcpXG4gIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoYXNTdHJOYW1lKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVTaXplKHNpemU/OiBzdHJpbmcpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuICByZXR1cm4gc2l6ZSA/IE51bWJlci5wYXJzZUludChzaXplKSA6IHVuZGVmaW5lZFxufVxuXG5leHBvcnQgY29uc3QgUEFSVF9DT05TVFJBSU5UUyA9IHtcbiAgLy8gYWJzTWluUGFydFNpemUgLSBhYnNvbHV0ZSBtaW5pbXVtIHBhcnQgc2l6ZSAoNSBNaUIpXG4gIEFCU19NSU5fUEFSVF9TSVpFOiAxMDI0ICogMTAyNCAqIDUsXG4gIC8vIE1JTl9QQVJUX1NJWkUgLSBtaW5pbXVtIHBhcnQgc2l6ZSAxNk1pQiBwZXIgb2JqZWN0IGFmdGVyIHdoaWNoXG4gIE1JTl9QQVJUX1NJWkU6IDEwMjQgKiAxMDI0ICogMTYsXG4gIC8vIE1BWF9QQVJUU19DT1VOVCAtIG1heGltdW0gbnVtYmVyIG9mIHBhcnRzIGZvciBhIHNpbmdsZSBtdWx0aXBhcnQgc2Vzc2lvbi5cbiAgTUFYX1BBUlRTX0NPVU5UOiAxMDAwMCxcbiAgLy8gTUFYX1BBUlRfU0laRSAtIG1heGltdW0gcGFydCBzaXplIDVHaUIgZm9yIGEgc2luZ2xlIG11bHRpcGFydCB1cGxvYWRcbiAgLy8gb3BlcmF0aW9uLlxuICBNQVhfUEFSVF9TSVpFOiAxMDI0ICogMTAyNCAqIDEwMjQgKiA1LFxuICAvLyBNQVhfU0lOR0xFX1BVVF9PQkpFQ1RfU0laRSAtIG1heGltdW0gc2l6ZSA1R2lCIG9mIG9iamVjdCBwZXIgUFVUXG4gIC8vIG9wZXJhdGlvbi5cbiAgTUFYX1NJTkdMRV9QVVRfT0JKRUNUX1NJWkU6IDEwMjQgKiAxMDI0ICogMTAyNCAqIDUsXG4gIC8vIE1BWF9NVUxUSVBBUlRfUFVUX09CSkVDVF9TSVpFIC0gbWF4aW11bSBzaXplIDVUaUIgb2Ygb2JqZWN0IGZvclxuICAvLyBNdWx0aXBhcnQgb3BlcmF0aW9uLlxuICBNQVhfTVVMVElQQVJUX1BVVF9PQkpFQ1RfU0laRTogMTAyNCAqIDEwMjQgKiAxMDI0ICogMTAyNCAqIDUsXG59XG5cbmNvbnN0IEdFTkVSSUNfU1NFX0hFQURFUiA9ICdYLUFtei1TZXJ2ZXItU2lkZS1FbmNyeXB0aW9uJ1xuXG5jb25zdCBFTkNSWVBUSU9OX0hFQURFUlMgPSB7XG4gIC8vIHNzZUdlbmVyaWNIZWFkZXIgaXMgdGhlIEFXUyBTU0UgaGVhZGVyIHVzZWQgZm9yIFNTRS1TMyBhbmQgU1NFLUtNUy5cbiAgc3NlR2VuZXJpY0hlYWRlcjogR0VORVJJQ19TU0VfSEVBREVSLFxuICAvLyBzc2VLbXNLZXlJRCBpcyB0aGUgQVdTIFNTRS1LTVMga2V5IGlkLlxuICBzc2VLbXNLZXlJRDogR0VORVJJQ19TU0VfSEVBREVSICsgJy1Bd3MtS21zLUtleS1JZCcsXG59IGFzIGNvbnN0XG5cbi8qKlxuICogUmV0dXJuIEVuY3J5cHRpb24gaGVhZGVyc1xuICogQHBhcmFtIGVuY0NvbmZpZ1xuICogQHJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5IHZhbHVlIHBhaXJzIHRoYXQgY2FuIGJlIHVzZWQgaW4gaGVhZGVycy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldEVuY3J5cHRpb25IZWFkZXJzKGVuY0NvbmZpZzogRW5jcnlwdGlvbik6IFJlcXVlc3RIZWFkZXJzIHtcbiAgY29uc3QgZW5jVHlwZSA9IGVuY0NvbmZpZy50eXBlXG5cbiAgaWYgKCFpc0VtcHR5KGVuY1R5cGUpKSB7XG4gICAgaWYgKGVuY1R5cGUgPT09IEVOQ1JZUFRJT05fVFlQRVMuU1NFQykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgW0VOQ1JZUFRJT05fSEVBREVSUy5zc2VHZW5lcmljSGVhZGVyXTogJ0FFUzI1NicsXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlbmNUeXBlID09PSBFTkNSWVBUSU9OX1RZUEVTLktNUykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgW0VOQ1JZUFRJT05fSEVBREVSUy5zc2VHZW5lcmljSGVhZGVyXTogZW5jQ29uZmlnLlNTRUFsZ29yaXRobSxcbiAgICAgICAgW0VOQ1JZUFRJT05fSEVBREVSUy5zc2VLbXNLZXlJRF06IGVuY0NvbmZpZy5LTVNNYXN0ZXJLZXlJRCxcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4ge31cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnRzUmVxdWlyZWQoc2l6ZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgbWF4UGFydFNpemUgPSBQQVJUX0NPTlNUUkFJTlRTLk1BWF9NVUxUSVBBUlRfUFVUX09CSkVDVF9TSVpFIC8gKFBBUlRfQ09OU1RSQUlOVFMuTUFYX1BBUlRTX0NPVU5UIC0gMSlcbiAgbGV0IHJlcXVpcmVkUGFydFNpemUgPSBzaXplIC8gbWF4UGFydFNpemVcbiAgaWYgKHNpemUgJSBtYXhQYXJ0U2l6ZSA+IDApIHtcbiAgICByZXF1aXJlZFBhcnRTaXplKytcbiAgfVxuICByZXF1aXJlZFBhcnRTaXplID0gTWF0aC50cnVuYyhyZXF1aXJlZFBhcnRTaXplKVxuICByZXR1cm4gcmVxdWlyZWRQYXJ0U2l6ZVxufVxuXG4vKipcbiAqIGNhbGN1bGF0ZUV2ZW5TcGxpdHMgLSBjb21wdXRlcyBzcGxpdHMgZm9yIGEgc291cmNlIGFuZCByZXR1cm5zXG4gKiBzdGFydCBhbmQgZW5kIGluZGV4IHNsaWNlcy4gU3BsaXRzIGhhcHBlbiBldmVubHkgdG8gYmUgc3VyZSB0aGF0IG5vXG4gKiBwYXJ0IGlzIGxlc3MgdGhhbiA1TWlCLCBhcyB0aGF0IGNvdWxkIGZhaWwgdGhlIG11bHRpcGFydCByZXF1ZXN0IGlmXG4gKiBpdCBpcyBub3QgdGhlIGxhc3QgcGFydC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNhbGN1bGF0ZUV2ZW5TcGxpdHM8VCBleHRlbmRzIHsgU3RhcnQ/OiBudW1iZXIgfT4oXG4gIHNpemU6IG51bWJlcixcbiAgb2JqSW5mbzogVCxcbik6IHtcbiAgc3RhcnRJbmRleDogbnVtYmVyW11cbiAgb2JqSW5mbzogVFxuICBlbmRJbmRleDogbnVtYmVyW11cbn0gfCBudWxsIHtcbiAgaWYgKHNpemUgPT09IDApIHtcbiAgICByZXR1cm4gbnVsbFxuICB9XG4gIGNvbnN0IHJlcVBhcnRzID0gcGFydHNSZXF1aXJlZChzaXplKVxuICBjb25zdCBzdGFydEluZGV4UGFydHM6IG51bWJlcltdID0gW11cbiAgY29uc3QgZW5kSW5kZXhQYXJ0czogbnVtYmVyW10gPSBbXVxuXG4gIGxldCBzdGFydCA9IG9iakluZm8uU3RhcnRcbiAgaWYgKGlzRW1wdHkoc3RhcnQpIHx8IHN0YXJ0ID09PSAtMSkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIGNvbnN0IGRpdmlzb3JWYWx1ZSA9IE1hdGgudHJ1bmMoc2l6ZSAvIHJlcVBhcnRzKVxuXG4gIGNvbnN0IHJlbWluZGVyVmFsdWUgPSBzaXplICUgcmVxUGFydHNcblxuICBsZXQgbmV4dFN0YXJ0ID0gc3RhcnRcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHJlcVBhcnRzOyBpKyspIHtcbiAgICBsZXQgY3VyUGFydFNpemUgPSBkaXZpc29yVmFsdWVcbiAgICBpZiAoaSA8IHJlbWluZGVyVmFsdWUpIHtcbiAgICAgIGN1clBhcnRTaXplKytcbiAgICB9XG5cbiAgICBjb25zdCBjdXJyZW50U3RhcnQgPSBuZXh0U3RhcnRcbiAgICBjb25zdCBjdXJyZW50RW5kID0gY3VycmVudFN0YXJ0ICsgY3VyUGFydFNpemUgLSAxXG4gICAgbmV4dFN0YXJ0ID0gY3VycmVudEVuZCArIDFcblxuICAgIHN0YXJ0SW5kZXhQYXJ0cy5wdXNoKGN1cnJlbnRTdGFydClcbiAgICBlbmRJbmRleFBhcnRzLnB1c2goY3VycmVudEVuZClcbiAgfVxuXG4gIHJldHVybiB7IHN0YXJ0SW5kZXg6IHN0YXJ0SW5kZXhQYXJ0cywgZW5kSW5kZXg6IGVuZEluZGV4UGFydHMsIG9iakluZm86IG9iakluZm8gfVxufVxuXG5jb25zdCBmeHAgPSBuZXcgWE1MUGFyc2VyKClcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1leHBsaWNpdC1hbnlcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVhtbCh4bWw6IHN0cmluZyk6IGFueSB7XG4gIGNvbnN0IHJlc3VsdCA9IGZ4cC5wYXJzZSh4bWwpXG4gIGlmIChyZXN1bHQuRXJyb3IpIHtcbiAgICB0aHJvdyByZXN1bHQuRXJyb3JcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuLyoqXG4gKiBnZXQgY29udGVudCBzaXplIG9mIG9iamVjdCBjb250ZW50IHRvIHVwbG9hZFxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29udGVudExlbmd0aChzOiBzdHJlYW0uUmVhZGFibGUgfCBCdWZmZXIgfCBzdHJpbmcpOiBQcm9taXNlPG51bWJlciB8IG51bGw+IHtcbiAgLy8gdXNlIGxlbmd0aCBwcm9wZXJ0eSBvZiBzdHJpbmcgfCBCdWZmZXJcbiAgaWYgKHR5cGVvZiBzID09PSAnc3RyaW5nJyB8fCBCdWZmZXIuaXNCdWZmZXIocykpIHtcbiAgICByZXR1cm4gcy5sZW5ndGhcbiAgfVxuXG4gIC8vIHByb3BlcnR5IG9mIGBmcy5SZWFkU3RyZWFtYFxuICBjb25zdCBmaWxlUGF0aCA9IChzIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLnBhdGggYXMgc3RyaW5nIHwgdW5kZWZpbmVkXG4gIGlmIChmaWxlUGF0aCAmJiB0eXBlb2YgZmlsZVBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgY29uc3Qgc3RhdCA9IGF3YWl0IGZzcC5sc3RhdChmaWxlUGF0aClcbiAgICByZXR1cm4gc3RhdC5zaXplXG4gIH1cblxuICAvLyBwcm9wZXJ0eSBvZiBgZnMuUmVhZFN0cmVhbWBcbiAgY29uc3QgZmQgPSAocyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5mZCBhcyBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkXG4gIGlmIChmZCAmJiB0eXBlb2YgZmQgPT09ICdudW1iZXInKSB7XG4gICAgY29uc3Qgc3RhdCA9IGF3YWl0IGZz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