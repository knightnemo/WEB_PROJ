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

import * as crypto from "crypto";
import * as stream from "stream";
import { XMLParser } from 'fast-xml-parser';
import ipaddr from 'ipaddr.js';
import _ from 'lodash';
import * as mime from 'mime-types';
import { fsp, fstat } from "./async.mjs";
import { ENCRYPTION_TYPES } from "./type.mjs";
const MetaDataHeaderPrefix = 'x-amz-meta-';
export function hashBinary(buf, enableSHA256) {
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
export function uriEscape(uriStr) {
  return encodeURIComponent(uriStr).replace(/[!'()*]/g, encodeAsHex);
}
export function uriResourceEscape(string) {
  return uriEscape(string).replace(/%2F/g, '/');
}
export function getScope(region, date, serviceName = 's3') {
  return `${makeDateShort(date)}/${region}/${serviceName}/aws4_request`;
}

/**
 * isAmazonEndpoint - true if endpoint is 's3.amazonaws.com' or 's3.cn-north-1.amazonaws.com.cn'
 */
export function isAmazonEndpoint(endpoint) {
  return endpoint === 's3.amazonaws.com' || endpoint === 's3.cn-north-1.amazonaws.com.cn';
}

/**
 * isVirtualHostStyle - verify if bucket name is support with virtual
 * hosts. bucketNames with periods should be always treated as path
 * style if the protocol is 'https:', this is due to SSL wildcard
 * limitation. For all other buckets and Amazon S3 endpoint we will
 * default to virtual host style.
 */
export function isVirtualHostStyle(endpoint, protocol, bucket, pathStyle) {
  if (protocol === 'https:' && bucket.includes('.')) {
    return false;
  }
  return isAmazonEndpoint(endpoint) || !pathStyle;
}
export function isValidIP(ip) {
  return ipaddr.isValid(ip);
}

/**
 * @returns if endpoint is valid domain.
 */
export function isValidEndpoint(endpoint) {
  return isValidDomain(endpoint) || isValidIP(endpoint);
}

/**
 * @returns if input host is a valid domain.
 */
export function isValidDomain(host) {
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
export function probeContentType(path) {
  let contentType = mime.lookup(path);
  if (!contentType) {
    contentType = 'application/octet-stream';
  }
  return contentType;
}

/**
 * is input port valid.
 */
export function isValidPort(port) {
  // verify if port is a number.
  if (!isNumber(port)) {
    return false;
  }

  // port `0` is valid and special case
  return 0 <= port && port <= 65535;
}
export function isValidBucketName(bucket) {
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
export function isValidObjectName(objectName) {
  if (!isValidPrefix(objectName)) {
    return false;
  }
  return objectName.length !== 0;
}

/**
 * check if prefix is valid
 */
export function isValidPrefix(prefix) {
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
export function isNumber(arg) {
  return typeof arg === 'number';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any

/**
 * check if typeof arg function
 */
export function isFunction(arg) {
  return typeof arg === 'function';
}

/**
 * check if typeof arg string
 */
export function isString(arg) {
  return typeof arg === 'string';
}

/**
 * check if typeof arg object
 */
export function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

/**
 * check if object is readable stream
 */
export function isReadableStream(arg) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  return isObject(arg) && isFunction(arg._read);
}

/**
 * check if arg is boolean
 */
export function isBoolean(arg) {
  return typeof arg === 'boolean';
}
export function isEmpty(o) {
  return _.isEmpty(o);
}
export function isEmptyObject(o) {
  return Object.values(o).filter(x => x !== undefined).length !== 0;
}
export function isDefined(o) {
  return o !== null && o !== undefined;
}

/**
 * check if arg is a valid date
 */
export function isValidDate(arg) {
  // @ts-expect-error checknew Date(Math.NaN)
  return arg instanceof Date && !isNaN(arg);
}

/**
 * Create a Date string with format: 'YYYYMMDDTHHmmss' + Z
 */
export function makeDateLong(date) {
  date = date || new Date();

  // Gives format like: '2017-08-07T16:28:59.889Z'
  const s = date.toISOString();
  return s.slice(0, 4) + s.slice(5, 7) + s.slice(8, 13) + s.slice(14, 16) + s.slice(17, 19) + 'Z';
}

/**
 * Create a Date string with format: 'YYYYMMDD'
 */
export function makeDateShort(date) {
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
export function pipesetup(...streams) {
  // @ts-expect-error ts can't narrow this
  return streams.reduce((src, dst) => {
    src.on('error', err => dst.emit('error', err));
    return src.pipe(dst);
  });
}

/**
 * return a Readable stream that emits data
 */
export function readableStream(data) {
  const s = new stream.Readable();
  s._read = () => {};
  s.push(data);
  s.push(null);
  return s;
}

/**
 * Process metadata to insert appropriate value to `content-type` attribute
 */
export function insertContentType(metaData, filePath) {
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
export function prependXAMZMeta(metaData) {
  if (!metaData) {
    return {};
  }
  return _.mapKeys(metaData, (value, key) => {
    if (isAmzHeader(key) || isSupportedHeader(key) || isStorageClassHeader(key)) {
      return key;
    }
    return MetaDataHeaderPrefix + key;
  });
}

/**
 * Checks if it is a valid header according to the AmazonS3 API
 */
export function isAmzHeader(key) {
  const temp = key.toLowerCase();
  return temp.startsWith(MetaDataHeaderPrefix) || temp === 'x-amz-acl' || temp.startsWith('x-amz-server-side-encryption-') || temp === 'x-amz-server-side-encryption';
}

/**
 * Checks if it is a supported Header
 */
export function isSupportedHeader(key) {
  const supported_headers = ['content-type', 'cache-control', 'content-encoding', 'content-disposition', 'content-language', 'x-amz-website-redirect-location'];
  return supported_headers.includes(key.toLowerCase());
}

/**
 * Checks if it is a storage header
 */
export function isStorageClassHeader(key) {
  return key.toLowerCase() === 'x-amz-storage-class';
}
export function extractMetadata(headers) {
  return _.mapKeys(_.pickBy(headers, (value, key) => isSupportedHeader(key) || isStorageClassHeader(key) || isAmzHeader(key)), (value, key) => {
    const lower = key.toLowerCase();
    if (lower.startsWith(MetaDataHeaderPrefix)) {
      return lower.slice(MetaDataHeaderPrefix.length);
    }
    return key;
  });
}
export function getVersionId(headers = {}) {
  return headers['x-amz-version-id'] || null;
}
export function getSourceVersionId(headers = {}) {
  return headers['x-amz-copy-source-version-id'] || null;
}
export function sanitizeETag(etag = '') {
  const replaceChars = {
    '"': '',
    '&quot;': '',
    '&#34;': '',
    '&QUOT;': '',
    '&#x00022': ''
  };
  return etag.replace(/^("|&quot;|&#34;)|("|&quot;|&#34;)$/g, m => replaceChars[m]);
}
export function toMd5(payload) {
  // use string from browser and buffer from nodejs
  // browser support is tested only against minio server
  return crypto.createHash('md5').update(Buffer.from(payload)).digest().toString('base64');
}
export function toSha256(payload) {
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * toArray returns a single element array with param being the element,
 * if param is just a string, and returns 'param' back if it is an array
 * So, it makes sure param is always an array
 */
export function toArray(param) {
  if (!Array.isArray(param)) {
    return [param];
  }
  return param;
}
export function sanitizeObjectKey(objectName) {
  // + symbol characters are not decoded as spaces in JS. so replace them first and decode to get the correct result.
  const asStrName = (objectName ? objectName.toString() : '').replace(/\+/g, ' ');
  return decodeURIComponent(asStrName);
}
export function sanitizeSize(size) {
  return size ? Number.parseInt(size) : undefined;
}
export const PART_CONSTRAINTS = {
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
export function getEncryptionHeaders(encConfig) {
  const encType = encConfig.type;
  if (!isEmpty(encType)) {
    if (encType === ENCRYPTION_TYPES.SSEC) {
      return {
        [ENCRYPTION_HEADERS.sseGenericHeader]: 'AES256'
      };
    } else if (encType === ENCRYPTION_TYPES.KMS) {
      return {
        [ENCRYPTION_HEADERS.sseGenericHeader]: encConfig.SSEAlgorithm,
        [ENCRYPTION_HEADERS.sseKmsKeyID]: encConfig.KMSMasterKeyID
      };
    }
  }
  return {};
}
export function partsRequired(size) {
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
export function calculateEvenSplits(size, objInfo) {
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
const fxp = new XMLParser();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseXml(xml) {
  const result = fxp.parse(xml);
  if (result.Error) {
    throw result.Error;
  }
  return result;
}

/**
 * get content size of object content to upload
 */
export async function getContentLength(s) {
  // use length property of string | Buffer
  if (typeof s === 'string' || Buffer.isBuffer(s)) {
    return s.length;
  }

  // property of `fs.ReadStream`
  const filePath = s.path;
  if (filePath && typeof filePath === 'string') {
    const stat = await fsp.lstat(filePath);
    return stat.size;
  }

  // property of `fs.ReadStream`
  const fd = s.fd;
  if (fd && typeof fd === 'number') {
    const stat = await fstat(fd);
    return stat.size;
  }
  return null;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjcnlwdG8iLCJzdHJlYW0iLCJYTUxQYXJzZXIiLCJpcGFkZHIiLCJfIiwibWltZSIsImZzcCIsImZzdGF0IiwiRU5DUllQVElPTl9UWVBFUyIsIk1ldGFEYXRhSGVhZGVyUHJlZml4IiwiaGFzaEJpbmFyeSIsImJ1ZiIsImVuYWJsZVNIQTI1NiIsInNoYTI1NnN1bSIsImNyZWF0ZUhhc2giLCJ1cGRhdGUiLCJkaWdlc3QiLCJtZDVzdW0iLCJlbmNvZGVBc0hleCIsImMiLCJjaGFyQ29kZUF0IiwidG9TdHJpbmciLCJ0b1VwcGVyQ2FzZSIsInVyaUVzY2FwZSIsInVyaVN0ciIsImVuY29kZVVSSUNvbXBvbmVudCIsInJlcGxhY2UiLCJ1cmlSZXNvdXJjZUVzY2FwZSIsInN0cmluZyIsImdldFNjb3BlIiwicmVnaW9uIiwiZGF0ZSIsInNlcnZpY2VOYW1lIiwibWFrZURhdGVTaG9ydCIsImlzQW1hem9uRW5kcG9pbnQiLCJlbmRwb2ludCIsImlzVmlydHVhbEhvc3RTdHlsZSIsInByb3RvY29sIiwiYnVja2V0IiwicGF0aFN0eWxlIiwiaW5jbHVkZXMiLCJpc1ZhbGlkSVAiLCJpcCIsImlzVmFsaWQiLCJpc1ZhbGlkRW5kcG9pbnQiLCJpc1ZhbGlkRG9tYWluIiwiaG9zdCIsImlzU3RyaW5nIiwibGVuZ3RoIiwic2xpY2UiLCJub25BbHBoYU51bWVyaWNzIiwiY2hhciIsInByb2JlQ29udGVudFR5cGUiLCJwYXRoIiwiY29udGVudFR5cGUiLCJsb29rdXAiLCJpc1ZhbGlkUG9ydCIsInBvcnQiLCJpc051bWJlciIsImlzVmFsaWRCdWNrZXROYW1lIiwidGVzdCIsImlzVmFsaWRPYmplY3ROYW1lIiwib2JqZWN0TmFtZSIsImlzVmFsaWRQcmVmaXgiLCJwcmVmaXgiLCJhcmciLCJpc0Z1bmN0aW9uIiwiaXNPYmplY3QiLCJpc1JlYWRhYmxlU3RyZWFtIiwiX3JlYWQiLCJpc0Jvb2xlYW4iLCJpc0VtcHR5IiwibyIsImlzRW1wdHlPYmplY3QiLCJPYmplY3QiLCJ2YWx1ZXMiLCJmaWx0ZXIiLCJ4IiwidW5kZWZpbmVkIiwiaXNEZWZpbmVkIiwiaXNWYWxpZERhdGUiLCJEYXRlIiwiaXNOYU4iLCJtYWtlRGF0ZUxvbmciLCJzIiwidG9JU09TdHJpbmciLCJwaXBlc2V0dXAiLCJzdHJlYW1zIiwicmVkdWNlIiwic3JjIiwiZHN0Iiwib24iLCJlcnIiLCJlbWl0IiwicGlwZSIsInJlYWRhYmxlU3RyZWFtIiwiZGF0YSIsIlJlYWRhYmxlIiwicHVzaCIsImluc2VydENvbnRlbnRUeXBlIiwibWV0YURhdGEiLCJmaWxlUGF0aCIsImtleSIsInRvTG93ZXJDYXNlIiwicHJlcGVuZFhBTVpNZXRhIiwibWFwS2V5cyIsInZhbHVlIiwiaXNBbXpIZWFkZXIiLCJpc1N1cHBvcnRlZEhlYWRlciIsImlzU3RvcmFnZUNsYXNzSGVhZGVyIiwidGVtcCIsInN0YXJ0c1dpdGgiLCJzdXBwb3J0ZWRfaGVhZGVycyIsImV4dHJhY3RNZXRhZGF0YSIsImhlYWRlcnMiLCJwaWNrQnkiLCJsb3dlciIsImdldFZlcnNpb25JZCIsImdldFNvdXJjZVZlcnNpb25JZCIsInNhbml0aXplRVRhZyIsImV0YWciLCJyZXBsYWNlQ2hhcnMiLCJtIiwidG9NZDUiLCJwYXlsb2FkIiwiQnVmZmVyIiwiZnJvbSIsInRvU2hhMjU2IiwidG9BcnJheSIsInBhcmFtIiwiQXJyYXkiLCJpc0FycmF5Iiwic2FuaXRpemVPYmplY3RLZXkiLCJhc1N0ck5hbWUiLCJkZWNvZGVVUklDb21wb25lbnQiLCJzYW5pdGl6ZVNpemUiLCJzaXplIiwiTnVtYmVyIiwicGFyc2VJbnQiLCJQQVJUX0NPTlNUUkFJTlRTIiwiQUJTX01JTl9QQVJUX1NJWkUiLCJNSU5fUEFSVF9TSVpFIiwiTUFYX1BBUlRTX0NPVU5UIiwiTUFYX1BBUlRfU0laRSIsIk1BWF9TSU5HTEVfUFVUX09CSkVDVF9TSVpFIiwiTUFYX01VTFRJUEFSVF9QVVRfT0JKRUNUX1NJWkUiLCJHRU5FUklDX1NTRV9IRUFERVIiLCJFTkNSWVBUSU9OX0hFQURFUlMiLCJzc2VHZW5lcmljSGVhZGVyIiwic3NlS21zS2V5SUQiLCJnZXRFbmNyeXB0aW9uSGVhZGVycyIsImVuY0NvbmZpZyIsImVuY1R5cGUiLCJ0eXBlIiwiU1NFQyIsIktNUyIsIlNTRUFsZ29yaXRobSIsIktNU01hc3RlcktleUlEIiwicGFydHNSZXF1aXJlZCIsIm1heFBhcnRTaXplIiwicmVxdWlyZWRQYXJ0U2l6ZSIsIk1hdGgiLCJ0cnVuYyIsImNhbGN1bGF0ZUV2ZW5TcGxpdHMiLCJvYmpJbmZvIiwicmVxUGFydHMiLCJzdGFydEluZGV4UGFydHMiLCJlbmRJbmRleFBhcnRzIiwic3RhcnQiLCJTdGFydCIsImRpdmlzb3JWYWx1ZSIsInJlbWluZGVyVmFsdWUiLCJuZXh0U3RhcnQiLCJpIiwiY3VyUGFydFNpemUiLCJjdXJyZW50U3RhcnQiLCJjdXJyZW50RW5kIiwic3RhcnRJbmRleCIsImVuZEluZGV4IiwiZnhwIiwicGFyc2VYbWwiLCJ4bWwiLCJyZXN1bHQiLCJwYXJzZSIsIkVycm9yIiwiZ2V0Q29udGVudExlbmd0aCIsImlzQnVmZmVyIiwic3RhdCIsImxzdGF0IiwiZmQiXSwic291cmNlcyI6WyJoZWxwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLypcbiAqIE1pbklPIEphdmFzY3JpcHQgTGlicmFyeSBmb3IgQW1hem9uIFMzIENvbXBhdGlibGUgQ2xvdWQgU3RvcmFnZSwgKEMpIDIwMTUgTWluSU8sIEluYy5cbiAqXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XG4gKlxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKi9cblxuaW1wb3J0ICogYXMgY3J5cHRvIGZyb20gJ25vZGU6Y3J5cHRvJ1xuaW1wb3J0ICogYXMgc3RyZWFtIGZyb20gJ25vZGU6c3RyZWFtJ1xuXG5pbXBvcnQgeyBYTUxQYXJzZXIgfSBmcm9tICdmYXN0LXhtbC1wYXJzZXInXG5pbXBvcnQgaXBhZGRyIGZyb20gJ2lwYWRkci5qcydcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCdcbmltcG9ydCAqIGFzIG1pbWUgZnJvbSAnbWltZS10eXBlcydcblxuaW1wb3J0IHsgZnNwLCBmc3RhdCB9IGZyb20gJy4vYXN5bmMudHMnXG5pbXBvcnQgdHlwZSB7IEJpbmFyeSwgRW5jcnlwdGlvbiwgT2JqZWN0TWV0YURhdGEsIFJlcXVlc3RIZWFkZXJzLCBSZXNwb25zZUhlYWRlciB9IGZyb20gJy4vdHlwZS50cydcbmltcG9ydCB7IEVOQ1JZUFRJT05fVFlQRVMgfSBmcm9tICcuL3R5cGUudHMnXG5cbmNvbnN0IE1ldGFEYXRhSGVhZGVyUHJlZml4ID0gJ3gtYW16LW1ldGEtJ1xuXG5leHBvcnQgZnVuY3Rpb24gaGFzaEJpbmFyeShidWY6IEJ1ZmZlciwgZW5hYmxlU0hBMjU2OiBib29sZWFuKSB7XG4gIGxldCBzaGEyNTZzdW0gPSAnJ1xuICBpZiAoZW5hYmxlU0hBMjU2KSB7XG4gICAgc2hhMjU2c3VtID0gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShidWYpLmRpZ2VzdCgnaGV4JylcbiAgfVxuICBjb25zdCBtZDVzdW0gPSBjcnlwdG8uY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKGJ1ZikuZGlnZXN0KCdiYXNlNjQnKVxuXG4gIHJldHVybiB7IG1kNXN1bSwgc2hhMjU2c3VtIH1cbn1cblxuLy8gUzMgcGVyY2VudC1lbmNvZGVzIHNvbWUgZXh0cmEgbm9uLXN0YW5kYXJkIGNoYXJhY3RlcnMgaW4gYSBVUkkgLiBTbyBjb21wbHkgd2l0aCBTMy5cbmNvbnN0IGVuY29kZUFzSGV4ID0gKGM6IHN0cmluZykgPT4gYCUke2MuY2hhckNvZGVBdCgwKS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKX1gXG5leHBvcnQgZnVuY3Rpb24gdXJpRXNjYXBlKHVyaVN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGVuY29kZVVSSUNvbXBvbmVudCh1cmlTdHIpLnJlcGxhY2UoL1shJygpKl0vZywgZW5jb2RlQXNIZXgpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cmlSZXNvdXJjZUVzY2FwZShzdHJpbmc6IHN0cmluZykge1xuICByZXR1cm4gdXJpRXNjYXBlKHN0cmluZykucmVwbGFjZSgvJTJGL2csICcvJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNjb3BlKHJlZ2lvbjogc3RyaW5nLCBkYXRlOiBEYXRlLCBzZXJ2aWNlTmFtZSA9ICdzMycpIHtcbiAgcmV0dXJuIGAke21ha2VEYXRlU2hvcnQoZGF0ZSl9LyR7cmVnaW9ufS8ke3NlcnZpY2VOYW1lfS9hd3M0X3JlcXVlc3RgXG59XG5cbi8qKlxuICogaXNBbWF6b25FbmRwb2ludCAtIHRydWUgaWYgZW5kcG9pbnQgaXMgJ3MzLmFtYXpvbmF3cy5jb20nIG9yICdzMy5jbi1ub3J0aC0xLmFtYXpvbmF3cy5jb20uY24nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FtYXpvbkVuZHBvaW50KGVuZHBvaW50OiBzdHJpbmcpIHtcbiAgcmV0dXJuIGVuZHBvaW50ID09PSAnczMuYW1hem9uYXdzLmNvbScgfHwgZW5kcG9pbnQgPT09ICdzMy5jbi1ub3J0aC0xLmFtYXpvbmF3cy5jb20uY24nXG59XG5cbi8qKlxuICogaXNWaXJ0dWFsSG9zdFN0eWxlIC0gdmVyaWZ5IGlmIGJ1Y2tldCBuYW1lIGlzIHN1cHBvcnQgd2l0aCB2aXJ0dWFsXG4gKiBob3N0cy4gYnVja2V0TmFtZXMgd2l0aCBwZXJpb2RzIHNob3VsZCBiZSBhbHdheXMgdHJlYXRlZCBhcyBwYXRoXG4gKiBzdHlsZSBpZiB0aGUgcHJvdG9jb2wgaXMgJ2h0dHBzOicsIHRoaXMgaXMgZHVlIHRvIFNTTCB3aWxkY2FyZFxuICogbGltaXRhdGlvbi4gRm9yIGFsbCBvdGhlciBidWNrZXRzIGFuZCBBbWF6b24gUzMgZW5kcG9pbnQgd2Ugd2lsbFxuICogZGVmYXVsdCB0byB2aXJ0dWFsIGhvc3Qgc3R5bGUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZpcnR1YWxIb3N0U3R5bGUoZW5kcG9pbnQ6IHN0cmluZywgcHJvdG9jb2w6IHN0cmluZywgYnVja2V0OiBzdHJpbmcsIHBhdGhTdHlsZTogYm9vbGVhbikge1xuICBpZiAocHJvdG9jb2wgPT09ICdodHRwczonICYmIGJ1Y2tldC5pbmNsdWRlcygnLicpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgcmV0dXJuIGlzQW1hem9uRW5kcG9pbnQoZW5kcG9pbnQpIHx8ICFwYXRoU3R5bGVcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRJUChpcDogc3RyaW5nKSB7XG4gIHJldHVybiBpcGFkZHIuaXNWYWxpZChpcClcbn1cblxuLyoqXG4gKiBAcmV0dXJucyBpZiBlbmRwb2ludCBpcyB2YWxpZCBkb21haW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkRW5kcG9pbnQoZW5kcG9pbnQ6IHN0cmluZykge1xuICByZXR1cm4gaXNWYWxpZERvbWFpbihlbmRwb2ludCkgfHwgaXNWYWxpZElQKGVuZHBvaW50KVxufVxuXG4vKipcbiAqIEByZXR1cm5zIGlmIGlucHV0IGhvc3QgaXMgYSB2YWxpZCBkb21haW4uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkRG9tYWluKGhvc3Q6IHN0cmluZykge1xuICBpZiAoIWlzU3RyaW5nKGhvc3QpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gU2VlIFJGQyAxMDM1LCBSRkMgMzY5Ni5cbiAgaWYgKGhvc3QubGVuZ3RoID09PSAwIHx8IGhvc3QubGVuZ3RoID4gMjU1KSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gSG9zdCBjYW5ub3Qgc3RhcnQgb3IgZW5kIHdpdGggYSAnLSdcbiAgaWYgKGhvc3RbMF0gPT09ICctJyB8fCBob3N0LnNsaWNlKC0xKSA9PT0gJy0nKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gSG9zdCBjYW5ub3Qgc3RhcnQgb3IgZW5kIHdpdGggYSAnXydcbiAgaWYgKGhvc3RbMF0gPT09ICdfJyB8fCBob3N0LnNsaWNlKC0xKSA9PT0gJ18nKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gSG9zdCBjYW5ub3Qgc3RhcnQgd2l0aCBhICcuJ1xuICBpZiAoaG9zdFswXSA9PT0gJy4nKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBjb25zdCBub25BbHBoYU51bWVyaWNzID0gJ2B+IUAjJCVeJiooKSs9e31bXXxcXFxcXCJcXCc7Oj48Py8nXG4gIC8vIEFsbCBub24gYWxwaGFudW1lcmljIGNoYXJhY3RlcnMgYXJlIGludmFsaWQuXG4gIGZvciAoY29uc3QgY2hhciBvZiBub25BbHBoYU51bWVyaWNzKSB7XG4gICAgaWYgKGhvc3QuaW5jbHVkZXMoY2hhcikpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuICAvLyBObyBuZWVkIHRvIHJlZ2V4cCBtYXRjaCwgc2luY2UgdGhlIGxpc3QgaXMgbm9uLWV4aGF1c3RpdmUuXG4gIC8vIFdlIGxldCBpdCBiZSB2YWxpZCBhbmQgZmFpbCBsYXRlci5cbiAgcmV0dXJuIHRydWVcbn1cblxuLyoqXG4gKiBQcm9iZXMgY29udGVudFR5cGUgdXNpbmcgZmlsZSBleHRlbnNpb25zLlxuICpcbiAqIEBleGFtcGxlXG4gKiBgYGBcbiAqIC8vIHJldHVybiAnaW1hZ2UvcG5nJ1xuICogcHJvYmVDb250ZW50VHlwZSgnZmlsZS5wbmcnKVxuICogYGBgXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwcm9iZUNvbnRlbnRUeXBlKHBhdGg6IHN0cmluZykge1xuICBsZXQgY29udGVudFR5cGUgPSBtaW1lLmxvb2t1cChwYXRoKVxuICBpZiAoIWNvbnRlbnRUeXBlKSB7XG4gICAgY29udGVudFR5cGUgPSAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtJ1xuICB9XG4gIHJldHVybiBjb250ZW50VHlwZVxufVxuXG4vKipcbiAqIGlzIGlucHV0IHBvcnQgdmFsaWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkUG9ydChwb3J0OiB1bmtub3duKTogcG9ydCBpcyBudW1iZXIge1xuICAvLyB2ZXJpZnkgaWYgcG9ydCBpcyBhIG51bWJlci5cbiAgaWYgKCFpc051bWJlcihwb3J0KSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgLy8gcG9ydCBgMGAgaXMgdmFsaWQgYW5kIHNwZWNpYWwgY2FzZVxuICByZXR1cm4gMCA8PSBwb3J0ICYmIHBvcnQgPD0gNjU1MzVcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWRCdWNrZXROYW1lKGJ1Y2tldDogdW5rbm93bikge1xuICBpZiAoIWlzU3RyaW5nKGJ1Y2tldCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuXG4gIC8vIGJ1Y2tldCBsZW5ndGggc2hvdWxkIGJlIGxlc3MgdGhhbiBhbmQgbm8gbW9yZSB0aGFuIDYzXG4gIC8vIGNoYXJhY3RlcnMgbG9uZy5cbiAgaWYgKGJ1Y2tldC5sZW5ndGggPCAzIHx8IGJ1Y2tldC5sZW5ndGggPiA2Mykge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG4gIC8vIGJ1Y2tldCB3aXRoIHN1Y2Nlc3NpdmUgcGVyaW9kcyBpcyBpbnZhbGlkLlxuICBpZiAoYnVja2V0LmluY2x1ZGVzKCcuLicpKSB7XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbiAgLy8gYnVja2V0IGNhbm5vdCBoYXZlIGlwIGFkZHJlc3Mgc3R5bGUuXG4gIGlmICgvWzAtOV0rXFwuWzAtOV0rXFwuWzAtOV0rXFwuWzAtOV0rLy50ZXN0KGJ1Y2tldCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICAvLyBidWNrZXQgc2hvdWxkIGJlZ2luIHdpdGggYWxwaGFiZXQvbnVtYmVyIGFuZCBlbmQgd2l0aCBhbHBoYWJldC9udW1iZXIsXG4gIC8vIHdpdGggYWxwaGFiZXQvbnVtYmVyLy4tIGluIHRoZSBtaWRkbGUuXG4gIGlmICgvXlthLXowLTldW2EtejAtOS4tXStbYS16MC05XSQvLnRlc3QoYnVja2V0KSkge1xuICAgIHJldHVybiB0cnVlXG4gIH1cbiAgcmV0dXJuIGZhbHNlXG59XG5cbi8qKlxuICogY2hlY2sgaWYgb2JqZWN0TmFtZSBpcyBhIHZhbGlkIG9iamVjdCBuYW1lXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkT2JqZWN0TmFtZShvYmplY3ROYW1lOiB1bmtub3duKSB7XG4gIGlmICghaXNWYWxpZFByZWZpeChvYmplY3ROYW1lKSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG5cbiAgcmV0dXJuIG9iamVjdE5hbWUubGVuZ3RoICE9PSAwXG59XG5cbi8qKlxuICogY2hlY2sgaWYgcHJlZml4IGlzIHZhbGlkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1ZhbGlkUHJlZml4KHByZWZpeDogdW5rbm93bik6IHByZWZpeCBpcyBzdHJpbmcge1xuICBpZiAoIWlzU3RyaW5nKHByZWZpeCkpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICBpZiAocHJlZml4Lmxlbmd0aCA+IDEwMjQpIHtcbiAgICByZXR1cm4gZmFsc2VcbiAgfVxuICByZXR1cm4gdHJ1ZVxufVxuXG4vKipcbiAqIGNoZWNrIGlmIHR5cGVvZiBhcmcgbnVtYmVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc051bWJlcihhcmc6IHVua25vd24pOiBhcmcgaXMgbnVtYmVyIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInXG59XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG5leHBvcnQgdHlwZSBBbnlGdW5jdGlvbiA9ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55XG5cbi8qKlxuICogY2hlY2sgaWYgdHlwZW9mIGFyZyBmdW5jdGlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNGdW5jdGlvbihhcmc6IHVua25vd24pOiBhcmcgaXMgQW55RnVuY3Rpb24ge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJ1xufVxuXG4vKipcbiAqIGNoZWNrIGlmIHR5cGVvZiBhcmcgc3RyaW5nXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZyhhcmc6IHVua25vd24pOiBhcmcgaXMgc3RyaW5nIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdzdHJpbmcnXG59XG5cbi8qKlxuICogY2hlY2sgaWYgdHlwZW9mIGFyZyBvYmplY3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzT2JqZWN0KGFyZzogdW5rbm93bik6IGFyZyBpcyBvYmplY3Qge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsXG59XG5cbi8qKlxuICogY2hlY2sgaWYgb2JqZWN0IGlzIHJlYWRhYmxlIHN0cmVhbVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNSZWFkYWJsZVN0cmVhbShhcmc6IHVua25vd24pOiBhcmcgaXMgc3RyZWFtLlJlYWRhYmxlIHtcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC91bmJvdW5kLW1ldGhvZFxuICByZXR1cm4gaXNPYmplY3QoYXJnKSAmJiBpc0Z1bmN0aW9uKChhcmcgYXMgc3RyZWFtLlJlYWRhYmxlKS5fcmVhZClcbn1cblxuLyoqXG4gKiBjaGVjayBpZiBhcmcgaXMgYm9vbGVhblxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNCb29sZWFuKGFyZzogdW5rbm93bik6IGFyZyBpcyBib29sZWFuIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFbXB0eShvOiB1bmtub3duKTogbyBpcyBudWxsIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIF8uaXNFbXB0eShvKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNFbXB0eU9iamVjdChvOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IGJvb2xlYW4ge1xuICByZXR1cm4gT2JqZWN0LnZhbHVlcyhvKS5maWx0ZXIoKHgpID0+IHggIT09IHVuZGVmaW5lZCkubGVuZ3RoICE9PSAwXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RlZmluZWQ8VD4obzogVCk6IG8gaXMgRXhjbHVkZTxULCBudWxsIHwgdW5kZWZpbmVkPiB7XG4gIHJldHVybiBvICE9PSBudWxsICYmIG8gIT09IHVuZGVmaW5lZFxufVxuXG4vKipcbiAqIGNoZWNrIGlmIGFyZyBpcyBhIHZhbGlkIGRhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzVmFsaWREYXRlKGFyZzogdW5rbm93bik6IGFyZyBpcyBEYXRlIHtcbiAgLy8gQHRzLWV4cGVjdC1lcnJvciBjaGVja25ldyBEYXRlKE1hdGguTmFOKVxuICByZXR1cm4gYXJnIGluc3RhbmNlb2YgRGF0ZSAmJiAhaXNOYU4oYXJnKVxufVxuXG4vKipcbiAqIENyZWF0ZSBhIERhdGUgc3RyaW5nIHdpdGggZm9ybWF0OiAnWVlZWU1NRERUSEhtbXNzJyArIFpcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VEYXRlTG9uZyhkYXRlPzogRGF0ZSk6IHN0cmluZyB7XG4gIGRhdGUgPSBkYXRlIHx8IG5ldyBEYXRlKClcblxuICAvLyBHaXZlcyBmb3JtYXQgbGlrZTogJzIwMTctMDgtMDdUMTY6Mjg6NTkuODg5WidcbiAgY29uc3QgcyA9IGRhdGUudG9JU09TdHJpbmcoKVxuXG4gIHJldHVybiBzLnNsaWNlKDAsIDQpICsgcy5zbGljZSg1LCA3KSArIHMuc2xpY2UoOCwgMTMpICsgcy5zbGljZSgxNCwgMTYpICsgcy5zbGljZSgxNywgMTkpICsgJ1onXG59XG5cbi8qKlxuICogQ3JlYXRlIGEgRGF0ZSBzdHJpbmcgd2l0aCBmb3JtYXQ6ICdZWVlZTU1ERCdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1ha2VEYXRlU2hvcnQoZGF0ZT86IERhdGUpIHtcbiAgZGF0ZSA9IGRhdGUgfHwgbmV3IERhdGUoKVxuXG4gIC8vIEdpdmVzIGZvcm1hdCBsaWtlOiAnMjAxNy0wOC0wN1QxNjoyODo1OS44ODlaJ1xuICBjb25zdCBzID0gZGF0ZS50b0lTT1N0cmluZygpXG5cbiAgcmV0dXJuIHMuc2xpY2UoMCwgNCkgKyBzLnNsaWNlKDUsIDcpICsgcy5zbGljZSg4LCAxMClcbn1cblxuLyoqXG4gKiBwaXBlc2V0dXAgc2V0cyB1cCBwaXBlKCkgZnJvbSBsZWZ0IHRvIHJpZ2h0IG9zIHN0cmVhbXMgYXJyYXlcbiAqIHBpcGVzZXR1cCB3aWxsIGFsc28gbWFrZSBzdXJlIHRoYXQgZXJyb3IgZW1pdHRlZCBhdCBhbnkgb2YgdGhlIHVwc3RyZWFtIFN0cmVhbVxuICogd2lsbCBiZSBlbWl0dGVkIGF0IHRoZSBsYXN0IHN0cmVhbS4gVGhpcyBtYWtlcyBlcnJvciBoYW5kbGluZyBzaW1wbGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBpcGVzZXR1cCguLi5zdHJlYW1zOiBbc3RyZWFtLlJlYWRhYmxlLCAuLi5zdHJlYW0uRHVwbGV4W10sIHN0cmVhbS5Xcml0YWJsZV0pIHtcbiAgLy8gQHRzLWV4cGVjdC1lcnJvciB0cyBjYW4ndCBuYXJyb3cgdGhpc1xuICByZXR1cm4gc3RyZWFtcy5yZWR1Y2UoKHNyYzogc3RyZWFtLlJlYWRhYmxlLCBkc3Q6IHN0cmVhbS5Xcml0YWJsZSkgPT4ge1xuICAgIHNyYy5vbignZXJyb3InLCAoZXJyKSA9PiBkc3QuZW1pdCgnZXJyb3InLCBlcnIpKVxuICAgIHJldHVybiBzcmMucGlwZShkc3QpXG4gIH0pXG59XG5cbi8qKlxuICogcmV0dXJuIGEgUmVhZGFibGUgc3RyZWFtIHRoYXQgZW1pdHMgZGF0YVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVhZGFibGVTdHJlYW0oZGF0YTogdW5rbm93bik6IHN0cmVhbS5SZWFkYWJsZSB7XG4gIGNvbnN0IHMgPSBuZXcgc3RyZWFtLlJlYWRhYmxlKClcbiAgcy5fcmVhZCA9ICgpID0+IHt9XG4gIHMucHVzaChkYXRhKVxuICBzLnB1c2gobnVsbClcbiAgcmV0dXJuIHNcbn1cblxuLyoqXG4gKiBQcm9jZXNzIG1ldGFkYXRhIHRvIGluc2VydCBhcHByb3ByaWF0ZSB2YWx1ZSB0byBgY29udGVudC10eXBlYCBhdHRyaWJ1dGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluc2VydENvbnRlbnRUeXBlKG1ldGFEYXRhOiBPYmplY3RNZXRhRGF0YSwgZmlsZVBhdGg6IHN0cmluZyk6IE9iamVjdE1ldGFEYXRhIHtcbiAgLy8gY2hlY2sgaWYgY29udGVudC10eXBlIGF0dHJpYnV0ZSBwcmVzZW50IGluIG1ldGFEYXRhXG4gIGZvciAoY29uc3Qga2V5IGluIG1ldGFEYXRhKSB7XG4gICAgaWYgKGtleS50b0xvd2VyQ2FzZSgpID09PSAnY29udGVudC10eXBlJykge1xuICAgICAgcmV0dXJuIG1ldGFEYXRhXG4gICAgfVxuICB9XG5cbiAgLy8gaWYgYGNvbnRlbnQtdHlwZWAgYXR0cmlidXRlIGlzIG5vdCBwcmVzZW50IGluIG1ldGFkYXRhLCB0aGVuIGluZmVyIGl0IGZyb20gdGhlIGV4dGVuc2lvbiBpbiBmaWxlUGF0aFxuICByZXR1cm4ge1xuICAgIC4uLm1ldGFEYXRhLFxuICAgICdjb250ZW50LXR5cGUnOiBwcm9iZUNvbnRlbnRUeXBlKGZpbGVQYXRoKSxcbiAgfVxufVxuXG4vKipcbiAqIEZ1bmN0aW9uIHByZXBlbmRzIG1ldGFkYXRhIHdpdGggdGhlIGFwcHJvcHJpYXRlIHByZWZpeCBpZiBpdCBpcyBub3QgYWxyZWFkeSBvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcHJlcGVuZFhBTVpNZXRhKG1ldGFEYXRhPzogT2JqZWN0TWV0YURhdGEpOiBSZXF1ZXN0SGVhZGVycyB7XG4gIGlmICghbWV0YURhdGEpIHtcbiAgICByZXR1cm4ge31cbiAgfVxuXG4gIHJldHVybiBfLm1hcEtleXMobWV0YURhdGEsICh2YWx1ZSwga2V5KSA9PiB7XG4gICAgaWYgKGlzQW16SGVhZGVyKGtleSkgfHwgaXNTdXBwb3J0ZWRIZWFkZXIoa2V5KSB8fCBpc1N0b3JhZ2VDbGFzc0hlYWRlcihrZXkpKSB7XG4gICAgICByZXR1cm4ga2V5XG4gICAgfVxuXG4gICAgcmV0dXJuIE1ldGFEYXRhSGVhZGVyUHJlZml4ICsga2V5XG4gIH0pXG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIGl0IGlzIGEgdmFsaWQgaGVhZGVyIGFjY29yZGluZyB0byB0aGUgQW1hem9uUzMgQVBJXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0FtekhlYWRlcihrZXk6IHN0cmluZykge1xuICBjb25zdCB0ZW1wID0ga2V5LnRvTG93ZXJDYXNlKClcbiAgcmV0dXJuIChcbiAgICB0ZW1wLnN0YXJ0c1dpdGgoTWV0YURhdGFIZWFkZXJQcmVmaXgpIHx8XG4gICAgdGVtcCA9PT0gJ3gtYW16LWFjbCcgfHxcbiAgICB0ZW1wLnN0YXJ0c1dpdGgoJ3gtYW16LXNlcnZlci1zaWRlLWVuY3J5cHRpb24tJykgfHxcbiAgICB0ZW1wID09PSAneC1hbXotc2VydmVyLXNpZGUtZW5jcnlwdGlvbidcbiAgKVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBpdCBpcyBhIHN1cHBvcnRlZCBIZWFkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU3VwcG9ydGVkSGVhZGVyKGtleTogc3RyaW5nKSB7XG4gIGNvbnN0IHN1cHBvcnRlZF9oZWFkZXJzID0gW1xuICAgICdjb250ZW50LXR5cGUnLFxuICAgICdjYWNoZS1jb250cm9sJyxcbiAgICAnY29udGVudC1lbmNvZGluZycsXG4gICAgJ2NvbnRlbnQtZGlzcG9zaXRpb24nLFxuICAgICdjb250ZW50LWxhbmd1YWdlJyxcbiAgICAneC1hbXotd2Vic2l0ZS1yZWRpcmVjdC1sb2NhdGlvbicsXG4gIF1cbiAgcmV0dXJuIHN1cHBvcnRlZF9oZWFkZXJzLmluY2x1ZGVzKGtleS50b0xvd2VyQ2FzZSgpKVxufVxuXG4vKipcbiAqIENoZWNrcyBpZiBpdCBpcyBhIHN0b3JhZ2UgaGVhZGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0b3JhZ2VDbGFzc0hlYWRlcihrZXk6IHN0cmluZykge1xuICByZXR1cm4ga2V5LnRvTG93ZXJDYXNlKCkgPT09ICd4LWFtei1zdG9yYWdlLWNsYXNzJ1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdE1ldGFkYXRhKGhlYWRlcnM6IFJlc3BvbnNlSGVhZGVyKSB7XG4gIHJldHVybiBfLm1hcEtleXMoXG4gICAgXy5waWNrQnkoaGVhZGVycywgKHZhbHVlLCBrZXkpID0+IGlzU3VwcG9ydGVkSGVhZGVyKGtleSkgfHwgaXNTdG9yYWdlQ2xhc3NIZWFkZXIoa2V5KSB8fCBpc0FtekhlYWRlcihrZXkpKSxcbiAgICAodmFsdWUsIGtleSkgPT4ge1xuICAgICAgY29uc3QgbG93ZXIgPSBrZXkudG9Mb3dlckNhc2UoKVxuICAgICAgaWYgKGxvd2VyLnN0YXJ0c1dpdGgoTWV0YURhdGFIZWFkZXJQcmVmaXgpKSB7XG4gICAgICAgIHJldHVybiBsb3dlci5zbGljZShNZXRhRGF0YUhlYWRlclByZWZpeC5sZW5ndGgpXG4gICAgICB9XG5cbiAgICAgIHJldHVybiBrZXlcbiAgICB9LFxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRWZXJzaW9uSWQoaGVhZGVyczogUmVzcG9uc2VIZWFkZXIgPSB7fSkge1xuICByZXR1cm4gaGVhZGVyc1sneC1hbXotdmVyc2lvbi1pZCddIHx8IG51bGxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNvdXJjZVZlcnNpb25JZChoZWFkZXJzOiBSZXNwb25zZUhlYWRlciA9IHt9KSB7XG4gIHJldHVybiBoZWFkZXJzWyd4LWFtei1jb3B5LXNvdXJjZS12ZXJzaW9uLWlkJ10gfHwgbnVsbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVFVGFnKGV0YWcgPSAnJyk6IHN0cmluZyB7XG4gIGNvbnN0IHJlcGxhY2VDaGFyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnXCInOiAnJyxcbiAgICAnJnF1b3Q7JzogJycsXG4gICAgJyYjMzQ7JzogJycsXG4gICAgJyZRVU9UOyc6ICcnLFxuICAgICcmI3gwMDAyMic6ICcnLFxuICB9XG4gIHJldHVybiBldGFnLnJlcGxhY2UoL14oXCJ8JnF1b3Q7fCYjMzQ7KXwoXCJ8JnF1b3Q7fCYjMzQ7KSQvZywgKG0pID0+IHJlcGxhY2VDaGFyc1ttXSBhcyBzdHJpbmcpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b01kNShwYXlsb2FkOiBCaW5hcnkpOiBzdHJpbmcge1xuICAvLyB1c2Ugc3RyaW5nIGZyb20gYnJvd3NlciBhbmQgYnVmZmVyIGZyb20gbm9kZWpzXG4gIC8vIGJyb3dzZXIgc3VwcG9ydCBpcyB0ZXN0ZWQgb25seSBhZ2FpbnN0IG1pbmlvIHNlcnZlclxuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goJ21kNScpLnVwZGF0ZShCdWZmZXIuZnJvbShwYXlsb2FkKSkuZGlnZXN0KCkudG9TdHJpbmcoJ2Jhc2U2NCcpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1NoYTI1NihwYXlsb2FkOiBCaW5hcnkpOiBzdHJpbmcge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goJ3NoYTI1NicpLnVwZGF0ZShwYXlsb2FkKS5kaWdlc3QoJ2hleCcpXG59XG5cbi8qKlxuICogdG9BcnJheSByZXR1cm5zIGEgc2luZ2xlIGVsZW1lbnQgYXJyYXkgd2l0aCBwYXJhbSBiZWluZyB0aGUgZWxlbWVudCxcbiAqIGlmIHBhcmFtIGlzIGp1c3QgYSBzdHJpbmcsIGFuZCByZXR1cm5zICdwYXJhbScgYmFjayBpZiBpdCBpcyBhbiBhcnJheVxuICogU28sIGl0IG1ha2VzIHN1cmUgcGFyYW0gaXMgYWx3YXlzIGFuIGFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b0FycmF5PFQgPSB1bmtub3duPihwYXJhbTogVCB8IFRbXSk6IEFycmF5PFQ+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KHBhcmFtKSkge1xuICAgIHJldHVybiBbcGFyYW1dIGFzIFRbXVxuICB9XG4gIHJldHVybiBwYXJhbVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2FuaXRpemVPYmplY3RLZXkob2JqZWN0TmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gKyBzeW1ib2wgY2hhcmFjdGVycyBhcmUgbm90IGRlY29kZWQgYXMgc3BhY2VzIGluIEpTLiBzbyByZXBsYWNlIHRoZW0gZmlyc3QgYW5kIGRlY29kZSB0byBnZXQgdGhlIGNvcnJlY3QgcmVzdWx0LlxuICBjb25zdCBhc1N0ck5hbWUgPSAob2JqZWN0TmFtZSA/IG9iamVjdE5hbWUudG9TdHJpbmcoKSA6ICcnKS5yZXBsYWNlKC9cXCsvZywgJyAnKVxuICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KGFzU3RyTmFtZSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplU2l6ZShzaXplPzogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHNpemUgPyBOdW1iZXIucGFyc2VJbnQoc2l6ZSkgOiB1bmRlZmluZWRcbn1cblxuZXhwb3J0IGNvbnN0IFBBUlRfQ09OU1RSQUlOVFMgPSB7XG4gIC8vIGFic01pblBhcnRTaXplIC0gYWJzb2x1dGUgbWluaW11bSBwYXJ0IHNpemUgKDUgTWlCKVxuICBBQlNfTUlOX1BBUlRfU0laRTogMTAyNCAqIDEwMjQgKiA1LFxuICAvLyBNSU5fUEFSVF9TSVpFIC0gbWluaW11bSBwYXJ0IHNpemUgMTZNaUIgcGVyIG9iamVjdCBhZnRlciB3aGljaFxuICBNSU5fUEFSVF9TSVpFOiAxMDI0ICogMTAyNCAqIDE2LFxuICAvLyBNQVhfUEFSVFNfQ09VTlQgLSBtYXhpbXVtIG51bWJlciBvZiBwYXJ0cyBmb3IgYSBzaW5nbGUgbXVsdGlwYXJ0IHNlc3Npb24uXG4gIE1BWF9QQVJUU19DT1VOVDogMTAwMDAsXG4gIC8vIE1BWF9QQVJUX1NJWkUgLSBtYXhpbXVtIHBhcnQgc2l6ZSA1R2lCIGZvciBhIHNpbmdsZSBtdWx0aXBhcnQgdXBsb2FkXG4gIC8vIG9wZXJhdGlvbi5cbiAgTUFYX1BBUlRfU0laRTogMTAyNCAqIDEwMjQgKiAxMDI0ICogNSxcbiAgLy8gTUFYX1NJTkdMRV9QVVRfT0JKRUNUX1NJWkUgLSBtYXhpbXVtIHNpemUgNUdpQiBvZiBvYmplY3QgcGVyIFBVVFxuICAvLyBvcGVyYXRpb24uXG4gIE1BWF9TSU5HTEVfUFVUX09CSkVDVF9TSVpFOiAxMDI0ICogMTAyNCAqIDEwMjQgKiA1LFxuICAvLyBNQVhfTVVMVElQQVJUX1BVVF9PQkpFQ1RfU0laRSAtIG1heGltdW0gc2l6ZSA1VGlCIG9mIG9iamVjdCBmb3JcbiAgLy8gTXVsdGlwYXJ0IG9wZXJhdGlvbi5cbiAgTUFYX01VTFRJUEFSVF9QVVRfT0JKRUNUX1NJWkU6IDEwMjQgKiAxMDI0ICogMTAyNCAqIDEwMjQgKiA1LFxufVxuXG5jb25zdCBHRU5FUklDX1NTRV9IRUFERVIgPSAnWC1BbXotU2VydmVyLVNpZGUtRW5jcnlwdGlvbidcblxuY29uc3QgRU5DUllQVElPTl9IRUFERVJTID0ge1xuICAvLyBzc2VHZW5lcmljSGVhZGVyIGlzIHRoZSBBV1MgU1NFIGhlYWRlciB1c2VkIGZvciBTU0UtUzMgYW5kIFNTRS1LTVMuXG4gIHNzZUdlbmVyaWNIZWFkZXI6IEdFTkVSSUNfU1NFX0hFQURFUixcbiAgLy8gc3NlS21zS2V5SUQgaXMgdGhlIEFXUyBTU0UtS01TIGtleSBpZC5cbiAgc3NlS21zS2V5SUQ6IEdFTkVSSUNfU1NFX0hFQURFUiArICctQXdzLUttcy1LZXktSWQnLFxufSBhcyBjb25zdFxuXG4vKipcbiAqIFJldHVybiBFbmNyeXB0aW9uIGhlYWRlcnNcbiAqIEBwYXJhbSBlbmNDb25maWdcbiAqIEByZXR1cm5zIGFuIG9iamVjdCB3aXRoIGtleSB2YWx1ZSBwYWlycyB0aGF0IGNhbiBiZSB1c2VkIGluIGhlYWRlcnMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRFbmNyeXB0aW9uSGVhZGVycyhlbmNDb25maWc6IEVuY3J5cHRpb24pOiBSZXF1ZXN0SGVhZGVycyB7XG4gIGNvbnN0IGVuY1R5cGUgPSBlbmNDb25maWcudHlwZVxuXG4gIGlmICghaXNFbXB0eShlbmNUeXBlKSkge1xuICAgIGlmIChlbmNUeXBlID09PSBFTkNSWVBUSU9OX1RZUEVTLlNTRUMpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIFtFTkNSWVBUSU9OX0hFQURFUlMuc3NlR2VuZXJpY0hlYWRlcl06ICdBRVMyNTYnLFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZW5jVHlwZSA9PT0gRU5DUllQVElPTl9UWVBFUy5LTVMpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIFtFTkNSWVBUSU9OX0hFQURFUlMuc3NlR2VuZXJpY0hlYWRlcl06IGVuY0NvbmZpZy5TU0VBbGdvcml0aG0sXG4gICAgICAgIFtFTkNSWVBUSU9OX0hFQURFUlMuc3NlS21zS2V5SURdOiBlbmNDb25maWcuS01TTWFzdGVyS2V5SUQsXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHt9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJ0c1JlcXVpcmVkKHNpemU6IG51bWJlcik6IG51bWJlciB7XG4gIGNvbnN0IG1heFBhcnRTaXplID0gUEFSVF9DT05TVFJBSU5UUy5NQVhfTVVMVElQQVJUX1BVVF9PQkpFQ1RfU0laRSAvIChQQVJUX0NPTlNUUkFJTlRTLk1BWF9QQVJUU19DT1VOVCAtIDEpXG4gIGxldCByZXF1aXJlZFBhcnRTaXplID0gc2l6ZSAvIG1heFBhcnRTaXplXG4gIGlmIChzaXplICUgbWF4UGFydFNpemUgPiAwKSB7XG4gICAgcmVxdWlyZWRQYXJ0U2l6ZSsrXG4gIH1cbiAgcmVxdWlyZWRQYXJ0U2l6ZSA9IE1hdGgudHJ1bmMocmVxdWlyZWRQYXJ0U2l6ZSlcbiAgcmV0dXJuIHJlcXVpcmVkUGFydFNpemVcbn1cblxuLyoqXG4gKiBjYWxjdWxhdGVFdmVuU3BsaXRzIC0gY29tcHV0ZXMgc3BsaXRzIGZvciBhIHNvdXJjZSBhbmQgcmV0dXJuc1xuICogc3RhcnQgYW5kIGVuZCBpbmRleCBzbGljZXMuIFNwbGl0cyBoYXBwZW4gZXZlbmx5IHRvIGJlIHN1cmUgdGhhdCBub1xuICogcGFydCBpcyBsZXNzIHRoYW4gNU1pQiwgYXMgdGhhdCBjb3VsZCBmYWlsIHRoZSBtdWx0aXBhcnQgcmVxdWVzdCBpZlxuICogaXQgaXMgbm90IHRoZSBsYXN0IHBhcnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjYWxjdWxhdGVFdmVuU3BsaXRzPFQgZXh0ZW5kcyB7IFN0YXJ0PzogbnVtYmVyIH0+KFxuICBzaXplOiBudW1iZXIsXG4gIG9iakluZm86IFQsXG4pOiB7XG4gIHN0YXJ0SW5kZXg6IG51bWJlcltdXG4gIG9iakluZm86IFRcbiAgZW5kSW5kZXg6IG51bWJlcltdXG59IHwgbnVsbCB7XG4gIGlmIChzaXplID09PSAwKSB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuICBjb25zdCByZXFQYXJ0cyA9IHBhcnRzUmVxdWlyZWQoc2l6ZSlcbiAgY29uc3Qgc3RhcnRJbmRleFBhcnRzOiBudW1iZXJbXSA9IFtdXG4gIGNvbnN0IGVuZEluZGV4UGFydHM6IG51bWJlcltdID0gW11cblxuICBsZXQgc3RhcnQgPSBvYmpJbmZvLlN0YXJ0XG4gIGlmIChpc0VtcHR5KHN0YXJ0KSB8fCBzdGFydCA9PT0gLTEpIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICBjb25zdCBkaXZpc29yVmFsdWUgPSBNYXRoLnRydW5jKHNpemUgLyByZXFQYXJ0cylcblxuICBjb25zdCByZW1pbmRlclZhbHVlID0gc2l6ZSAlIHJlcVBhcnRzXG5cbiAgbGV0IG5leHRTdGFydCA9IHN0YXJ0XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCByZXFQYXJ0czsgaSsrKSB7XG4gICAgbGV0IGN1clBhcnRTaXplID0gZGl2aXNvclZhbHVlXG4gICAgaWYgKGkgPCByZW1pbmRlclZhbHVlKSB7XG4gICAgICBjdXJQYXJ0U2l6ZSsrXG4gICAgfVxuXG4gICAgY29uc3QgY3VycmVudFN0YXJ0ID0gbmV4dFN0YXJ0XG4gICAgY29uc3QgY3VycmVudEVuZCA9IGN1cnJlbnRTdGFydCArIGN1clBhcnRTaXplIC0gMVxuICAgIG5leHRTdGFydCA9IGN1cnJlbnRFbmQgKyAxXG5cbiAgICBzdGFydEluZGV4UGFydHMucHVzaChjdXJyZW50U3RhcnQpXG4gICAgZW5kSW5kZXhQYXJ0cy5wdXNoKGN1cnJlbnRFbmQpXG4gIH1cblxuICByZXR1cm4geyBzdGFydEluZGV4OiBzdGFydEluZGV4UGFydHMsIGVuZEluZGV4OiBlbmRJbmRleFBhcnRzLCBvYmpJbmZvOiBvYmpJbmZvIH1cbn1cblxuY29uc3QgZnhwID0gbmV3IFhNTFBhcnNlcigpXG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZXhwbGljaXQtYW55XG5leHBvcnQgZnVuY3Rpb24gcGFyc2VYbWwoeG1sOiBzdHJpbmcpOiBhbnkge1xuICBjb25zdCByZXN1bHQgPSBmeHAucGFyc2UoeG1sKVxuICBpZiAocmVzdWx0LkVycm9yKSB7XG4gICAgdGhyb3cgcmVzdWx0LkVycm9yXG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbi8qKlxuICogZ2V0IGNvbnRlbnQgc2l6ZSBvZiBvYmplY3QgY29udGVudCB0byB1cGxvYWRcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENvbnRlbnRMZW5ndGgoczogc3RyZWFtLlJlYWRhYmxlIHwgQnVmZmVyIHwgc3RyaW5nKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gIC8vIHVzZSBsZW5ndGggcHJvcGVydHkgb2Ygc3RyaW5nIHwgQnVmZmVyXG4gIGlmICh0eXBlb2YgcyA9PT0gJ3N0cmluZycgfHwgQnVmZmVyLmlzQnVmZmVyKHMpKSB7XG4gICAgcmV0dXJuIHMubGVuZ3RoXG4gIH1cblxuICAvLyBwcm9wZXJ0eSBvZiBgZnMuUmVhZFN0cmVhbWBcbiAgY29uc3QgZmlsZVBhdGggPSAocyBhcyB1bmtub3duIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KS5wYXRoIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuICBpZiAoZmlsZVBhdGggJiYgdHlwZW9mIGZpbGVQYXRoID09PSAnc3RyaW5nJykge1xuICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBmc3AubHN0YXQoZmlsZVBhdGgpXG4gICAgcmV0dXJuIHN0YXQuc2l6ZVxuICB9XG5cbiAgLy8gcHJvcGVydHkgb2YgYGZzLlJlYWRTdHJlYW1gXG4gIGNvbnN0IGZkID0gKHMgYXMgdW5rbm93biBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikuZmQgYXMgbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZFxuICBpZiAoZmQgJiYgdHlwZW9mIGZkID09PSAnbnVtYmVyJykge1xuICAgIGNvbnN0IHN0YXQgPSBhd2FpdCBmc3RhdChmZClcbiAgICByZXR1cm4gc3RhdC5zaXplXG4gIH1cblxuICByZXR1cm4gbnVsbFxufVxuIl0sIm1hcHBpbmdzIjoiQUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsT0FBTyxLQUFLQSxNQUFNO0FBQ2xCLE9BQU8sS0FBS0MsTUFBTTtBQUVsQixTQUFTQyxTQUFTLFFBQVEsaUJBQWlCO0FBQzNDLE9BQU9DLE1BQU0sTUFBTSxXQUFXO0FBQzlCLE9BQU9DLENBQUMsTUFBTSxRQUFRO0FBQ3RCLE9BQU8sS0FBS0MsSUFBSSxNQUFNLFlBQVk7QUFFbEMsU0FBU0MsR0FBRyxFQUFFQyxLQUFLLFFBQVEsYUFBWTtBQUV2QyxTQUFTQyxnQkFBZ0IsUUFB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