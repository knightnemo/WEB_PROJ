"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseBucketNotification = parseBucketNotification;
exports.parseCopyObject = parseCopyObject;
exports.parseListObjects = parseListObjects;
exports.parseListObjectsV2 = parseListObjectsV2;
exports.parseListObjectsV2WithMetadata = parseListObjectsV2WithMetadata;
exports.parseObjectLegalHoldConfig = parseObjectLegalHoldConfig;
exports.parseObjectRetentionConfig = parseObjectRetentionConfig;
exports.removeObjectsParser = removeObjectsParser;
exports.uploadPartParser = uploadPartParser;
var _fastXmlParser = require("fast-xml-parser");
var errors = _interopRequireWildcard(require("./errors.js"), true);
var _helper = require("./internal/helper.js");
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

const fxpWithoutNumParser = new _fastXmlParser.XMLParser({
  numberParseOptions: {
    skipLike: /./
  }
});

// parse XML response for copy object
function parseCopyObject(xml) {
  var result = {
    etag: '',
    lastModified: ''
  };
  var xmlobj = (0, _helper.parseXml)(xml);
  if (!xmlobj.CopyObjectResult) {
    throw new errors.InvalidXMLError('Missing tag: "CopyObjectResult"');
  }
  xmlobj = xmlobj.CopyObjectResult;
  if (xmlobj.ETag) {
    result.etag = xmlobj.ETag.replace(/^"/g, '').replace(/"$/g, '').replace(/^&quot;/g, '').replace(/&quot;$/g, '').replace(/^&#34;/g, '').replace(/&#34;$/g, '');
  }
  if (xmlobj.LastModified) {
    result.lastModified = new Date(xmlobj.LastModified);
  }
  return result;
}

// parse XML response for bucket notification
function parseBucketNotification(xml) {
  var result = {
    TopicConfiguration: [],
    QueueConfiguration: [],
    CloudFunctionConfiguration: []
  };
  // Parse the events list
  var genEvents = function (events) {
    var result = [];
    if (events) {
      (0, _helper.toArray)(events).forEach(s3event => {
        result.push(s3event);
      });
    }
    return result;
  };
  // Parse all filter rules
  var genFilterRules = function (filters) {
    var result = [];
    if (filters) {
      filters = (0, _helper.toArray)(filters);
      if (filters[0].S3Key) {
        filters[0].S3Key = (0, _helper.toArray)(filters[0].S3Key);
        if (filters[0].S3Key[0].FilterRule) {
          (0, _helper.toArray)(filters[0].S3Key[0].FilterRule).forEach(rule => {
            var Name = (0, _helper.toArray)(rule.Name)[0];
            var Value = (0, _helper.toArray)(rule.Value)[0];
            result.push({
              Name,
              Value
            });
          });
        }
      }
    }
    return result;
  };
  var xmlobj = (0, _helper.parseXml)(xml);
  xmlobj = xmlobj.NotificationConfiguration;

  // Parse all topic configurations in the xml
  if (xmlobj.TopicConfiguration) {
    (0, _helper.toArray)(xmlobj.TopicConfiguration).forEach(config => {
      var Id = (0, _helper.toArray)(config.Id)[0];
      var Topic = (0, _helper.toArray)(config.Topic)[0];
      var Event = genEvents(config.Event);
      var Filter = genFilterRules(config.Filter);
      result.TopicConfiguration.push({
        Id,
        Topic,
        Event,
        Filter
      });
    });
  }
  // Parse all topic configurations in the xml
  if (xmlobj.QueueConfiguration) {
    (0, _helper.toArray)(xmlobj.QueueConfiguration).forEach(config => {
      var Id = (0, _helper.toArray)(config.Id)[0];
      var Queue = (0, _helper.toArray)(config.Queue)[0];
      var Event = genEvents(config.Event);
      var Filter = genFilterRules(config.Filter);
      result.QueueConfiguration.push({
        Id,
        Queue,
        Event,
        Filter
      });
    });
  }
  // Parse all QueueConfiguration arrays
  if (xmlobj.CloudFunctionConfiguration) {
    (0, _helper.toArray)(xmlobj.CloudFunctionConfiguration).forEach(config => {
      var Id = (0, _helper.toArray)(config.Id)[0];
      var CloudFunction = (0, _helper.toArray)(config.CloudFunction)[0];
      var Event = genEvents(config.Event);
      var Filter = genFilterRules(config.Filter);
      result.CloudFunctionConfiguration.push({
        Id,
        CloudFunction,
        Event,
        Filter
      });
    });
  }
  return result;
}
const formatObjInfo = (content, opts = {}) => {
  let {
    Key,
    LastModified,
    ETag,
    Size,
    VersionId,
    IsLatest
  } = content;
  if (!(0, _helper.isObject)(opts)) {
    opts = {};
  }
  const name = (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(Key)[0]);
  const lastModified = new Date((0, _helper.toArray)(LastModified)[0]);
  const etag = (0, _helper.sanitizeETag)((0, _helper.toArray)(ETag)[0]);
  const size = (0, _helper.sanitizeSize)(Size);
  return {
    name,
    lastModified,
    etag,
    size,
    versionId: VersionId,
    isLatest: IsLatest,
    isDeleteMarker: opts.IsDeleteMarker ? opts.IsDeleteMarker : false
  };
};

// parse XML response for list objects in a bucket
function parseListObjects(xml) {
  var result = {
    objects: [],
    isTruncated: false
  };
  let isTruncated = false;
  let nextMarker, nextVersionKeyMarker;
  const xmlobj = fxpWithoutNumParser.parse(xml);
  const parseCommonPrefixesEntity = responseEntity => {
    if (responseEntity) {
      (0, _helper.toArray)(responseEntity).forEach(commonPrefix => {
        result.objects.push({
          prefix: (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(commonPrefix.Prefix)[0]),
          size: 0
        });
      });
    }
  };
  const listBucketResult = xmlobj.ListBucketResult;
  const listVersionsResult = xmlobj.ListVersionsResult;
  if (listBucketResult) {
    if (listBucketResult.IsTruncated) {
      isTruncated = listBucketResult.IsTruncated;
    }
    if (listBucketResult.Contents) {
      (0, _helper.toArray)(listBucketResult.Contents).forEach(content => {
        const name = (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(content.Key)[0]);
        const lastModified = new Date((0, _helper.toArray)(content.LastModified)[0]);
        const etag = (0, _helper.sanitizeETag)((0, _helper.toArray)(content.ETag)[0]);
        const size = (0, _helper.sanitizeSize)(content.Size);
        result.objects.push({
          name,
          lastModified,
          etag,
          size
        });
      });
    }
    if (listBucketResult.NextMarker) {
      nextMarker = listBucketResult.NextMarker;
    } else if (isTruncated && result.objects.length > 0) {
      nextMarker = result.objects[result.objects.length - 1].name;
    }
    parseCommonPrefixesEntity(listBucketResult.CommonPrefixes);
  }
  if (listVersionsResult) {
    if (listVersionsResult.IsTruncated) {
      isTruncated = listVersionsResult.IsTruncated;
    }
    if (listVersionsResult.Version) {
      (0, _helper.toArray)(listVersionsResult.Version).forEach(content => {
        result.objects.push(formatObjInfo(content));
      });
    }
    if (listVersionsResult.DeleteMarker) {
      (0, _helper.toArray)(listVersionsResult.DeleteMarker).forEach(content => {
        result.objects.push(formatObjInfo(content, {
          IsDeleteMarker: true
        }));
      });
    }
    if (listVersionsResult.NextKeyMarker) {
      nextVersionKeyMarker = listVersionsResult.NextKeyMarker;
    }
    if (listVersionsResult.NextVersionIdMarker) {
      result.versionIdMarker = listVersionsResult.NextVersionIdMarker;
    }
    parseCommonPrefixesEntity(listVersionsResult.CommonPrefixes);
  }
  result.isTruncated = isTruncated;
  if (isTruncated) {
    result.nextMarker = nextVersionKeyMarker || nextMarker;
  }
  return result;
}

// parse XML response for list objects v2 in a bucket
function parseListObjectsV2(xml) {
  var result = {
    objects: [],
    isTruncated: false
  };
  var xmlobj = (0, _helper.parseXml)(xml);
  if (!xmlobj.ListBucketResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListBucketResult"');
  }
  xmlobj = xmlobj.ListBucketResult;
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated;
  }
  if (xmlobj.NextContinuationToken) {
    result.nextContinuationToken = xmlobj.NextContinuationToken;
  }
  if (xmlobj.Contents) {
    (0, _helper.toArray)(xmlobj.Contents).forEach(content => {
      var name = (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(content.Key)[0]);
      var lastModified = new Date(content.LastModified);
      var etag = (0, _helper.sanitizeETag)(content.ETag);
      var size = content.Size;
      result.objects.push({
        name,
        lastModified,
        etag,
        size
      });
    });
  }
  if (xmlobj.CommonPrefixes) {
    (0, _helper.toArray)(xmlobj.CommonPrefixes).forEach(commonPrefix => {
      result.objects.push({
        prefix: (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(commonPrefix.Prefix)[0]),
        size: 0
      });
    });
  }
  return result;
}

// parse XML response for list objects v2 with metadata in a bucket
function parseListObjectsV2WithMetadata(xml) {
  var result = {
    objects: [],
    isTruncated: false
  };
  var xmlobj = (0, _helper.parseXml)(xml);
  if (!xmlobj.ListBucketResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListBucketResult"');
  }
  xmlobj = xmlobj.ListBucketResult;
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated;
  }
  if (xmlobj.NextContinuationToken) {
    result.nextContinuationToken = xmlobj.NextContinuationToken;
  }
  if (xmlobj.Contents) {
    (0, _helper.toArray)(xmlobj.Contents).forEach(content => {
      var name = (0, _helper.sanitizeObjectKey)(content.Key);
      var lastModified = new Date(content.LastModified);
      var etag = (0, _helper.sanitizeETag)(content.ETag);
      var size = content.Size;
      var metadata;
      if (content.UserMetadata != null) {
        metadata = (0, _helper.toArray)(content.UserMetadata)[0];
      } else {
        metadata = null;
      }
      result.objects.push({
        name,
        lastModified,
        etag,
        size,
        metadata
      });
    });
  }
  if (xmlobj.CommonPrefixes) {
    (0, _helper.toArray)(xmlobj.CommonPrefixes).forEach(commonPrefix => {
      result.objects.push({
        prefix: (0, _helper.sanitizeObjectKey)((0, _helper.toArray)(commonPrefix.Prefix)[0]),
        size: 0
      });
    });
  }
  return result;
}
function parseObjectRetentionConfig(xml) {
  const xmlObj = (0, _helper.parseXml)(xml);
  const retentionConfig = xmlObj.Retention;
  return {
    mode: retentionConfig.Mode,
    retainUntilDate: retentionConfig.RetainUntilDate
  };
}
function parseObjectLegalHoldConfig(xml) {
  const xmlObj = (0, _helper.parseXml)(xml);
  return xmlObj.LegalHold;
}
function uploadPartParser(xml) {
  const xmlObj = (0, _helper.parseXml)(xml);
  const respEl = xmlObj.CopyPartResult;
  return respEl;
}
function removeObjectsParser(xml) {
  const xmlObj = (0, _helper.parseXml)(xml);
  if (xmlObj.DeleteResult && xmlObj.DeleteResult.Error) {
    // return errors as array always. as the response is object in case of single object passed in removeObjects
    return (0, _helper.toArray)(xmlObj.DeleteResult.Error);
  }
  return [];
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJfZmFzdFhtbFBhcnNlciIsInJlcXVpcmUiLCJlcnJvcnMiLCJfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCIsIl9oZWxwZXIiLCJfZ2V0UmVxdWlyZVdpbGRjYXJkQ2FjaGUiLCJub2RlSW50ZXJvcCIsIldlYWtNYXAiLCJjYWNoZUJhYmVsSW50ZXJvcCIsImNhY2hlTm9kZUludGVyb3AiLCJvYmoiLCJfX2VzTW9kdWxlIiwiZGVmYXVsdCIsImNhY2hlIiwiaGFzIiwiZ2V0IiwibmV3T2JqIiwiaGFzUHJvcGVydHlEZXNjcmlwdG9yIiwiT2JqZWN0IiwiZGVmaW5lUHJvcGVydHkiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IiLCJrZXkiLCJwcm90b3R5cGUiLCJoYXNPd25Qcm9wZXJ0eSIsImNhbGwiLCJkZXNjIiwic2V0IiwiZnhwV2l0aG91dE51bVBhcnNlciIsIlhNTFBhcnNlciIsIm51bWJlclBhcnNlT3B0aW9ucyIsInNraXBMaWtlIiwicGFyc2VDb3B5T2JqZWN0IiwieG1sIiwicmVzdWx0IiwiZXRhZyIsImxhc3RNb2RpZmllZCIsInhtbG9iaiIsInBhcnNlWG1sIiwiQ29weU9iamVjdFJlc3VsdCIsIkludmFsaWRYTUxFcnJvciIsIkVUYWciLCJyZXBsYWNlIiwiTGFzdE1vZGlmaWVkIiwiRGF0ZSIsInBhcnNlQnVja2V0Tm90aWZpY2F0aW9uIiwiVG9waWNDb25maWd1cmF0aW9uIiwiUXVldWVDb25maWd1cmF0aW9uIiwiQ2xvdWRGdW5jdGlvbkNvbmZpZ3VyYXRpb24iLCJnZW5FdmVudHMiLCJldmVudHMiLCJ0b0FycmF5IiwiZm9yRWFjaCIsInMzZXZlbnQiLCJwdXNoIiwiZ2VuRmlsdGVyUnVsZXMiLCJmaWx0ZXJzIiwiUzNLZXkiLCJGaWx0ZXJSdWxlIiwicnVsZSIsIk5hbWUiLCJWYWx1ZSIsIk5vdGlmaWNhdGlvbkNvbmZpZ3VyYXRpb24iLCJjb25maWciLCJJZCIsIlRvcGljIiwiRXZlbnQiLCJGaWx0ZXIiLCJRdWV1ZSIsIkNsb3VkRnVuY3Rpb24iLCJmb3JtYXRPYmpJbmZvIiwiY29udGVudCIsIm9wdHMiLCJLZXkiLCJTaXplIiwiVmVyc2lvbklkIiwiSXNMYXRlc3QiLCJpc09iamVjdCIsIm5hbWUiLCJzYW5pdGl6ZU9iamVjdEtleSIsInNhbml0aXplRVRhZyIsInNpemUiLCJzYW5pdGl6ZVNpemUiLCJ2ZXJzaW9uSWQiLCJpc0xhdGVzdCIsImlzRGVsZXRlTWFya2VyIiwiSXNEZWxldGVNYXJrZXIiLCJwYXJzZUxpc3RPYmplY3RzIiwib2JqZWN0cyIsImlzVHJ1bmNhdGVkIiwibmV4dE1hcmtlciIsIm5leHRWZXJzaW9uS2V5TWFya2VyIiwicGFyc2UiLCJwYXJzZUNvbW1vblByZWZpeGVzRW50aXR5IiwicmVzcG9uc2VFbnRpdHkiLCJjb21tb25QcmVmaXgiLCJwcmVmaXgiLCJQcmVmaXgiLCJsaXN0QnVja2V0UmVzdWx0IiwiTGlzdEJ1Y2tldFJlc3VsdCIsImxpc3RWZXJzaW9uc1Jlc3VsdCIsIkxpc3RWZXJzaW9uc1Jlc3VsdCIsIklzVHJ1bmNhdGVkIiwiQ29udGVudHMiLCJOZXh0TWFya2VyIiwibGVuZ3RoIiwiQ29tbW9uUHJlZml4ZXMiLCJWZXJzaW9uIiwiRGVsZXRlTWFya2VyIiwiTmV4dEtleU1hcmtlciIsIk5leHRWZXJzaW9uSWRNYXJrZXIiLCJ2ZXJzaW9uSWRNYXJrZXIiLCJwYXJzZUxpc3RPYmplY3RzVjIiLCJOZXh0Q29udGludWF0aW9uVG9rZW4iLCJuZXh0Q29udGludWF0aW9uVG9rZW4iLCJwYXJzZUxpc3RPYmplY3RzVjJXaXRoTWV0YWRhdGEiLCJtZXRhZGF0YSIsIlVzZXJNZXRhZGF0YSIsInBhcnNlT2JqZWN0UmV0ZW50aW9uQ29uZmlnIiwieG1sT2JqIiwicmV0ZW50aW9uQ29uZmlnIiwiUmV0ZW50aW9uIiwibW9kZSIsIk1vZGUiLCJyZXRhaW5VbnRpbERhdGUiLCJSZXRhaW5VbnRpbERhdGUiLCJwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyIsIkxlZ2FsSG9sZCIsInVwbG9hZFBhcnRQYXJzZXIiLCJyZXNwRWwiLCJDb3B5UGFydFJlc3VsdCIsInJlbW92ZU9iamVjdHNQYXJzZXIiLCJEZWxldGVSZXN1bHQiLCJFcnJvciJdLCJzb3VyY2VzIjpbInhtbC1wYXJzZXJzLmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBNaW5JTyBKYXZhc2NyaXB0IExpYnJhcnkgZm9yIEFtYXpvbiBTMyBDb21wYXRpYmxlIENsb3VkIFN0b3JhZ2UsIChDKSAyMDE1IE1pbklPLCBJbmMuXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICovXG5cbmltcG9ydCB7IFhNTFBhcnNlciB9IGZyb20gJ2Zhc3QteG1sLXBhcnNlcidcblxuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4vZXJyb3JzLnRzJ1xuaW1wb3J0IHsgaXNPYmplY3QsIHBhcnNlWG1sLCBzYW5pdGl6ZUVUYWcsIHNhbml0aXplT2JqZWN0S2V5LCBzYW5pdGl6ZVNpemUsIHRvQXJyYXkgfSBmcm9tICcuL2ludGVybmFsL2hlbHBlci50cydcblxuY29uc3QgZnhwV2l0aG91dE51bVBhcnNlciA9IG5ldyBYTUxQYXJzZXIoe1xuICBudW1iZXJQYXJzZU9wdGlvbnM6IHtcbiAgICBza2lwTGlrZTogLy4vLFxuICB9LFxufSlcblxuLy8gcGFyc2UgWE1MIHJlc3BvbnNlIGZvciBjb3B5IG9iamVjdFxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29weU9iamVjdCh4bWwpIHtcbiAgdmFyIHJlc3VsdCA9IHtcbiAgICBldGFnOiAnJyxcbiAgICBsYXN0TW9kaWZpZWQ6ICcnLFxuICB9XG5cbiAgdmFyIHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcbiAgaWYgKCF4bWxvYmouQ29weU9iamVjdFJlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJDb3B5T2JqZWN0UmVzdWx0XCInKVxuICB9XG4gIHhtbG9iaiA9IHhtbG9iai5Db3B5T2JqZWN0UmVzdWx0XG4gIGlmICh4bWxvYmouRVRhZykge1xuICAgIHJlc3VsdC5ldGFnID0geG1sb2JqLkVUYWcucmVwbGFjZSgvXlwiL2csICcnKVxuICAgICAgLnJlcGxhY2UoL1wiJC9nLCAnJylcbiAgICAgIC5yZXBsYWNlKC9eJnF1b3Q7L2csICcnKVxuICAgICAgLnJlcGxhY2UoLyZxdW90OyQvZywgJycpXG4gICAgICAucmVwbGFjZSgvXiYjMzQ7L2csICcnKVxuICAgICAgLnJlcGxhY2UoLyYjMzQ7JC9nLCAnJylcbiAgfVxuICBpZiAoeG1sb2JqLkxhc3RNb2RpZmllZCkge1xuICAgIHJlc3VsdC5sYXN0TW9kaWZpZWQgPSBuZXcgRGF0ZSh4bWxvYmouTGFzdE1vZGlmaWVkKVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBwYXJzZSBYTUwgcmVzcG9uc2UgZm9yIGJ1Y2tldCBub3RpZmljYXRpb25cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJ1Y2tldE5vdGlmaWNhdGlvbih4bWwpIHtcbiAgdmFyIHJlc3VsdCA9IHtcbiAgICBUb3BpY0NvbmZpZ3VyYXRpb246IFtdLFxuICAgIFF1ZXVlQ29uZmlndXJhdGlvbjogW10sXG4gICAgQ2xvdWRGdW5jdGlvbkNvbmZpZ3VyYXRpb246IFtdLFxuICB9XG4gIC8vIFBhcnNlIHRoZSBldmVudHMgbGlzdFxuICB2YXIgZ2VuRXZlbnRzID0gZnVuY3Rpb24gKGV2ZW50cykge1xuICAgIHZhciByZXN1bHQgPSBbXVxuICAgIGlmIChldmVudHMpIHtcbiAgICAgIHRvQXJyYXkoZXZlbnRzKS5mb3JFYWNoKChzM2V2ZW50KSA9PiB7XG4gICAgICAgIHJlc3VsdC5wdXNoKHMzZXZlbnQpXG4gICAgICB9KVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cbiAgLy8gUGFyc2UgYWxsIGZpbHRlciBydWxlc1xuICB2YXIgZ2VuRmlsdGVyUnVsZXMgPSBmdW5jdGlvbiAoZmlsdGVycykge1xuICAgIHZhciByZXN1bHQgPSBbXVxuICAgIGlmIChmaWx0ZXJzKSB7XG4gICAgICBmaWx0ZXJzID0gdG9BcnJheShmaWx0ZXJzKVxuICAgICAgaWYgKGZpbHRlcnNbMF0uUzNLZXkpIHtcbiAgICAgICAgZmlsdGVyc1swXS5TM0tleSA9IHRvQXJyYXkoZmlsdGVyc1swXS5TM0tleSlcbiAgICAgICAgaWYgKGZpbHRlcnNbMF0uUzNLZXlbMF0uRmlsdGVyUnVsZSkge1xuICAgICAgICAgIHRvQXJyYXkoZmlsdGVyc1swXS5TM0tleVswXS5GaWx0ZXJSdWxlKS5mb3JFYWNoKChydWxlKSA9PiB7XG4gICAgICAgICAgICB2YXIgTmFtZSA9IHRvQXJyYXkocnVsZS5OYW1lKVswXVxuICAgICAgICAgICAgdmFyIFZhbHVlID0gdG9BcnJheShydWxlLlZhbHVlKVswXVxuICAgICAgICAgICAgcmVzdWx0LnB1c2goeyBOYW1lLCBWYWx1ZSB9KVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG5cbiAgdmFyIHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcbiAgeG1sb2JqID0geG1sb2JqLk5vdGlmaWNhdGlvbkNvbmZpZ3VyYXRpb25cblxuICAvLyBQYXJzZSBhbGwgdG9waWMgY29uZmlndXJhdGlvbnMgaW4gdGhlIHhtbFxuICBpZiAoeG1sb2JqLlRvcGljQ29uZmlndXJhdGlvbikge1xuICAgIHRvQXJyYXkoeG1sb2JqLlRvcGljQ29uZmlndXJhdGlvbikuZm9yRWFjaCgoY29uZmlnKSA9PiB7XG4gICAgICB2YXIgSWQgPSB0b0FycmF5KGNvbmZpZy5JZClbMF1cbiAgICAgIHZhciBUb3BpYyA9IHRvQXJyYXkoY29uZmlnLlRvcGljKVswXVxuICAgICAgdmFyIEV2ZW50ID0gZ2VuRXZlbnRzKGNvbmZpZy5FdmVudClcbiAgICAgIHZhciBGaWx0ZXIgPSBnZW5GaWx0ZXJSdWxlcyhjb25maWcuRmlsdGVyKVxuICAgICAgcmVzdWx0LlRvcGljQ29uZmlndXJhdGlvbi5wdXNoKHsgSWQsIFRvcGljLCBFdmVudCwgRmlsdGVyIH0pXG4gICAgfSlcbiAgfVxuICAvLyBQYXJzZSBhbGwgdG9waWMgY29uZmlndXJhdGlvbnMgaW4gdGhlIHhtbFxuICBpZiAoeG1sb2JqLlF1ZXVlQ29uZmlndXJhdGlvbikge1xuICAgIHRvQXJyYXkoeG1sb2JqLlF1ZXVlQ29uZmlndXJhdGlvbikuZm9yRWFjaCgoY29uZmlnKSA9PiB7XG4gICAgICB2YXIgSWQgPSB0b0FycmF5KGNvbmZpZy5JZClbMF1cbiAgICAgIHZhciBRdWV1ZSA9IHRvQXJyYXkoY29uZmlnLlF1ZXVlKVswXVxuICAgICAgdmFyIEV2ZW50ID0gZ2VuRXZlbnRzKGNvbmZpZy5FdmVudClcbiAgICAgIHZhciBGaWx0ZXIgPSBnZW5GaWx0ZXJSdWxlcyhjb25maWcuRmlsdGVyKVxuICAgICAgcmVzdWx0LlF1ZXVlQ29uZmlndXJhdGlvbi5wdXNoKHsgSWQsIFF1ZXVlLCBFdmVudCwgRmlsdGVyIH0pXG4gICAgfSlcbiAgfVxuICAvLyBQYXJzZSBhbGwgUXVldWVDb25maWd1cmF0aW9uIGFycmF5c1xuICBpZiAoeG1sb2JqLkNsb3VkRnVuY3Rpb25Db25maWd1cmF0aW9uKSB7XG4gICAgdG9BcnJheSh4bWxvYmouQ2xvdWRGdW5jdGlvbkNvbmZpZ3VyYXRpb24pLmZvckVhY2goKGNvbmZpZykgPT4ge1xuICAgICAgdmFyIElkID0gdG9BcnJheShjb25maWcuSWQpWzBdXG4gICAgICB2YXIgQ2xvdWRGdW5jdGlvbiA9IHRvQXJyYXkoY29uZmlnLkNsb3VkRnVuY3Rpb24pWzBdXG4gICAgICB2YXIgRXZlbnQgPSBnZW5FdmVudHMoY29uZmlnLkV2ZW50KVxuICAgICAgdmFyIEZpbHRlciA9IGdlbkZpbHRlclJ1bGVzKGNvbmZpZy5GaWx0ZXIpXG4gICAgICByZXN1bHQuQ2xvdWRGdW5jdGlvbkNvbmZpZ3VyYXRpb24ucHVzaCh7IElkLCBDbG91ZEZ1bmN0aW9uLCBFdmVudCwgRmlsdGVyIH0pXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXN1bHRcbn1cblxuY29uc3QgZm9ybWF0T2JqSW5mbyA9IChjb250ZW50LCBvcHRzID0ge30pID0+IHtcbiAgbGV0IHsgS2V5LCBMYXN0TW9kaWZpZWQsIEVUYWcsIFNpemUsIFZlcnNpb25JZCwgSXNMYXRlc3QgfSA9IGNvbnRlbnRcblxuICBpZiAoIWlzT2JqZWN0KG9wdHMpKSB7XG4gICAgb3B0cyA9IHt9XG4gIH1cblxuICBjb25zdCBuYW1lID0gc2FuaXRpemVPYmplY3RLZXkodG9BcnJheShLZXkpWzBdKVxuICBjb25zdCBsYXN0TW9kaWZpZWQgPSBuZXcgRGF0ZSh0b0FycmF5KExhc3RNb2RpZmllZClbMF0pXG4gIGNvbnN0IGV0YWcgPSBzYW5pdGl6ZUVUYWcodG9BcnJheShFVGFnKVswXSlcbiAgY29uc3Qgc2l6ZSA9IHNhbml0aXplU2l6ZShTaXplKVxuXG4gIHJldHVybiB7XG4gICAgbmFtZSxcbiAgICBsYXN0TW9kaWZpZWQsXG4gICAgZXRhZyxcbiAgICBzaXplLFxuICAgIHZlcnNpb25JZDogVmVyc2lvbklkLFxuICAgIGlzTGF0ZXN0OiBJc0xhdGVzdCxcbiAgICBpc0RlbGV0ZU1hcmtlcjogb3B0cy5Jc0RlbGV0ZU1hcmtlciA/IG9wdHMuSXNEZWxldGVNYXJrZXIgOiBmYWxzZSxcbiAgfVxufVxuXG4vLyBwYXJzZSBYTUwgcmVzcG9uc2UgZm9yIGxpc3Qgb2JqZWN0cyBpbiBhIGJ1Y2tldFxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGlzdE9iamVjdHMoeG1sKSB7XG4gIHZhciByZXN1bHQgPSB7XG4gICAgb2JqZWN0czogW10sXG4gICAgaXNUcnVuY2F0ZWQ6IGZhbHNlLFxuICB9XG4gIGxldCBpc1RydW5jYXRlZCA9IGZhbHNlXG4gIGxldCBuZXh0TWFya2VyLCBuZXh0VmVyc2lvbktleU1hcmtlclxuICBjb25zdCB4bWxvYmogPSBmeHBXaXRob3V0TnVtUGFyc2VyLnBhcnNlKHhtbClcblxuICBjb25zdCBwYXJzZUNvbW1vblByZWZpeGVzRW50aXR5ID0gKHJlc3BvbnNlRW50aXR5KSA9PiB7XG4gICAgaWYgKHJlc3BvbnNlRW50aXR5KSB7XG4gICAgICB0b0FycmF5KHJlc3BvbnNlRW50aXR5KS5mb3JFYWNoKChjb21tb25QcmVmaXgpID0+IHtcbiAgICAgICAgcmVzdWx0Lm9iamVjdHMucHVzaCh7IHByZWZpeDogc2FuaXRpemVPYmplY3RLZXkodG9BcnJheShjb21tb25QcmVmaXguUHJlZml4KVswXSksIHNpemU6IDAgfSlcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgY29uc3QgbGlzdEJ1Y2tldFJlc3VsdCA9IHhtbG9iai5MaXN0QnVja2V0UmVzdWx0XG4gIGNvbnN0IGxpc3RWZXJzaW9uc1Jlc3VsdCA9IHhtbG9iai5MaXN0VmVyc2lvbnNSZXN1bHRcblxuICBpZiAobGlzdEJ1Y2tldFJlc3VsdCkge1xuICAgIGlmIChsaXN0QnVja2V0UmVzdWx0LklzVHJ1bmNhdGVkKSB7XG4gICAgICBpc1RydW5jYXRlZCA9IGxpc3RCdWNrZXRSZXN1bHQuSXNUcnVuY2F0ZWRcbiAgICB9XG4gICAgaWYgKGxpc3RCdWNrZXRSZXN1bHQuQ29udGVudHMpIHtcbiAgICAgIHRvQXJyYXkobGlzdEJ1Y2tldFJlc3VsdC5Db250ZW50cykuZm9yRWFjaCgoY29udGVudCkgPT4ge1xuICAgICAgICBjb25zdCBuYW1lID0gc2FuaXRpemVPYmplY3RLZXkodG9BcnJheShjb250ZW50LktleSlbMF0pXG4gICAgICAgIGNvbnN0IGxhc3RNb2RpZmllZCA9IG5ldyBEYXRlKHRvQXJyYXkoY29udGVudC5MYXN0TW9kaWZpZWQpWzBdKVxuICAgICAgICBjb25zdCBldGFnID0gc2FuaXRpemVFVGFnKHRvQXJyYXkoY29udGVudC5FVGFnKVswXSlcbiAgICAgICAgY29uc3Qgc2l6ZSA9IHNhbml0aXplU2l6ZShjb250ZW50LlNpemUpXG4gICAgICAgIHJlc3VsdC5vYmplY3RzLnB1c2goeyBuYW1lLCBsYXN0TW9kaWZpZWQsIGV0YWcsIHNpemUgfSlcbiAgICAgIH0pXG4gICAgfVxuXG4gICAgaWYgKGxpc3RCdWNrZXRSZXN1bHQuTmV4dE1hcmtlcikge1xuICAgICAgbmV4dE1hcmtlciA9IGxpc3RCdWNrZXRSZXN1bHQuTmV4dE1hcmtlclxuICAgIH0gZWxzZSBpZiAoaXNUcnVuY2F0ZWQgJiYgcmVzdWx0Lm9iamVjdHMubGVuZ3RoID4gMCkge1xuICAgICAgbmV4dE1hcmtlciA9IHJlc3VsdC5vYmplY3RzW3Jlc3VsdC5vYmplY3RzLmxlbmd0aCAtIDFdLm5hbWVcbiAgICB9XG4gICAgcGFyc2VDb21tb25QcmVmaXhlc0VudGl0eShsaXN0QnVja2V0UmVzdWx0LkNvbW1vblByZWZpeGVzKVxuICB9XG5cbiAgaWYgKGxpc3RWZXJzaW9uc1Jlc3VsdCkge1xuICAgIGlmIChsaXN0VmVyc2lvbnNSZXN1bHQuSXNUcnVuY2F0ZWQpIHtcbiAgICAgIGlzVHJ1bmNhdGVkID0gbGlzdFZlcnNpb25zUmVzdWx0LklzVHJ1bmNhdGVkXG4gICAgfVxuXG4gICAgaWYgKGxpc3RWZXJzaW9uc1Jlc3VsdC5WZXJzaW9uKSB7XG4gICAgICB0b0FycmF5KGxpc3RWZXJzaW9uc1Jlc3VsdC5WZXJzaW9uKS5mb3JFYWNoKChjb250ZW50KSA9PiB7XG4gICAgICAgIHJlc3VsdC5vYmplY3RzLnB1c2goZm9ybWF0T2JqSW5mbyhjb250ZW50KSlcbiAgICAgIH0pXG4gICAgfVxuICAgIGlmIChsaXN0VmVyc2lvbnNSZXN1bHQuRGVsZXRlTWFya2VyKSB7XG4gICAgICB0b0FycmF5KGxpc3RWZXJzaW9uc1Jlc3VsdC5EZWxldGVNYXJrZXIpLmZvckVhY2goKGNvbnRlbnQpID0+IHtcbiAgICAgICAgcmVzdWx0Lm9iamVjdHMucHVzaChmb3JtYXRPYmpJbmZvKGNvbnRlbnQsIHsgSXNEZWxldGVNYXJrZXI6IHRydWUgfSkpXG4gICAgICB9KVxuICAgIH1cblxuICAgIGlmIChsaXN0VmVyc2lvbnNSZXN1bHQuTmV4dEtleU1hcmtlcikge1xuICAgICAgbmV4dFZlcnNpb25LZXlNYXJrZXIgPSBsaXN0VmVyc2lvbnNSZXN1bHQuTmV4dEtleU1hcmtlclxuICAgIH1cbiAgICBpZiAobGlzdFZlcnNpb25zUmVzdWx0Lk5leHRWZXJzaW9uSWRNYXJrZXIpIHtcbiAgICAgIHJlc3VsdC52ZXJzaW9uSWRNYXJrZXIgPSBsaXN0VmVyc2lvbnNSZXN1bHQuTmV4dFZlcnNpb25JZE1hcmtlclxuICAgIH1cbiAgICBwYXJzZUNvbW1vblByZWZpeGVzRW50aXR5KGxpc3RWZXJzaW9uc1Jlc3VsdC5Db21tb25QcmVmaXhlcylcbiAgfVxuXG4gIHJlc3VsdC5pc1RydW5jYXRlZCA9IGlzVHJ1bmNhdGVkXG4gIGlmIChpc1RydW5jYXRlZCkge1xuICAgIHJlc3VsdC5uZXh0TWFya2VyID0gbmV4dFZlcnNpb25LZXlNYXJrZXIgfHwgbmV4dE1hcmtlclxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuLy8gcGFyc2UgWE1MIHJlc3BvbnNlIGZvciBsaXN0IG9iamVjdHMgdjIgaW4gYSBidWNrZXRcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxpc3RPYmplY3RzVjIoeG1sKSB7XG4gIHZhciByZXN1bHQgPSB7XG4gICAgb2JqZWN0czogW10sXG4gICAgaXNUcnVuY2F0ZWQ6IGZhbHNlLFxuICB9XG4gIHZhciB4bWxvYmogPSBwYXJzZVhtbCh4bWwpXG4gIGlmICgheG1sb2JqLkxpc3RCdWNrZXRSZXN1bHQpIHtcbiAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRYTUxFcnJvcignTWlzc2luZyB0YWc6IFwiTGlzdEJ1Y2tldFJlc3VsdFwiJylcbiAgfVxuICB4bWxvYmogPSB4bWxvYmouTGlzdEJ1Y2tldFJlc3VsdFxuICBpZiAoeG1sb2JqLklzVHJ1bmNhdGVkKSB7XG4gICAgcmVzdWx0LmlzVHJ1bmNhdGVkID0geG1sb2JqLklzVHJ1bmNhdGVkXG4gIH1cbiAgaWYgKHhtbG9iai5OZXh0Q29udGludWF0aW9uVG9rZW4pIHtcbiAgICByZXN1bHQubmV4dENvbnRpbnVhdGlvblRva2VuID0geG1sb2JqLk5leHRDb250aW51YXRpb25Ub2tlblxuICB9XG4gIGlmICh4bWxvYmouQ29udGVudHMpIHtcbiAgICB0b0FycmF5KHhtbG9iai5Db250ZW50cykuZm9yRWFjaCgoY29udGVudCkgPT4ge1xuICAgICAgdmFyIG5hbWUgPSBzYW5pdGl6ZU9iamVjdEtleSh0b0FycmF5KGNvbnRlbnQuS2V5KVswXSlcbiAgICAgIHZhciBsYXN0TW9kaWZpZWQgPSBuZXcgRGF0ZShjb250ZW50Lkxhc3RNb2RpZmllZClcbiAgICAgIHZhciBldGFnID0gc2FuaXRpemVFVGFnKGNvbnRlbnQuRVRhZylcbiAgICAgIHZhciBzaXplID0gY29udGVudC5TaXplXG4gICAgICByZXN1bHQub2JqZWN0cy5wdXNoKHsgbmFtZSwgbGFzdE1vZGlmaWVkLCBldGFnLCBzaXplIH0pXG4gICAgfSlcbiAgfVxuICBpZiAoeG1sb2JqLkNvbW1vblByZWZpeGVzKSB7XG4gICAgdG9BcnJheSh4bWxvYmouQ29tbW9uUHJlZml4ZXMpLmZvckVhY2goKGNvbW1vblByZWZpeCkgPT4ge1xuICAgICAgcmVzdWx0Lm9iamVjdHMucHVzaCh7IHByZWZpeDogc2FuaXRpemVPYmplY3RLZXkodG9BcnJheShjb21tb25QcmVmaXguUHJlZml4KVswXSksIHNpemU6IDAgfSlcbiAgICB9KVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuLy8gcGFyc2UgWE1MIHJlc3BvbnNlIGZvciBsaXN0IG9iamVjdHMgdjIgd2l0aCBtZXRhZGF0YSBpbiBhIGJ1Y2tldFxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGlzdE9iamVjdHNWMldpdGhNZXRhZGF0YSh4bWwpIHtcbiAgdmFyIHJlc3VsdCA9IHtcbiAgICBvYmplY3RzOiBbXSxcbiAgICBpc1RydW5jYXRlZDogZmFsc2UsXG4gIH1cbiAgdmFyIHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcbiAgaWYgKCF4bWxvYmouTGlzdEJ1Y2tldFJlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJMaXN0QnVja2V0UmVzdWx0XCInKVxuICB9XG4gIHhtbG9iaiA9IHhtbG9iai5MaXN0QnVja2V0UmVzdWx0XG4gIGlmICh4bWxvYmouSXNUcnVuY2F0ZWQpIHtcbiAgICByZXN1bHQuaXNUcnVuY2F0ZWQgPSB4bWxvYmouSXNUcnVuY2F0ZWRcbiAgfVxuICBpZiAoeG1sb2JqLk5leHRDb250aW51YXRpb25Ub2tlbikge1xuICAgIHJlc3VsdC5uZXh0Q29udGludWF0aW9uVG9rZW4gPSB4bWxvYmouTmV4dENvbnRpbnVhdGlvblRva2VuXG4gIH1cblxuICBpZiAoeG1sb2JqLkNvbnRlbnRzKSB7XG4gICAgdG9BcnJheSh4bWxvYmouQ29udGVudHMpLmZvckVhY2goKGNvbnRlbnQpID0+IHtcbiAgICAgIHZhciBuYW1lID0gc2FuaXRpemVPYmplY3RLZXkoY29udGVudC5LZXkpXG4gICAgICB2YXIgbGFzdE1vZGlmaWVkID0gbmV3IERhdGUoY29udGVudC5MYXN0TW9kaWZpZWQpXG4gICAgICB2YXIgZXRhZyA9IHNhbml0aXplRVRhZyhjb250ZW50LkVUYWcpXG4gICAgICB2YXIgc2l6ZSA9IGNvbnRlbnQuU2l6ZVxuICAgICAgdmFyIG1ldGFkYXRhXG4gICAgICBpZiAoY29udGVudC5Vc2VyTWV0YWRhdGEgIT0gbnVsbCkge1xuICAgICAgICBtZXRhZGF0YSA9IHRvQXJyYXkoY29udGVudC5Vc2VyTWV0YWRhdGEpWzBdXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtZXRhZGF0YSA9IG51bGxcbiAgICAgIH1cbiAgICAgIHJlc3VsdC5vYmplY3RzLnB1c2goeyBuYW1lLCBsYXN0TW9kaWZpZWQsIGV0YWcsIHNpemUsIG1ldGFkYXRhIH0pXG4gICAgfSlcbiAgfVxuXG4gIGlmICh4bWxvYmouQ29tbW9uUHJlZml4ZXMpIHtcbiAgICB0b0FycmF5KHhtbG9iai5Db21tb25QcmVmaXhlcykuZm9yRWFjaCgoY29tbW9uUHJlZml4KSA9PiB7XG4gICAgICByZXN1bHQub2JqZWN0cy5wdXNoKHsgcHJlZml4OiBzYW5pdGl6ZU9iamVjdEtleSh0b0FycmF5KGNvbW1vblByZWZpeC5QcmVmaXgpWzBdKSwgc2l6ZTogMCB9KVxuICAgIH0pXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VPYmplY3RSZXRlbnRpb25Db25maWcoeG1sKSB7XG4gIGNvbnN0IHhtbE9iaiA9IHBhcnNlWG1sKHhtbClcbiAgY29uc3QgcmV0ZW50aW9uQ29uZmlnID0geG1sT2JqLlJldGVudGlvblxuXG4gIHJldHVybiB7XG4gICAgbW9kZTogcmV0ZW50aW9uQ29uZmlnLk1vZGUsXG4gICAgcmV0YWluVW50aWxEYXRlOiByZXRlbnRpb25Db25maWcuUmV0YWluVW50aWxEYXRlLFxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyh4bWwpIHtcbiAgY29uc3QgeG1sT2JqID0gcGFyc2VYbWwoeG1sKVxuICByZXR1cm4geG1sT2JqLkxlZ2FsSG9sZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBsb2FkUGFydFBhcnNlcih4bWwpIHtcbiAgY29uc3QgeG1sT2JqID0gcGFyc2VYbWwoeG1sKVxuICBjb25zdCByZXNwRWwgPSB4bWxPYmouQ29weVBhcnRSZXN1bHRcbiAgcmV0dXJuIHJlc3BFbFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlT2JqZWN0c1BhcnNlcih4bWwpIHtcbiAgY29uc3QgeG1sT2JqID0gcGFyc2VYbWwoeG1sKVxuICBpZiAoeG1sT2JqLkRlbGV0ZVJlc3VsdCAmJiB4bWxPYmouRGVsZXRlUmVzdWx0LkVycm9yKSB7XG4gICAgLy8gcmV0dXJuIGVycm9ycyBhcyBhcnJheSBhbHdheXMuIGFzIHRoZSByZXNwb25zZSBpcyBvYmplY3QgaW4gY2FzZSBvZiBzaW5nbGUgb2JqZWN0IHBhc3NlZCBpbiByZW1vdmVPYmplY3RzXG4gICAgcmV0dXJuIHRvQXJyYXkoeG1sT2JqLkRlbGV0ZVJlc3VsdC5FcnJvcilcbiAgfVxuICByZXR1cm4gW11cbn1cbiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFnQkEsSUFBQUEsY0FBQSxHQUFBQyxPQUFBO0FBRUEsSUFBQUMsTUFBQSxHQUFBQyx1QkFBQSxDQUFBRixPQUFBO0FBQ0EsSUFBQUcsT0FBQSxHQUFBSCxPQUFBO0FBQWlILFNBQUFJLHlCQUFBQyxXQUFBLGVBQUFDLE9BQUEsa0NBQUFDLGlCQUFBLE9BQUFELE9BQUEsUUFBQUUsZ0JBQUEsT0FBQUYsT0FBQSxZQUFBRix3QkFBQSxZQUFBQSxDQUFBQyxXQUFBLFdBQUFBLFdBQUEsR0FBQUcsZ0JBQUEsR0FBQUQsaUJBQUEsS0FBQUYsV0FBQTtBQUFBLFNBQUFILHdCQUFBTyxHQUFBLEVBQUFKLFdBQUEsU0FBQUEsV0FBQSxJQUFBSSxHQUFBLElBQUFBLEdBQUEsQ0FBQUMsVUFBQSxXQUFBRCxHQUFBLFFBQUFBLEdBQUEsb0JBQUFBLEdBQUEsd0JBQUFBLEdB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