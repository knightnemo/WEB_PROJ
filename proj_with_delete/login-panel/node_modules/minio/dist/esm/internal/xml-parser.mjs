import crc32 from 'buffer-crc32';
import { XMLParser } from 'fast-xml-parser';
import * as errors from "../errors.mjs";
import { SelectResults } from "../helpers.mjs";
import { isObject, parseXml, readableStream, sanitizeETag, sanitizeObjectKey, toArray } from "./helper.mjs";
import { readAsString } from "./response.mjs";
import { RETENTION_VALIDITY_UNITS } from "./type.mjs";

// parse XML response for bucket region
export function parseBucketRegion(xml) {
  // return region information
  return parseXml(xml).LocationConstraint;
}
const fxp = new XMLParser();

// Parse XML and return information as Javascript types
// parse error XML response
export function parseError(xml, headerInfo) {
  let xmlErr = {};
  const xmlObj = fxp.parse(xml);
  if (xmlObj.Error) {
    xmlErr = xmlObj.Error;
  }
  const e = new errors.S3Error();
  Object.entries(xmlErr).forEach(([key, value]) => {
    e[key.toLowerCase()] = value;
  });
  Object.entries(headerInfo).forEach(([key, value]) => {
    e[key] = value;
  });
  return e;
}

// Generates an Error object depending on http statusCode and XML body
export async function parseResponseError(response) {
  const statusCode = response.statusCode;
  let code, message;
  if (statusCode === 301) {
    code = 'MovedPermanently';
    message = 'Moved Permanently';
  } else if (statusCode === 307) {
    code = 'TemporaryRedirect';
    message = 'Are you using the correct endpoint URL?';
  } else if (statusCode === 403) {
    code = 'AccessDenied';
    message = 'Valid and authorized credentials required';
  } else if (statusCode === 404) {
    code = 'NotFound';
    message = 'Not Found';
  } else if (statusCode === 405) {
    code = 'MethodNotAllowed';
    message = 'Method Not Allowed';
  } else if (statusCode === 501) {
    code = 'MethodNotAllowed';
    message = 'Method Not Allowed';
  } else {
    code = 'UnknownError';
    message = `${statusCode}`;
  }
  const headerInfo = {};
  // A value created by S3 compatible server that uniquely identifies the request.
  headerInfo.amzRequestid = response.headers['x-amz-request-id'];
  // A special token that helps troubleshoot API replies and issues.
  headerInfo.amzId2 = response.headers['x-amz-id-2'];

  // Region where the bucket is located. This header is returned only
  // in HEAD bucket and ListObjects response.
  headerInfo.amzBucketRegion = response.headers['x-amz-bucket-region'];
  const xmlString = await readAsString(response);
  if (xmlString) {
    throw parseError(xmlString, headerInfo);
  }

  // Message should be instantiated for each S3Errors.
  const e = new errors.S3Error(message, {
    cause: headerInfo
  });
  // S3 Error code.
  e.code = code;
  Object.entries(headerInfo).forEach(([key, value]) => {
    // @ts-expect-error force set error properties
    e[key] = value;
  });
  throw e;
}

/**
 * parse XML response for list objects v2 with metadata in a bucket
 */
export function parseListObjectsV2WithMetadata(xml) {
  const result = {
    objects: [],
    isTruncated: false,
    nextContinuationToken: ''
  };
  let xmlobj = parseXml(xml);
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
    toArray(xmlobj.Contents).forEach(content => {
      const name = sanitizeObjectKey(content.Key);
      const lastModified = new Date(content.LastModified);
      const etag = sanitizeETag(content.ETag);
      const size = content.Size;
      let metadata;
      if (content.UserMetadata != null) {
        metadata = toArray(content.UserMetadata)[0];
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
    toArray(xmlobj.CommonPrefixes).forEach(commonPrefix => {
      result.objects.push({
        prefix: sanitizeObjectKey(toArray(commonPrefix.Prefix)[0]),
        size: 0
      });
    });
  }
  return result;
}
// parse XML response for list parts of an in progress multipart upload
export function parseListParts(xml) {
  let xmlobj = parseXml(xml);
  const result = {
    isTruncated: false,
    parts: [],
    marker: 0
  };
  if (!xmlobj.ListPartsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListPartsResult"');
  }
  xmlobj = xmlobj.ListPartsResult;
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated;
  }
  if (xmlobj.NextPartNumberMarker) {
    result.marker = toArray(xmlobj.NextPartNumberMarker)[0] || '';
  }
  if (xmlobj.Part) {
    toArray(xmlobj.Part).forEach(p => {
      const part = parseInt(toArray(p.PartNumber)[0], 10);
      const lastModified = new Date(p.LastModified);
      const etag = p.ETag.replace(/^"/g, '').replace(/"$/g, '').replace(/^&quot;/g, '').replace(/&quot;$/g, '').replace(/^&#34;/g, '').replace(/&#34;$/g, '');
      result.parts.push({
        part,
        lastModified,
        etag,
        size: parseInt(p.Size, 10)
      });
    });
  }
  return result;
}
export function parseListBucket(xml) {
  let result = [];
  const parsedXmlRes = parseXml(xml);
  if (!parsedXmlRes.ListAllMyBucketsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListAllMyBucketsResult"');
  }
  const {
    ListAllMyBucketsResult: {
      Buckets = {}
    } = {}
  } = parsedXmlRes;
  if (Buckets.Bucket) {
    result = toArray(Buckets.Bucket).map((bucket = {}) => {
      const {
        Name: bucketName,
        CreationDate
      } = bucket;
      const creationDate = new Date(CreationDate);
      return {
        name: bucketName,
        creationDate: creationDate
      };
    });
  }
  return result;
}
export function parseInitiateMultipart(xml) {
  let xmlobj = parseXml(xml);
  if (!xmlobj.InitiateMultipartUploadResult) {
    throw new errors.InvalidXMLError('Missing tag: "InitiateMultipartUploadResult"');
  }
  xmlobj = xmlobj.InitiateMultipartUploadResult;
  if (xmlobj.UploadId) {
    return xmlobj.UploadId;
  }
  throw new errors.InvalidXMLError('Missing tag: "UploadId"');
}
export function parseReplicationConfig(xml) {
  const xmlObj = parseXml(xml);
  const {
    Role,
    Rule
  } = xmlObj.ReplicationConfiguration;
  return {
    ReplicationConfiguration: {
      role: Role,
      rules: toArray(Rule)
    }
  };
}
export function parseObjectLegalHoldConfig(xml) {
  const xmlObj = parseXml(xml);
  return xmlObj.LegalHold;
}
export function parseTagging(xml) {
  const xmlObj = parseXml(xml);
  let result = [];
  if (xmlObj.Tagging && xmlObj.Tagging.TagSet && xmlObj.Tagging.TagSet.Tag) {
    const tagResult = xmlObj.Tagging.TagSet.Tag;
    // if it is a single tag convert into an array so that the return value is always an array.
    if (isObject(tagResult)) {
      result.push(tagResult);
    } else {
      result = tagResult;
    }
  }
  return result;
}

// parse XML response when a multipart upload is completed
export function parseCompleteMultipart(xml) {
  const xmlobj = parseXml(xml).CompleteMultipartUploadResult;
  if (xmlobj.Location) {
    const location = toArray(xmlobj.Location)[0];
    const bucket = toArray(xmlobj.Bucket)[0];
    const key = xmlobj.Key;
    const etag = xmlobj.ETag.replace(/^"/g, '').replace(/"$/g, '').replace(/^&quot;/g, '').replace(/&quot;$/g, '').replace(/^&#34;/g, '').replace(/&#34;$/g, '');
    return {
      location,
      bucket,
      key,
      etag
    };
  }
  // Complete Multipart can return XML Error after a 200 OK response
  if (xmlobj.Code && xmlobj.Message) {
    const errCode = toArray(xmlobj.Code)[0];
    const errMessage = toArray(xmlobj.Message)[0];
    return {
      errCode,
      errMessage
    };
  }
}
// parse XML response for listing in-progress multipart uploads
export function parseListMultipart(xml) {
  const result = {
    prefixes: [],
    uploads: [],
    isTruncated: false,
    nextKeyMarker: '',
    nextUploadIdMarker: ''
  };
  let xmlobj = parseXml(xml);
  if (!xmlobj.ListMultipartUploadsResult) {
    throw new errors.InvalidXMLError('Missing tag: "ListMultipartUploadsResult"');
  }
  xmlobj = xmlobj.ListMultipartUploadsResult;
  if (xmlobj.IsTruncated) {
    result.isTruncated = xmlobj.IsTruncated;
  }
  if (xmlobj.NextKeyMarker) {
    result.nextKeyMarker = xmlobj.NextKeyMarker;
  }
  if (xmlobj.NextUploadIdMarker) {
    result.nextUploadIdMarker = xmlobj.nextUploadIdMarker || '';
  }
  if (xmlobj.CommonPrefixes) {
    toArray(xmlobj.CommonPrefixes).forEach(prefix => {
      // @ts-expect-error index check
      result.prefixes.push({
        prefix: sanitizeObjectKey(toArray(prefix.Prefix)[0])
      });
    });
  }
  if (xmlobj.Upload) {
    toArray(xmlobj.Upload).forEach(upload => {
      const key = upload.Key;
      const uploadId = upload.UploadId;
      const initiator = {
        id: upload.Initiator.ID,
        displayName: upload.Initiator.DisplayName
      };
      const owner = {
        id: upload.Owner.ID,
        displayName: upload.Owner.DisplayName
      };
      const storageClass = upload.StorageClass;
      const initiated = new Date(upload.Initiated);
      result.uploads.push({
        key,
        uploadId,
        initiator,
        owner,
        storageClass,
        initiated
      });
    });
  }
  return result;
}
export function parseObjectLockConfig(xml) {
  const xmlObj = parseXml(xml);
  let lockConfigResult = {};
  if (xmlObj.ObjectLockConfiguration) {
    lockConfigResult = {
      objectLockEnabled: xmlObj.ObjectLockConfiguration.ObjectLockEnabled
    };
    let retentionResp;
    if (xmlObj.ObjectLockConfiguration && xmlObj.ObjectLockConfiguration.Rule && xmlObj.ObjectLockConfiguration.Rule.DefaultRetention) {
      retentionResp = xmlObj.ObjectLockConfiguration.Rule.DefaultRetention || {};
      lockConfigResult.mode = retentionResp.Mode;
    }
    if (retentionResp) {
      const isUnitYears = retentionResp.Years;
      if (isUnitYears) {
        lockConfigResult.validity = isUnitYears;
        lockConfigResult.unit = RETENTION_VALIDITY_UNITS.YEARS;
      } else {
        lockConfigResult.validity = retentionResp.Days;
        lockConfigResult.unit = RETENTION_VALIDITY_UNITS.DAYS;
      }
    }
  }
  return lockConfigResult;
}
export function parseBucketVersioningConfig(xml) {
  const xmlObj = parseXml(xml);
  return xmlObj.VersioningConfiguration;
}

// Used only in selectObjectContent API.
// extractHeaderType extracts the first half of the header message, the header type.
function extractHeaderType(stream) {
  const headerNameLen = Buffer.from(stream.read(1)).readUInt8();
  const headerNameWithSeparator = Buffer.from(stream.read(headerNameLen)).toString();
  const splitBySeparator = (headerNameWithSeparator || '').split(':');
  return splitBySeparator.length >= 1 ? splitBySeparator[1] : '';
}
function extractHeaderValue(stream) {
  const bodyLen = Buffer.from(stream.read(2)).readUInt16BE();
  return Buffer.from(stream.read(bodyLen)).toString();
}
export function parseSelectObjectContentResponse(res) {
  const selectResults = new SelectResults({}); // will be returned

  const responseStream = readableStream(res); // convert byte array to a readable responseStream
  // @ts-ignore
  while (responseStream._readableState.length) {
    // Top level responseStream read tracker.
    let msgCrcAccumulator; // accumulate from start of the message till the message crc start.

    const totalByteLengthBuffer = Buffer.from(responseStream.read(4));
    msgCrcAccumulator = crc32(totalByteLengthBuffer);
    const headerBytesBuffer = Buffer.from(responseStream.read(4));
    msgCrcAccumulator = crc32(headerBytesBuffer, msgCrcAccumulator);
    const calculatedPreludeCrc = msgCrcAccumulator.readInt32BE(); // use it to check if any CRC mismatch in header itself.

    const preludeCrcBuffer = Buffer.from(responseStream.read(4)); // read 4 bytes    i.e 4+4 =8 + 4 = 12 ( prelude + prelude crc)
    msgCrcAccumulator = crc32(preludeCrcBuffer, msgCrcAccumulator);
    const totalMsgLength = totalByteLengthBuffer.readInt32BE();
    const headerLength = headerBytesBuffer.readInt32BE();
    const preludeCrcByteValue = preludeCrcBuffer.readInt32BE();
    if (preludeCrcByteValue !== calculatedPreludeCrc) {
      // Handle Header CRC mismatch Error
      throw new Error(`Header Checksum Mismatch, Prelude CRC of ${preludeCrcByteValue} does not equal expected CRC of ${calculatedPreludeCrc}`);
    }
    const headers = {};
    if (headerLength > 0) {
      const headerBytes = Buffer.from(responseStream.read(headerLength));
      msgCrcAccumulator = crc32(headerBytes, msgCrcAccumulator);
      const headerReaderStream = readableStream(headerBytes);
      // @ts-ignore
      while (headerReaderStream._readableState.length) {
        const headerTypeName = extractHeaderType(headerReaderStream);
        headerReaderStream.read(1); // just read and ignore it.
        if (headerTypeName) {
          headers[headerTypeName] = extractHeaderValue(headerReaderStream);
        }
      }
    }
    let payloadStream;
    const payLoadLength = totalMsgLength - headerLength - 16;
    if (payLoadLength > 0) {
      const payLoadBuffer = Buffer.from(responseStream.read(payLoadLength));
      msgCrcAccumulator = crc32(payLoadBuffer, msgCrcAccumulator);
      // read the checksum early and detect any mismatch so we can avoid unnecessary further processing.
      const messageCrcByteValue = Buffer.from(responseStream.read(4)).readInt32BE();
      const calculatedCrc = msgCrcAccumulator.readInt32BE();
      // Handle message CRC Error
      if (messageCrcByteValue !== calculatedCrc) {
        throw new Error(`Message Checksum Mismatch, Message CRC of ${messageCrcByteValue} does not equal expected CRC of ${calculatedCrc}`);
      }
      payloadStream = readableStream(payLoadBuffer);
    }
    const messageType = headers['message-type'];
    switch (messageType) {
      case 'error':
        {
          const errorMessage = headers['error-code'] + ':"' + headers['error-message'] + '"';
          throw new Error(errorMessage);
        }
      case 'event':
        {
          const contentType = headers['content-type'];
          const eventType = headers['event-type'];
          switch (eventType) {
            case 'End':
              {
                selectResults.setResponse(res);
                return selectResults;
              }
            case 'Records':
              {
                var _payloadStream;
                const readData = (_payloadStream = payloadStream) === null || _payloadStream === void 0 ? void 0 : _payloadStream.read(payLoadLength);
                selectResults.setRecords(readData);
                break;
              }
            case 'Progress':
              {
                switch (contentType) {
                  case 'text/xml':
                    {
                      var _payloadStream2;
                      const progressData = (_payloadStream2 = payloadStream) === null || _payloadStream2 === void 0 ? void 0 : _payloadStream2.read(payLoadLength);
                      selectResults.setProgress(progressData.toString());
                      break;
                    }
                  default:
                    {
                      const errorMessage = `Unexpected content-type ${contentType} sent for event-type Progress`;
                      throw new Error(errorMessage);
                    }
                }
              }
              break;
            case 'Stats':
              {
                switch (contentType) {
                  case 'text/xml':
                    {
                      var _payloadStream3;
                      const statsData = (_payloadStream3 = payloadStream) === null || _payloadStream3 === void 0 ? void 0 : _payloadStream3.read(payLoadLength);
                      selectResults.setStats(statsData.toString());
                      break;
                    }
                  default:
                    {
                      const errorMessage = `Unexpected content-type ${contentType} sent for event-type Stats`;
                      throw new Error(errorMessage);
                    }
                }
              }
              break;
            default:
              {
                // Continuation message: Not sure if it is supported. did not find a reference or any message in response.
                // It does not have a payload.
                const warningMessage = `Un implemented event detected  ${messageType}.`;
                // eslint-disable-next-line no-console
                console.warn(warningMessage);
              }
          }
        }
    }
  }
}
export function parseLifecycleConfig(xml) {
  const xmlObj = parseXml(xml);
  return xmlObj.LifecycleConfiguration;
}
export function parseBucketEncryptionConfig(xml) {
  return parseXml(xml);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJuYW1lcyI6WyJjcmMzMiIsIlhNTFBhcnNlciIsImVycm9ycyIsIlNlbGVjdFJlc3VsdHMiLCJpc09iamVjdCIsInBhcnNlWG1sIiwicmVhZGFibGVTdHJlYW0iLCJzYW5pdGl6ZUVUYWciLCJzYW5pdGl6ZU9iamVjdEtleSIsInRvQXJyYXkiLCJyZWFkQXNTdHJpbmciLCJSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMiLCJwYXJzZUJ1Y2tldFJlZ2lvbiIsInhtbCIsIkxvY2F0aW9uQ29uc3RyYWludCIsImZ4cCIsInBhcnNlRXJyb3IiLCJoZWFkZXJJbmZvIiwieG1sRXJyIiwieG1sT2JqIiwicGFyc2UiLCJFcnJvciIsImUiLCJTM0Vycm9yIiwiT2JqZWN0IiwiZW50cmllcyIsImZvckVhY2giLCJrZXkiLCJ2YWx1ZSIsInRvTG93ZXJDYXNlIiwicGFyc2VSZXNwb25zZUVycm9yIiwicmVzcG9uc2UiLCJzdGF0dXNDb2RlIiwiY29kZSIsIm1lc3NhZ2UiLCJhbXpSZXF1ZXN0aWQiLCJoZWFkZXJzIiwiYW16SWQyIiwiYW16QnVja2V0UmVnaW9uIiwieG1sU3RyaW5nIiwiY2F1c2UiLCJwYXJzZUxpc3RPYmplY3RzVjJXaXRoTWV0YWRhdGEiLCJyZXN1bHQiLCJvYmplY3RzIiwiaXNUcnVuY2F0ZWQiLCJuZXh0Q29udGludWF0aW9uVG9rZW4iLCJ4bWxvYmoiLCJMaXN0QnVja2V0UmVzdWx0IiwiSW52YWxpZFhNTEVycm9yIiwiSXNUcnVuY2F0ZWQiLCJOZXh0Q29udGludWF0aW9uVG9rZW4iLCJDb250ZW50cyIsImNvbnRlbnQiLCJuYW1lIiwiS2V5IiwibGFzdE1vZGlmaWVkIiwiRGF0ZSIsIkxhc3RNb2RpZmllZCIsImV0YWciLCJFVGFnIiwic2l6ZSIsIlNpemUiLCJtZXRhZGF0YSIsIlVzZXJNZXRhZGF0YSIsInB1c2giLCJDb21tb25QcmVmaXhlcyIsImNvbW1vblByZWZpeCIsInByZWZpeCIsIlByZWZpeCIsInBhcnNlTGlzdFBhcnRzIiwicGFydHMiLCJtYXJrZXIiLCJMaXN0UGFydHNSZXN1bHQiLCJOZXh0UGFydE51bWJlck1hcmtlciIsIlBhcnQiLCJwIiwicGFydCIsInBhcnNlSW50IiwiUGFydE51bWJlciIsInJlcGxhY2UiLCJwYXJzZUxpc3RCdWNrZXQiLCJwYXJzZWRYbWxSZXMiLCJMaXN0QWxsTXlCdWNrZXRzUmVzdWx0IiwiQnVja2V0cyIsIkJ1Y2tldCIsIm1hcCIsImJ1Y2tldCIsIk5hbWUiLCJidWNrZXROYW1lIiwiQ3JlYXRpb25EYXRlIiwiY3JlYXRpb25EYXRlIiwicGFyc2VJbml0aWF0ZU11bHRpcGFydCIsIkluaXRpYXRlTXVsdGlwYXJ0VXBsb2FkUmVzdWx0IiwiVXBsb2FkSWQiLCJwYXJzZVJlcGxpY2F0aW9uQ29uZmlnIiwiUm9sZSIsIlJ1bGUiLCJSZXBsaWNhdGlvbkNvbmZpZ3VyYXRpb24iLCJyb2xlIiwicnVsZXMiLCJwYXJzZU9iamVjdExlZ2FsSG9sZENvbmZpZyIsIkxlZ2FsSG9sZCIsInBhcnNlVGFnZ2luZyIsIlRhZ2dpbmciLCJUYWdTZXQiLCJUYWciLCJ0YWdSZXN1bHQiLCJwYXJzZUNvbXBsZXRlTXVsdGlwYXJ0IiwiQ29tcGxldGVNdWx0aXBhcnRVcGxvYWRSZXN1bHQiLCJMb2NhdGlvbiIsImxvY2F0aW9uIiwiQ29kZSIsIk1lc3NhZ2UiLCJlcnJDb2RlIiwiZXJyTWVzc2FnZSIsInBhcnNlTGlzdE11bHRpcGFydCIsInByZWZpeGVzIiwidXBsb2FkcyIsIm5leHRLZXlNYXJrZXIiLCJuZXh0VXBsb2FkSWRNYXJrZXIiLCJMaXN0TXVsdGlwYXJ0VXBsb2Fkc1Jlc3VsdCIsIk5leHRLZXlNYXJrZXIiLCJOZXh0VXBsb2FkSWRNYXJrZXIiLCJVcGxvYWQiLCJ1cGxvYWQiLCJ1cGxvYWRJZCIsImluaXRpYXRvciIsImlkIiwiSW5pdGlhdG9yIiwiSUQiLCJkaXNwbGF5TmFtZSIsIkRpc3BsYXlOYW1lIiwib3duZXIiLCJPd25lciIsInN0b3JhZ2VDbGFzcyIsIlN0b3JhZ2VDbGFzcyIsImluaXRpYXRlZCIsIkluaXRpYXRlZCIsInBhcnNlT2JqZWN0TG9ja0NvbmZpZyIsImxvY2tDb25maWdSZXN1bHQiLCJPYmplY3RMb2NrQ29uZmlndXJhdGlvbiIsIm9iamVjdExvY2tFbmFibGVkIiwiT2JqZWN0TG9ja0VuYWJsZWQiLCJyZXRlbnRpb25SZXNwIiwiRGVmYXVsdFJldGVudGlvbiIsIm1vZGUiLCJNb2RlIiwiaXNVbml0WWVhcnMiLCJZZWFycyIsInZhbGlkaXR5IiwidW5pdCIsIllFQVJTIiwiRGF5cyIsIkRBWVMiLCJwYXJzZUJ1Y2tldFZlcnNpb25pbmdDb25maWciLCJWZXJzaW9uaW5nQ29uZmlndXJhdGlvbiIsImV4dHJhY3RIZWFkZXJUeXBlIiwic3RyZWFtIiwiaGVhZGVyTmFtZUxlbiIsIkJ1ZmZlciIsImZyb20iLCJyZWFkIiwicmVhZFVJbnQ4IiwiaGVhZGVyTmFtZVdpdGhTZXBhcmF0b3IiLCJ0b1N0cmluZyIsInNwbGl0QnlTZXBhcmF0b3IiLCJzcGxpdCIsImxlbmd0aCIsImV4dHJhY3RIZWFkZXJWYWx1ZSIsImJvZHlMZW4iLCJyZWFkVUludDE2QkUiLCJwYXJzZVNlbGVjdE9iamVjdENvbnRlbnRSZXNwb25zZSIsInJlcyIsInNlbGVjdFJlc3VsdHMiLCJyZXNwb25zZVN0cmVhbSIsIl9yZWFkYWJsZVN0YXRlIiwibXNnQ3JjQWNjdW11bGF0b3IiLCJ0b3RhbEJ5dGVMZW5ndGhCdWZmZXIiLCJoZWFkZXJCeXRlc0J1ZmZlciIsImNhbGN1bGF0ZWRQcmVsdWRlQ3JjIiwicmVhZEludDMyQkUiLCJwcmVsdWRlQ3JjQnVmZmVyIiwidG90YWxNc2dMZW5ndGgiLCJoZWFkZXJMZW5ndGgiLCJwcmVsdWRlQ3JjQnl0ZVZhbHVlIiwiaGVhZGVyQnl0ZXMiLCJoZWFkZXJSZWFkZXJTdHJlYW0iLCJoZWFkZXJUeXBlTmFtZSIsInBheWxvYWRTdHJlYW0iLCJwYXlMb2FkTGVuZ3RoIiwicGF5TG9hZEJ1ZmZlciIsIm1lc3NhZ2VDcmNCeXRlVmFsdWUiLCJjYWxjdWxhdGVkQ3JjIiwibWVzc2FnZVR5cGUiLCJlcnJvck1lc3NhZ2UiLCJjb250ZW50VHlwZSIsImV2ZW50VHlwZSIsInNldFJlc3BvbnNlIiwiX3BheWxvYWRTdHJlYW0iLCJyZWFkRGF0YSIsInNldFJlY29yZHMiLCJfcGF5bG9hZFN0cmVhbTIiLCJwcm9ncmVzc0RhdGEiLCJzZXRQcm9ncmVzcyIsIl9wYXlsb2FkU3RyZWFtMyIsInN0YXRzRGF0YSIsInNldFN0YXRzIiwid2FybmluZ01lc3NhZ2UiLCJjb25zb2xlIiwid2FybiIsInBhcnNlTGlmZWN5Y2xlQ29uZmlnIiwiTGlmZWN5Y2xlQ29uZmlndXJhdGlvbiIsInBhcnNlQnVja2V0RW5jcnlwdGlvbkNvbmZpZyJdLCJzb3VyY2VzIjpbInhtbC1wYXJzZXIudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR5cGUgKiBhcyBodHRwIGZyb20gJ25vZGU6aHR0cCdcbmltcG9ydCB0eXBlIHN0cmVhbSBmcm9tICdub2RlOnN0cmVhbSdcblxuaW1wb3J0IGNyYzMyIGZyb20gJ2J1ZmZlci1jcmMzMidcbmltcG9ydCB7IFhNTFBhcnNlciB9IGZyb20gJ2Zhc3QteG1sLXBhcnNlcidcblxuaW1wb3J0ICogYXMgZXJyb3JzIGZyb20gJy4uL2Vycm9ycy50cydcbmltcG9ydCB7IFNlbGVjdFJlc3VsdHMgfSBmcm9tICcuLi9oZWxwZXJzLnRzJ1xuaW1wb3J0IHsgaXNPYmplY3QsIHBhcnNlWG1sLCByZWFkYWJsZVN0cmVhbSwgc2FuaXRpemVFVGFnLCBzYW5pdGl6ZU9iamVjdEtleSwgdG9BcnJheSB9IGZyb20gJy4vaGVscGVyLnRzJ1xuaW1wb3J0IHsgcmVhZEFzU3RyaW5nIH0gZnJvbSAnLi9yZXNwb25zZS50cydcbmltcG9ydCB0eXBlIHsgQnVja2V0SXRlbUZyb21MaXN0LCBCdWNrZXRJdGVtV2l0aE1ldGFkYXRhLCBPYmplY3RMb2NrSW5mbywgUmVwbGljYXRpb25Db25maWcgfSBmcm9tICcuL3R5cGUudHMnXG5pbXBvcnQgeyBSRVRFTlRJT05fVkFMSURJVFlfVU5JVFMgfSBmcm9tICcuL3R5cGUudHMnXG5cbi8vIHBhcnNlIFhNTCByZXNwb25zZSBmb3IgYnVja2V0IHJlZ2lvblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQnVja2V0UmVnaW9uKHhtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgLy8gcmV0dXJuIHJlZ2lvbiBpbmZvcm1hdGlvblxuICByZXR1cm4gcGFyc2VYbWwoeG1sKS5Mb2NhdGlvbkNvbnN0cmFpbnRcbn1cblxuY29uc3QgZnhwID0gbmV3IFhNTFBhcnNlcigpXG5cbi8vIFBhcnNlIFhNTCBhbmQgcmV0dXJuIGluZm9ybWF0aW9uIGFzIEphdmFzY3JpcHQgdHlwZXNcbi8vIHBhcnNlIGVycm9yIFhNTCByZXNwb25zZVxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRXJyb3IoeG1sOiBzdHJpbmcsIGhlYWRlckluZm86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KSB7XG4gIGxldCB4bWxFcnIgPSB7fVxuICBjb25zdCB4bWxPYmogPSBmeHAucGFyc2UoeG1sKVxuICBpZiAoeG1sT2JqLkVycm9yKSB7XG4gICAgeG1sRXJyID0geG1sT2JqLkVycm9yXG4gIH1cbiAgY29uc3QgZSA9IG5ldyBlcnJvcnMuUzNFcnJvcigpIGFzIHVua25vd24gYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj5cbiAgT2JqZWN0LmVudHJpZXMoeG1sRXJyKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICBlW2tleS50b0xvd2VyQ2FzZSgpXSA9IHZhbHVlXG4gIH0pXG4gIE9iamVjdC5lbnRyaWVzKGhlYWRlckluZm8pLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgIGVba2V5XSA9IHZhbHVlXG4gIH0pXG4gIHJldHVybiBlXG59XG5cbi8vIEdlbmVyYXRlcyBhbiBFcnJvciBvYmplY3QgZGVwZW5kaW5nIG9uIGh0dHAgc3RhdHVzQ29kZSBhbmQgWE1MIGJvZHlcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBwYXJzZVJlc3BvbnNlRXJyb3IocmVzcG9uc2U6IGh0dHAuSW5jb21pbmdNZXNzYWdlKSB7XG4gIGNvbnN0IHN0YXR1c0NvZGUgPSByZXNwb25zZS5zdGF0dXNDb2RlXG4gIGxldCBjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZ1xuICBpZiAoc3RhdHVzQ29kZSA9PT0gMzAxKSB7XG4gICAgY29kZSA9ICdNb3ZlZFBlcm1hbmVudGx5J1xuICAgIG1lc3NhZ2UgPSAnTW92ZWQgUGVybWFuZW50bHknXG4gIH0gZWxzZSBpZiAoc3RhdHVzQ29kZSA9PT0gMzA3KSB7XG4gICAgY29kZSA9ICdUZW1wb3JhcnlSZWRpcmVjdCdcbiAgICBtZXNzYWdlID0gJ0FyZSB5b3UgdXNpbmcgdGhlIGNvcnJlY3QgZW5kcG9pbnQgVVJMPydcbiAgfSBlbHNlIGlmIChzdGF0dXNDb2RlID09PSA0MDMpIHtcbiAgICBjb2RlID0gJ0FjY2Vzc0RlbmllZCdcbiAgICBtZXNzYWdlID0gJ1ZhbGlkIGFuZCBhdXRob3JpemVkIGNyZWRlbnRpYWxzIHJlcXVpcmVkJ1xuICB9IGVsc2UgaWYgKHN0YXR1c0NvZGUgPT09IDQwNCkge1xuICAgIGNvZGUgPSAnTm90Rm91bmQnXG4gICAgbWVzc2FnZSA9ICdOb3QgRm91bmQnXG4gIH0gZWxzZSBpZiAoc3RhdHVzQ29kZSA9PT0gNDA1KSB7XG4gICAgY29kZSA9ICdNZXRob2ROb3RBbGxvd2VkJ1xuICAgIG1lc3NhZ2UgPSAnTWV0aG9kIE5vdCBBbGxvd2VkJ1xuICB9IGVsc2UgaWYgKHN0YXR1c0NvZGUgPT09IDUwMSkge1xuICAgIGNvZGUgPSAnTWV0aG9kTm90QWxsb3dlZCdcbiAgICBtZXNzYWdlID0gJ01ldGhvZCBOb3QgQWxsb3dlZCdcbiAgfSBlbHNlIHtcbiAgICBjb2RlID0gJ1Vua25vd25FcnJvcidcbiAgICBtZXNzYWdlID0gYCR7c3RhdHVzQ29kZX1gXG4gIH1cbiAgY29uc3QgaGVhZGVySW5mbzogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkIHwgbnVsbD4gPSB7fVxuICAvLyBBIHZhbHVlIGNyZWF0ZWQgYnkgUzMgY29tcGF0aWJsZSBzZXJ2ZXIgdGhhdCB1bmlxdWVseSBpZGVudGlmaWVzIHRoZSByZXF1ZXN0LlxuICBoZWFkZXJJbmZvLmFtelJlcXVlc3RpZCA9IHJlc3BvbnNlLmhlYWRlcnNbJ3gtYW16LXJlcXVlc3QtaWQnXSBhcyBzdHJpbmcgfCB1bmRlZmluZWRcbiAgLy8gQSBzcGVjaWFsIHRva2VuIHRoYXQgaGVscHMgdHJvdWJsZXNob290IEFQSSByZXBsaWVzIGFuZCBpc3N1ZXMuXG4gIGhlYWRlckluZm8uYW16SWQyID0gcmVzcG9uc2UuaGVhZGVyc1sneC1hbXotaWQtMiddIGFzIHN0cmluZyB8IHVuZGVmaW5lZFxuXG4gIC8vIFJlZ2lvbiB3aGVyZSB0aGUgYnVja2V0IGlzIGxvY2F0ZWQuIFRoaXMgaGVhZGVyIGlzIHJldHVybmVkIG9ubHlcbiAgLy8gaW4gSEVBRCBidWNrZXQgYW5kIExpc3RPYmplY3RzIHJlc3BvbnNlLlxuICBoZWFkZXJJbmZvLmFtekJ1Y2tldFJlZ2lvbiA9IHJlc3BvbnNlLmhlYWRlcnNbJ3gtYW16LWJ1Y2tldC1yZWdpb24nXSBhcyBzdHJpbmcgfCB1bmRlZmluZWRcblxuICBjb25zdCB4bWxTdHJpbmcgPSBhd2FpdCByZWFkQXNTdHJpbmcocmVzcG9uc2UpXG5cbiAgaWYgKHhtbFN0cmluZykge1xuICAgIHRocm93IHBhcnNlRXJyb3IoeG1sU3RyaW5nLCBoZWFkZXJJbmZvKVxuICB9XG5cbiAgLy8gTWVzc2FnZSBzaG91bGQgYmUgaW5zdGFudGlhdGVkIGZvciBlYWNoIFMzRXJyb3JzLlxuICBjb25zdCBlID0gbmV3IGVycm9ycy5TM0Vycm9yKG1lc3NhZ2UsIHsgY2F1c2U6IGhlYWRlckluZm8gfSlcbiAgLy8gUzMgRXJyb3IgY29kZS5cbiAgZS5jb2RlID0gY29kZVxuICBPYmplY3QuZW50cmllcyhoZWFkZXJJbmZvKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yIGZvcmNlIHNldCBlcnJvciBwcm9wZXJ0aWVzXG4gICAgZVtrZXldID0gdmFsdWVcbiAgfSlcblxuICB0aHJvdyBlXG59XG5cbi8qKlxuICogcGFyc2UgWE1MIHJlc3BvbnNlIGZvciBsaXN0IG9iamVjdHMgdjIgd2l0aCBtZXRhZGF0YSBpbiBhIGJ1Y2tldFxuICovXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VMaXN0T2JqZWN0c1YyV2l0aE1ldGFkYXRhKHhtbDogc3RyaW5nKSB7XG4gIGNvbnN0IHJlc3VsdDoge1xuICAgIG9iamVjdHM6IEFycmF5PEJ1Y2tldEl0ZW1XaXRoTWV0YWRhdGE+XG4gICAgaXNUcnVuY2F0ZWQ6IGJvb2xlYW5cbiAgICBuZXh0Q29udGludWF0aW9uVG9rZW46IHN0cmluZ1xuICB9ID0ge1xuICAgIG9iamVjdHM6IFtdLFxuICAgIGlzVHJ1bmNhdGVkOiBmYWxzZSxcbiAgICBuZXh0Q29udGludWF0aW9uVG9rZW46ICcnLFxuICB9XG5cbiAgbGV0IHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcbiAgaWYgKCF4bWxvYmouTGlzdEJ1Y2tldFJlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJMaXN0QnVja2V0UmVzdWx0XCInKVxuICB9XG4gIHhtbG9iaiA9IHhtbG9iai5MaXN0QnVja2V0UmVzdWx0XG4gIGlmICh4bWxvYmouSXNUcnVuY2F0ZWQpIHtcbiAgICByZXN1bHQuaXNUcnVuY2F0ZWQgPSB4bWxvYmouSXNUcnVuY2F0ZWRcbiAgfVxuICBpZiAoeG1sb2JqLk5leHRDb250aW51YXRpb25Ub2tlbikge1xuICAgIHJlc3VsdC5uZXh0Q29udGludWF0aW9uVG9rZW4gPSB4bWxvYmouTmV4dENvbnRpbnVhdGlvblRva2VuXG4gIH1cblxuICBpZiAoeG1sb2JqLkNvbnRlbnRzKSB7XG4gICAgdG9BcnJheSh4bWxvYmouQ29udGVudHMpLmZvckVhY2goKGNvbnRlbnQpID0+IHtcbiAgICAgIGNvbnN0IG5hbWUgPSBzYW5pdGl6ZU9iamVjdEtleShjb250ZW50LktleSlcbiAgICAgIGNvbnN0IGxhc3RNb2RpZmllZCA9IG5ldyBEYXRlKGNvbnRlbnQuTGFzdE1vZGlmaWVkKVxuICAgICAgY29uc3QgZXRhZyA9IHNhbml0aXplRVRhZyhjb250ZW50LkVUYWcpXG4gICAgICBjb25zdCBzaXplID0gY29udGVudC5TaXplXG4gICAgICBsZXQgbWV0YWRhdGFcbiAgICAgIGlmIChjb250ZW50LlVzZXJNZXRhZGF0YSAhPSBudWxsKSB7XG4gICAgICAgIG1ldGFkYXRhID0gdG9BcnJheShjb250ZW50LlVzZXJNZXRhZGF0YSlbMF1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1ldGFkYXRhID0gbnVsbFxuICAgICAgfVxuICAgICAgcmVzdWx0Lm9iamVjdHMucHVzaCh7IG5hbWUsIGxhc3RNb2RpZmllZCwgZXRhZywgc2l6ZSwgbWV0YWRhdGEgfSlcbiAgICB9KVxuICB9XG5cbiAgaWYgKHhtbG9iai5Db21tb25QcmVmaXhlcykge1xuICAgIHRvQXJyYXkoeG1sb2JqLkNvbW1vblByZWZpeGVzKS5mb3JFYWNoKChjb21tb25QcmVmaXgpID0+IHtcbiAgICAgIHJlc3VsdC5vYmplY3RzLnB1c2goeyBwcmVmaXg6IHNhbml0aXplT2JqZWN0S2V5KHRvQXJyYXkoY29tbW9uUHJlZml4LlByZWZpeClbMF0pLCBzaXplOiAwIH0pXG4gICAgfSlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmV4cG9ydCB0eXBlIE11bHRpcGFydCA9IHtcbiAgdXBsb2FkczogQXJyYXk8e1xuICAgIGtleTogc3RyaW5nXG4gICAgdXBsb2FkSWQ6IHN0cmluZ1xuICAgIGluaXRpYXRvcjogdW5rbm93blxuICAgIG93bmVyOiB1bmtub3duXG4gICAgc3RvcmFnZUNsYXNzOiB1bmtub3duXG4gICAgaW5pdGlhdGVkOiB1bmtub3duXG4gIH0+XG4gIHByZWZpeGVzOiB7XG4gICAgcHJlZml4OiBzdHJpbmdcbiAgfVtdXG4gIGlzVHJ1bmNhdGVkOiBib29sZWFuXG4gIG5leHRLZXlNYXJrZXI6IHVuZGVmaW5lZFxuICBuZXh0VXBsb2FkSWRNYXJrZXI6IHVuZGVmaW5lZFxufVxuXG5leHBvcnQgdHlwZSBVcGxvYWRlZFBhcnQgPSB7XG4gIHBhcnQ6IG51bWJlclxuICBsYXN0TW9kaWZpZWQ/OiBEYXRlXG4gIGV0YWc6IHN0cmluZ1xuICBzaXplOiBudW1iZXJcbn1cblxuLy8gcGFyc2UgWE1MIHJlc3BvbnNlIGZvciBsaXN0IHBhcnRzIG9mIGFuIGluIHByb2dyZXNzIG11bHRpcGFydCB1cGxvYWRcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxpc3RQYXJ0cyh4bWw6IHN0cmluZyk6IHtcbiAgaXNUcnVuY2F0ZWQ6IGJvb2xlYW5cbiAgbWFya2VyOiBudW1iZXJcbiAgcGFydHM6IFVwbG9hZGVkUGFydFtdXG59IHtcbiAgbGV0IHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcbiAgY29uc3QgcmVzdWx0OiB7XG4gICAgaXNUcnVuY2F0ZWQ6IGJvb2xlYW5cbiAgICBtYXJrZXI6IG51bWJlclxuICAgIHBhcnRzOiBVcGxvYWRlZFBhcnRbXVxuICB9ID0ge1xuICAgIGlzVHJ1bmNhdGVkOiBmYWxzZSxcbiAgICBwYXJ0czogW10sXG4gICAgbWFya2VyOiAwLFxuICB9XG4gIGlmICgheG1sb2JqLkxpc3RQYXJ0c1Jlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJMaXN0UGFydHNSZXN1bHRcIicpXG4gIH1cbiAgeG1sb2JqID0geG1sb2JqLkxpc3RQYXJ0c1Jlc3VsdFxuICBpZiAoeG1sb2JqLklzVHJ1bmNhdGVkKSB7XG4gICAgcmVzdWx0LmlzVHJ1bmNhdGVkID0geG1sb2JqLklzVHJ1bmNhdGVkXG4gIH1cbiAgaWYgKHhtbG9iai5OZXh0UGFydE51bWJlck1hcmtlcikge1xuICAgIHJlc3VsdC5tYXJrZXIgPSB0b0FycmF5KHhtbG9iai5OZXh0UGFydE51bWJlck1hcmtlcilbMF0gfHwgJydcbiAgfVxuICBpZiAoeG1sb2JqLlBhcnQpIHtcbiAgICB0b0FycmF5KHhtbG9iai5QYXJ0KS5mb3JFYWNoKChwKSA9PiB7XG4gICAgICBjb25zdCBwYXJ0ID0gcGFyc2VJbnQodG9BcnJheShwLlBhcnROdW1iZXIpWzBdLCAxMClcbiAgICAgIGNvbnN0IGxhc3RNb2RpZmllZCA9IG5ldyBEYXRlKHAuTGFzdE1vZGlmaWVkKVxuICAgICAgY29uc3QgZXRhZyA9IHAuRVRhZy5yZXBsYWNlKC9eXCIvZywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9cIiQvZywgJycpXG4gICAgICAgIC5yZXBsYWNlKC9eJnF1b3Q7L2csICcnKVxuICAgICAgICAucmVwbGFjZSgvJnF1b3Q7JC9nLCAnJylcbiAgICAgICAgLnJlcGxhY2UoL14mIzM0Oy9nLCAnJylcbiAgICAgICAgLnJlcGxhY2UoLyYjMzQ7JC9nLCAnJylcbiAgICAgIHJlc3VsdC5wYXJ0cy5wdXNoKHsgcGFydCwgbGFzdE1vZGlmaWVkLCBldGFnLCBzaXplOiBwYXJzZUludChwLlNpemUsIDEwKSB9KVxuICAgIH0pXG4gIH1cbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VMaXN0QnVja2V0KHhtbDogc3RyaW5nKSB7XG4gIGxldCByZXN1bHQ6IEJ1Y2tldEl0ZW1Gcm9tTGlzdFtdID0gW11cbiAgY29uc3QgcGFyc2VkWG1sUmVzID0gcGFyc2VYbWwoeG1sKVxuXG4gIGlmICghcGFyc2VkWG1sUmVzLkxpc3RBbGxNeUJ1Y2tldHNSZXN1bHQpIHtcbiAgICB0aHJvdyBuZXcgZXJyb3JzLkludmFsaWRYTUxFcnJvcignTWlzc2luZyB0YWc6IFwiTGlzdEFsbE15QnVja2V0c1Jlc3VsdFwiJylcbiAgfVxuICBjb25zdCB7IExpc3RBbGxNeUJ1Y2tldHNSZXN1bHQ6IHsgQnVja2V0cyA9IHt9IH0gPSB7fSB9ID0gcGFyc2VkWG1sUmVzXG5cbiAgaWYgKEJ1Y2tldHMuQnVja2V0KSB7XG4gICAgcmVzdWx0ID0gdG9BcnJheShCdWNrZXRzLkJ1Y2tldCkubWFwKChidWNrZXQgPSB7fSkgPT4ge1xuICAgICAgY29uc3QgeyBOYW1lOiBidWNrZXROYW1lLCBDcmVhdGlvbkRhdGUgfSA9IGJ1Y2tldFxuICAgICAgY29uc3QgY3JlYXRpb25EYXRlID0gbmV3IERhdGUoQ3JlYXRpb25EYXRlKVxuXG4gICAgICByZXR1cm4geyBuYW1lOiBidWNrZXROYW1lLCBjcmVhdGlvbkRhdGU6IGNyZWF0aW9uRGF0ZSB9XG4gICAgfSlcbiAgfVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUluaXRpYXRlTXVsdGlwYXJ0KHhtbDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcblxuICBpZiAoIXhtbG9iai5Jbml0aWF0ZU11bHRpcGFydFVwbG9hZFJlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJJbml0aWF0ZU11bHRpcGFydFVwbG9hZFJlc3VsdFwiJylcbiAgfVxuICB4bWxvYmogPSB4bWxvYmouSW5pdGlhdGVNdWx0aXBhcnRVcGxvYWRSZXN1bHRcblxuICBpZiAoeG1sb2JqLlVwbG9hZElkKSB7XG4gICAgcmV0dXJuIHhtbG9iai5VcGxvYWRJZFxuICB9XG4gIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJVcGxvYWRJZFwiJylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlUmVwbGljYXRpb25Db25maWcoeG1sOiBzdHJpbmcpOiBSZXBsaWNhdGlvbkNvbmZpZyB7XG4gIGNvbnN0IHhtbE9iaiA9IHBhcnNlWG1sKHhtbClcbiAgY29uc3QgeyBSb2xlLCBSdWxlIH0gPSB4bWxPYmouUmVwbGljYXRpb25Db25maWd1cmF0aW9uXG4gIHJldHVybiB7XG4gICAgUmVwbGljYXRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICByb2xlOiBSb2xlLFxuICAgICAgcnVsZXM6IHRvQXJyYXkoUnVsZSksXG4gICAgfSxcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VPYmplY3RMZWdhbEhvbGRDb25maWcoeG1sOiBzdHJpbmcpIHtcbiAgY29uc3QgeG1sT2JqID0gcGFyc2VYbWwoeG1sKVxuICByZXR1cm4geG1sT2JqLkxlZ2FsSG9sZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VUYWdnaW5nKHhtbDogc3RyaW5nKSB7XG4gIGNvbnN0IHhtbE9iaiA9IHBhcnNlWG1sKHhtbClcbiAgbGV0IHJlc3VsdCA9IFtdXG4gIGlmICh4bWxPYmouVGFnZ2luZyAmJiB4bWxPYmouVGFnZ2luZy5UYWdTZXQgJiYgeG1sT2JqLlRhZ2dpbmcuVGFnU2V0LlRhZykge1xuICAgIGNvbnN0IHRhZ1Jlc3VsdCA9IHhtbE9iai5UYWdnaW5nLlRhZ1NldC5UYWdcbiAgICAvLyBpZiBpdCBpcyBhIHNpbmdsZSB0YWcgY29udmVydCBpbnRvIGFuIGFycmF5IHNvIHRoYXQgdGhlIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgYW4gYXJyYXkuXG4gICAgaWYgKGlzT2JqZWN0KHRhZ1Jlc3VsdCkpIHtcbiAgICAgIHJlc3VsdC5wdXNoKHRhZ1Jlc3VsdClcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gdGFnUmVzdWx0XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuLy8gcGFyc2UgWE1MIHJlc3BvbnNlIHdoZW4gYSBtdWx0aXBhcnQgdXBsb2FkIGlzIGNvbXBsZXRlZFxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQ29tcGxldGVNdWx0aXBhcnQoeG1sOiBzdHJpbmcpIHtcbiAgY29uc3QgeG1sb2JqID0gcGFyc2VYbWwoeG1sKS5Db21wbGV0ZU11bHRpcGFydFVwbG9hZFJlc3VsdFxuICBpZiAoeG1sb2JqLkxvY2F0aW9uKSB7XG4gICAgY29uc3QgbG9jYXRpb24gPSB0b0FycmF5KHhtbG9iai5Mb2NhdGlvbilbMF1cbiAgICBjb25zdCBidWNrZXQgPSB0b0FycmF5KHhtbG9iai5CdWNrZXQpWzBdXG4gICAgY29uc3Qga2V5ID0geG1sb2JqLktleVxuICAgIGNvbnN0IGV0YWcgPSB4bWxvYmouRVRhZy5yZXBsYWNlKC9eXCIvZywgJycpXG4gICAgICAucmVwbGFjZSgvXCIkL2csICcnKVxuICAgICAgLnJlcGxhY2UoL14mcXVvdDsvZywgJycpXG4gICAgICAucmVwbGFjZSgvJnF1b3Q7JC9nLCAnJylcbiAgICAgIC5yZXBsYWNlKC9eJiMzNDsvZywgJycpXG4gICAgICAucmVwbGFjZSgvJiMzNDskL2csICcnKVxuXG4gICAgcmV0dXJuIHsgbG9jYXRpb24sIGJ1Y2tldCwga2V5LCBldGFnIH1cbiAgfVxuICAvLyBDb21wbGV0ZSBNdWx0aXBhcnQgY2FuIHJldHVybiBYTUwgRXJyb3IgYWZ0ZXIgYSAyMDAgT0sgcmVzcG9uc2VcbiAgaWYgKHhtbG9iai5Db2RlICYmIHhtbG9iai5NZXNzYWdlKSB7XG4gICAgY29uc3QgZXJyQ29kZSA9IHRvQXJyYXkoeG1sb2JqLkNvZGUpWzBdXG4gICAgY29uc3QgZXJyTWVzc2FnZSA9IHRvQXJyYXkoeG1sb2JqLk1lc3NhZ2UpWzBdXG4gICAgcmV0dXJuIHsgZXJyQ29kZSwgZXJyTWVzc2FnZSB9XG4gIH1cbn1cblxudHlwZSBVcGxvYWRJRCA9IHN0cmluZ1xuXG5leHBvcnQgdHlwZSBMaXN0TXVsdGlwYXJ0UmVzdWx0ID0ge1xuICB1cGxvYWRzOiB7XG4gICAga2V5OiBzdHJpbmdcbiAgICB1cGxvYWRJZDogVXBsb2FkSURcbiAgICBpbml0aWF0b3I6IHVua25vd25cbiAgICBvd25lcjogdW5rbm93blxuICAgIHN0b3JhZ2VDbGFzczogdW5rbm93blxuICAgIGluaXRpYXRlZDogRGF0ZVxuICB9W11cbiAgcHJlZml4ZXM6IHtcbiAgICBwcmVmaXg6IHN0cmluZ1xuICB9W11cbiAgaXNUcnVuY2F0ZWQ6IGJvb2xlYW5cbiAgbmV4dEtleU1hcmtlcjogc3RyaW5nXG4gIG5leHRVcGxvYWRJZE1hcmtlcjogc3RyaW5nXG59XG5cbi8vIHBhcnNlIFhNTCByZXNwb25zZSBmb3IgbGlzdGluZyBpbi1wcm9ncmVzcyBtdWx0aXBhcnQgdXBsb2Fkc1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGlzdE11bHRpcGFydCh4bWw6IHN0cmluZyk6IExpc3RNdWx0aXBhcnRSZXN1bHQge1xuICBjb25zdCByZXN1bHQ6IExpc3RNdWx0aXBhcnRSZXN1bHQgPSB7XG4gICAgcHJlZml4ZXM6IFtdLFxuICAgIHVwbG9hZHM6IFtdLFxuICAgIGlzVHJ1bmNhdGVkOiBmYWxzZSxcbiAgICBuZXh0S2V5TWFya2VyOiAnJyxcbiAgICBuZXh0VXBsb2FkSWRNYXJrZXI6ICcnLFxuICB9XG5cbiAgbGV0IHhtbG9iaiA9IHBhcnNlWG1sKHhtbClcblxuICBpZiAoIXhtbG9iai5MaXN0TXVsdGlwYXJ0VXBsb2Fkc1Jlc3VsdCkge1xuICAgIHRocm93IG5ldyBlcnJvcnMuSW52YWxpZFhNTEVycm9yKCdNaXNzaW5nIHRhZzogXCJMaXN0TXVsdGlwYXJ0VXBsb2Fkc1Jlc3VsdFwiJylcbiAgfVxuICB4bWxvYmogPSB4bWxvYmouTGlzdE11bHRpcGFydFVwbG9hZHNSZXN1bHRcbiAgaWYgKHhtbG9iai5Jc1RydW5jYXRlZCkge1xuICAgIHJlc3VsdC5pc1RydW5jYXRlZCA9IHhtbG9iai5Jc1RydW5jYXRlZFxuICB9XG4gIGlmICh4bWxvYmouTmV4dEtleU1hcmtlcikge1xuICAgIHJlc3VsdC5uZXh0S2V5TWFya2VyID0geG1sb2JqLk5leHRLZXlNYXJrZXJcbiAgfVxuICBpZiAoeG1sb2JqLk5leHRVcGxvYWRJZE1hcmtlcikge1xuICAgIHJlc3VsdC5uZXh0VXBsb2FkSWRNYXJrZXIgPSB4bWxvYmoubmV4dFVwbG9hZElkTWFya2VyIHx8ICcnXG4gIH1cblxuICBpZiAoeG1sb2JqLkNvbW1vblByZWZpeGVzKSB7XG4gICAgdG9BcnJheSh4bWxvYmouQ29tbW9uUHJlZml4ZXMpLmZvckVhY2goKHByZWZpeCkgPT4ge1xuICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvciBpbmRleCBjaGVja1xuICAgICAgcmVzdWx0LnByZWZpeGVzLnB1c2goeyBwcmVmaXg6IHNhbml0aXplT2JqZWN0S2V5KHRvQXJyYXk8c3RyaW5nPihwcmVmaXguUHJlZml4KVswXSkgfSlcbiAgICB9KVxuICB9XG5cbiAgaWYgKHhtbG9iai5VcGxvYWQpIHtcbiAgICB0b0FycmF5KHhtbG9iai5VcGxvYWQpLmZvckVhY2goKHVwbG9hZCkgPT4ge1xuICAgICAgY29uc3Qga2V5ID0gdXBsb2FkLktleVxuICAgICAgY29uc3QgdXBsb2FkSWQgPSB1cGxvYWQuVXBsb2FkSWRcbiAgICAgIGNvbnN0IGluaXRpYXRvciA9IHsgaWQ6IHVwbG9hZC5Jbml0aWF0b3IuSUQsIGRpc3BsYXlOYW1lOiB1cGxvYWQuSW5pdGlhdG9yLkRpc3BsYXlOYW1lIH1cbiAgICAgIGNvbnN0IG93bmVyID0geyBpZDogdXBsb2FkLk93bmVyLklELCBkaXNwbGF5TmFtZTogdXBsb2FkLk93bmVyLkRpc3BsYXlOYW1lIH1cbiAgICAgIGNvbnN0IHN0b3JhZ2VDbGFzcyA9IHVwbG9hZC5TdG9yYWdlQ2xhc3NcbiAgICAgIGNvbnN0IGluaXRpYXRlZCA9IG5ldyBEYXRlKHVwbG9hZC5Jbml0aWF0ZWQpXG4gICAgICByZXN1bHQudXBsb2Fkcy5wdXNoKHsga2V5LCB1cGxvYWRJZCwgaW5pdGlhdG9yLCBvd25lciwgc3RvcmFnZUNsYXNzLCBpbml0aWF0ZWQgfSlcbiAgICB9KVxuICB9XG4gIHJldHVybiByZXN1bHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlT2JqZWN0TG9ja0NvbmZpZyh4bWw6IHN0cmluZyk6IE9iamVjdExvY2tJbmZvIHtcbiAgY29uc3QgeG1sT2JqID0gcGFyc2VYbWwoeG1sKVxuICBsZXQgbG9ja0NvbmZpZ1Jlc3VsdCA9IHt9IGFzIE9iamVjdExvY2tJbmZvXG4gIGlmICh4bWxPYmouT2JqZWN0TG9ja0NvbmZpZ3VyYXRpb24pIHtcbiAgICBsb2NrQ29uZmlnUmVzdWx0ID0ge1xuICAgICAgb2JqZWN0TG9ja0VuYWJsZWQ6IHhtbE9iai5PYmplY3RMb2NrQ29uZmlndXJhdGlvbi5PYmplY3RMb2NrRW5hYmxlZCxcbiAgICB9IGFzIE9iamVjdExvY2tJbmZvXG4gICAgbGV0IHJldGVudGlvblJlc3BcbiAgICBpZiAoXG4gICAgICB4bWxPYmouT2JqZWN0TG9ja0NvbmZpZ3VyYXRpb24gJiZcbiAgICAgIHhtbE9iai5PYmplY3RMb2NrQ29uZmlndXJhdGlvbi5SdWxlICYmXG4gICAgICB4bWxPYmouT2JqZWN0TG9ja0NvbmZpZ3VyYXRpb24uUnVsZS5EZWZhdWx0UmV0ZW50aW9uXG4gICAgKSB7XG4gICAgICByZXRlbnRpb25SZXNwID0geG1sT2JqLk9iamVjdExvY2tDb25maWd1cmF0aW9uLlJ1bGUuRGVmYXVsdFJldGVudGlvbiB8fCB7fVxuICAgICAgbG9ja0NvbmZpZ1Jlc3VsdC5tb2RlID0gcmV0ZW50aW9uUmVzcC5Nb2RlXG4gICAgfVxuICAgIGlmIChyZXRlbnRpb25SZXNwKSB7XG4gICAgICBjb25zdCBpc1VuaXRZZWFycyA9IHJldGVudGlvblJlc3AuWWVhcnNcbiAgICAgIGlmIChpc1VuaXRZZWFycykge1xuICAgICAgICBsb2NrQ29uZmlnUmVzdWx0LnZhbGlkaXR5ID0gaXNVbml0WWVhcnNcbiAgICAgICAgbG9ja0NvbmZpZ1Jlc3VsdC51bml0ID0gUkVURU5USU9OX1ZBTElESVRZX1VOSVRTLllFQVJTXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2NrQ29uZmlnUmVzdWx0LnZhbGlkaXR5ID0gcmV0ZW50aW9uUmVzcC5EYXlzXG4gICAgICAgIGxvY2tDb25maWdSZXN1bHQudW5pdCA9IFJFVEVOVElPTl9WQUxJRElUWV9VTklUUy5EQVlTXG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxvY2tDb25maWdSZXN1bHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQnVja2V0VmVyc2lvbmluZ0NvbmZpZyh4bWw6IHN0cmluZykge1xuICBjb25zdCB4bWxPYmogPSBwYXJzZVhtbCh4bWwpXG4gIHJldHVybiB4bWxPYmouVmVyc2lvbmluZ0NvbmZpZ3VyYXRpb25cbn1cblxuLy8gVXNlZCBvbmx5IGluIHNlbGVjdE9iamVjdENvbnRlbnQgQVBJLlxuLy8gZXh0cmFjdEhlYWRlclR5cGUgZXh0cmFjdHMgdGhlIGZpcnN0IGhhbGYgb2YgdGhlIGhlYWRlciBtZXNzYWdlLCB0aGUgaGVhZGVyIHR5cGUuXG5mdW5jdGlvbiBleHRyYWN0SGVhZGVyVHlwZShzdHJlYW06IHN0cmVhbS5SZWFkYWJsZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IGhlYWRlck5hbWVMZW4gPSBCdWZmZXIuZnJvbShzdHJlYW0ucmVhZCgxKSkucmVhZFVJbnQ4KClcbiAgY29uc3QgaGVhZGVyTmFtZVdpdGhTZXBhcmF0b3IgPSBCdWZmZXIuZnJvbShzdHJlYW0ucmVhZChoZWFkZXJOYW1lTGVuKSkudG9TdHJpbmcoKVxuICBjb25zdCBzcGxpdEJ5U2VwYXJhdG9yID0gKGhlYWRlck5hbWVXaXRoU2VwYXJhdG9yIHx8ICcnKS5zcGxpdCgnOicpXG4gIHJldHVybiBzcGxpdEJ5U2VwYXJhdG9yLmxlbmd0aCA+PSAxID8gc3BsaXRCeVNlcGFyYXRvclsxXSA6ICcnXG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RIZWFkZXJWYWx1ZShzdHJlYW06IHN0cmVhbS5SZWFkYWJsZSkge1xuICBjb25zdCBib2R5TGVuID0gQnVmZmVyLmZyb20oc3RyZWFtLnJlYWQoMikpLnJlYWRVSW50MTZCRSgpXG4gIHJldHVybiBCdWZmZXIuZnJvbShzdHJlYW0ucmVhZChib2R5TGVuKSkudG9TdHJpbmcoKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTZWxlY3RPYmplY3RDb250ZW50UmVzcG9uc2UocmVzOiBCdWZmZXIpIHtcbiAgY29uc3Qgc2VsZWN0UmVzdWx0cyA9IG5ldyBTZWxlY3RSZXN1bHRzKHt9KSAvLyB3aWxsIGJlIHJldHVybmVkXG5cbiAgY29uc3QgcmVzcG9uc2VTdHJlYW0gPSByZWFkYWJsZVN0cmVhbShyZXMpIC8vIGNvbnZlcnQgYnl0ZSBhcnJheSB0byBhIHJlYWRhYmxlIHJlc3BvbnNlU3RyZWFtXG4gIC8vIEB0cy1pZ25vcmVcbiAgd2hpbGUgKHJlc3BvbnNlU3RyZWFtLl9yZWFkYWJsZVN0YXRlLmxlbmd0aCkge1xuICAgIC8vIFRvcCBsZXZlbCByZXNwb25zZVN0cmVhbSByZWFkIHRyYWNrZXIuXG4gICAgbGV0IG1zZ0NyY0FjY3VtdWxhdG9yIC8vIGFjY3VtdWxhdGUgZnJvbSBzdGFydCBvZiB0aGUgbWVzc2FnZSB0aWxsIHRoZSBtZXNzYWdlIGNyYyBzdGFydC5cblxuICAgIGNvbnN0IHRvdGFsQnl0ZUxlbmd0aEJ1ZmZlciA9IEJ1ZmZlci5mcm9tKHJlc3BvbnNlU3RyZWFtLnJlYWQoNCkpXG4gICAgbXNnQ3JjQWNjdW11bGF0b3IgPSBjcmMzMih0b3RhbEJ5dGVMZW5ndGhCdWZmZXIpXG5cbiAgICBjb25zdCBoZWFkZXJCeXRlc0J1ZmZlciA9IEJ1ZmZlci5mcm9tKHJlc3BvbnNlU3RyZWFtLnJlYWQoNCkpXG4gICAgbXNnQ3JjQWNjdW11bGF0b3IgPSBjcmMzMihoZWFkZXJCeXRlc0J1ZmZlciwgbXNnQ3JjQWNjdW11bGF0b3IpXG5cbiAgICBjb25zdCBjYWxjdWxhdGVkUHJlbHVkZUNyYyA9IG1zZ0NyY0FjY3VtdWxhdG9yLnJlYWRJbnQzMkJFKCkgLy8gdXNlIGl0IHRvIGNoZWNrIGlmIGFueSBDUkMgbWlzbWF0Y2ggaW4gaGVhZGVyIGl0c2VsZi5cblxuICAgIGNvbnN0IHByZWx1ZGVDcmNCdWZmZXIgPSBCdWZmZXIuZnJvbShyZXNwb25zZVN0cmVhbS5yZWFkKDQpKSAvLyByZWFkIDQgYnl0ZXMgICAgaS5lIDQrNCA9OCArIDQgPSAxMiAoIHByZWx1ZGUgKyBwcmVsdWRlIGNyYylcbiAgICBtc2dDcmNBY2N1bXVsYXRvciA9IGNyYzMyKHByZWx1ZGVDcmNCdWZmZXIsIG1zZ0NyY0FjY3VtdWxhdG9yKVxuXG4gICAgY29uc3QgdG90YWxNc2dMZW5ndGggPSB0b3RhbEJ5dGVMZW5ndGhCdWZmZXIucmVhZEludDMyQkUoKVxuICAgIGNvbnN0IGhlYWRlckxlbmd0aCA9IGhlYWRlckJ5dGVzQnVmZmVyLnJlYWRJbnQzMkJFKClcbiAgICBjb25zdCBwcmVsdWRlQ3JjQnl0ZVZhbHVlID0gcHJlbHVkZUNyY0J1ZmZlci5yZWFkSW50MzJCRSgpXG5cbiAgICBpZiAocHJlbHVkZUNyY0J5dGVWYWx1ZSAhPT0gY2FsY3VsYXRlZFByZWx1ZGVDcmMpIHtcbiAgICAgIC8vIEhhbmRsZSBIZWFkZXIgQ1JDIG1pc21hdGNoIEVycm9yXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBIZWFkZXIgQ2hlY2tzdW0gTWlzbWF0Y2gsIFByZWx1ZGUgQ1JDIG9mICR7cHJlbHVkZUNyY0J5dGVWYWx1ZX0gZG9lcyBub3QgZXF1YWwgZXhwZWN0ZWQgQ1JDIG9mICR7Y2FsY3VsYXRlZFByZWx1ZGVDcmN9YCxcbiAgICAgIClcbiAgICB9XG5cbiAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9XG4gICAgaWYgKGhlYWRlckxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGhlYWRlckJ5dGVzID0gQnVmZmVyLmZyb20ocmVzcG9uc2VTdHJlYW0ucmVhZChoZWFkZXJMZW5ndGgpKVxuICAgICAgbXNnQ3JjQWNjdW11bGF0b3IgPSBjcmMzMihoZWFkZXJCeXRlcywgbXNnQ3JjQWNjdW11bGF0b3IpXG4gICAgICBjb25zdCBoZWFkZXJSZWFkZXJTdHJlYW0gPSByZWFkYWJsZVN0cmVhbShoZWFkZXJCeXRlcylcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIHdoaWxlIChoZWFkZXJSZWFkZXJTdHJlYW0uX3JlYWRhYmxlU3RhdGUubGVuZ3RoKSB7XG4gICAgICAgIGNvbnN0IGhlYWRlclR5cGVOYW1lID0gZXh0cmFjdEhlYWRlclR5cGUoaGVhZGVyUmVhZGVyU3RyZWFtKVxuICAgICAgICBoZWFkZXJSZWFkZXJTdHJlYW0ucmVhZCgxKSAvLyBqdXN0IHJlYWQgYW5kIGlnbm9yZSBpdC5cbiAgICAgICAgaWYgKGhlYWRlclR5cGVOYW1lKSB7XG4gICAgICAgICAgaGVhZGVyc1toZWFkZXJUeXBlTmFtZV0gPSBleHRyYWN0SGVhZGVyVmFsdWUoaGVhZGVyUmVhZGVyU3RyZWFtKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IHBheWxvYWRTdHJlYW1cbiAgICBjb25zdCBwYXlMb2FkTGVuZ3RoID0gdG90YWxNc2dMZW5ndGggLSBoZWFkZXJMZW5ndGggLSAxNlxuICAgIGlmIChwYXlMb2FkTGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgcGF5TG9hZEJ1ZmZlciA9IEJ1ZmZlci5mcm9tKHJlc3BvbnNlU3RyZWFtLnJlYWQocGF5TG9hZExlbmd0aCkpXG4gICAgICBtc2dDcmNBY2N1bXVsYXRvciA9IGNyYzMyKHBheUxvYWRCdWZmZXIsIG1zZ0NyY0FjY3VtdWxhdG9yKVxuICAgICAgLy8gcmVhZCB0aGUgY2hlY2tzdW0gZWFybHkgYW5kIGRldGVjdCBhbnkgbWlzbWF0Y2ggc28gd2UgY2FuIGF2b2lkIHVubmVjZXNzYXJ5IGZ1cnRoZXIgcHJvY2Vzc2luZy5cbiAgICAgIGNvbnN0IG1lc3NhZ2VDcmNCeXRlVmFsdWUgPSBCdWZmZXIuZnJvbShyZXNwb25zZVN0cmVhbS5yZWFkKDQpKS5yZWFkSW50MzJCRSgpXG4gICAgICBjb25zdCBjYWxjdWxhdGVkQ3JjID0gbXNnQ3JjQWNjdW11bGF0b3IucmVhZEludDMyQkUoKVxuICAgICAgLy8gSGFuZGxlIG1lc3NhZ2UgQ1JDIEVycm9yXG4gICAgICBpZiAobWVzc2FnZUNyY0J5dGVWYWx1ZSAhPT0gY2FsY3VsYXRlZENyYykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYE1lc3NhZ2UgQ2hlY2tzdW0gTWlzbWF0Y2gsIE1lc3NhZ2UgQ1JDIG9mICR7bWVzc2FnZUNyY0J5dGVWYWx1ZX0gZG9lcyBub3QgZXF1YWwgZXhwZWN0ZWQgQ1JDIG9mICR7Y2FsY3VsYXRlZENyY31gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBwYXlsb2FkU3RyZWFtID0gcmVhZGFibGVTdHJlYW0ocGF5TG9hZEJ1ZmZlcilcbiAgICB9XG4gICAgY29uc3QgbWVzc2FnZVR5cGUgPSBoZWFkZXJzWydtZXNzYWdlLXR5cGUnXVxuXG4gICAgc3dpdGNoIChtZXNzYWdlVHlwZSkge1xuICAgICAgY2FzZSAnZXJyb3InOiB7XG4gICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGhlYWRlcnNbJ2Vycm9yLWNvZGUnXSArICc6XCInICsgaGVhZGVyc1snZXJyb3ItbWVzc2FnZSddICsgJ1wiJ1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyb3JNZXNzYWdlKVxuICAgICAgfVxuICAgICAgY2FzZSAnZXZlbnQnOiB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gaGVhZGVyc1snY29udGVudC10eXBlJ11cbiAgICAgICAgY29uc3QgZXZlbnRUeXBlID0gaGVhZGVyc1snZXZlbnQtdHlwZSddXG5cbiAgICAgICAgc3dpdGNoIChldmVudFR5cGUpIHtcbiAgICAgICAgICBjYXNlICdFbmQnOiB7XG4gICAgICAgICAgICBzZWxlY3RSZXN1bHRzLnNldFJlc3BvbnNlKHJlcylcbiAgICAgICAgICAgIHJldHVybiBzZWxlY3RSZXN1bHRzXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY2FzZSAnUmVjb3Jkcyc6IHtcbiAgICAgICAgICAgIGNvbnN0IHJlYWREYXRhID0gcGF5bG9hZFN0cmVhbT8ucmVhZChwYXlMb2FkTGVuZ3RoKVxuICAgICAgICAgICAgc2VsZWN0UmVzdWx0cy5zZXRSZWNvcmRzKHJlYWREYXRhKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjYXNlICdQcm9ncmVzcyc6XG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN3aXRjaCAoY29udGVudFR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICd0ZXh0L3htbCc6IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHByb2dyZXNzRGF0YSA9IHBheWxvYWRTdHJlYW0/LnJlYWQocGF5TG9hZExlbmd0aClcbiAgICAgICAgICAgICAgICAgIHNlbGVjdFJlc3VsdHMuc2V0UHJvZ3Jlc3MocHJvZ3Jlc3NEYXRhLnRvU3RyaW5nKCkpXG4gICAgICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBlcnJvck1lc3NhZ2UgPSBgVW5leHBlY3RlZCBjb250ZW50LXR5cGUgJHtjb250ZW50VHlwZX0gc2VudCBmb3IgZXZlbnQtdHlwZSBQcm9ncmVzc2BcbiAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihlcnJvck1lc3NhZ2UpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ1N0YXRzJzpcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3dpdGNoIChjb250ZW50VHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgJ3RleHQveG1sJzoge1xuICAgICAgICAgICAgICAgICAgY29uc3Qgc3RhdHNEYXRhID0gcGF5bG9hZFN0cmVhbT8ucmVhZChwYXlMb2FkTGVuZ3RoKVxuICAgICAgICAgICAgICAgICAgc2VsZWN0UmVzdWx0cy5zZXRTdGF0cyhzdGF0c0RhdGEudG9TdHJpbmcoKSlcbiAgICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yTWVzc2FnZSA9IGBVbmV4cGVjdGVkIGNvbnRlbnQtdHlwZSAke2NvbnRlbnRUeXBlfSBzZW50IGZvciBldmVudC10eXBlIFN0YXRzYFxuICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGVycm9yTWVzc2FnZSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgZGVmYXVsdDoge1xuICAgICAgICAgICAgLy8gQ29udGludWF0aW9uIG1lc3NhZ2U6IE5vdCBzdXJlIGlmIGl0IGlzIHN1cHBvcnRlZC4gZGlkIG5vdCBmaW5kIGEgcmVmZXJlbmNlIG9yIGFueSBtZXNzYWdlIGluIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSXQgZG9lcyBub3QgaGF2ZSBhIHBheWxvYWQuXG4gICAgICAgICAgICBjb25zdCB3YXJuaW5nTWVzc2FnZSA9IGBVbiBpbXBsZW1lbnRlZCBldmVudCBkZXRlY3RlZCAgJHttZXNzYWdlVHlwZX0uYFxuICAgICAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWNvbnNvbGVcbiAgICAgICAgICAgIGNvbnNvbGUud2Fybih3YXJuaW5nTWVzc2FnZSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTGlmZWN5Y2xlQ29uZmlnKHhtbDogc3RyaW5nKSB7XG4gIGNvbnN0IHhtbE9iaiA9IHBhcnNlWG1sKHhtbClcbiAgcmV0dXJuIHhtbE9iai5MaWZlY3ljbGVDb25maWd1cmF0aW9uXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJ1Y2tldEVuY3J5cHRpb25Db25maWcoeG1sOiBzdHJpbmcpIHtcbiAgcmV0dXJuIHBhcnNlWG1sKHhtbClcbn1cbiJdLCJtYXBwaW5ncyI6IkFBR0EsT0FBT0EsS0FBSyxNQUFNLGNBQWM7QUFDaEMsU0FBU0MsU0FBUyxRQUFRLGlCQUFpQjtBQUUzQyxPQUFPLEtBQUtDLE1BQU0sTUFBTSxlQUFjO0FBQ3RDLFNBQVNDLGFBQWEsUUFBUSxnQkFBZTtBQUM3QyxTQUFTQyxRQUFRLEVBQUVDLFFBQVEsRUFBRUMsY0FBYyxFQUFFQyxZQUFZLEVBQUVDLGlCQUFpQixFQUFFQyxPQUFPLFFBQVEsY0FBYTtBQUMxRyxTQUFTQyxZQUFZ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