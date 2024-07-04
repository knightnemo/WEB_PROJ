/// <reference types="node" />
/// <reference types="node" />
import type * as http from 'node:http';
import { SelectResults } from "../helpers.js";
import type { BucketItemFromList, BucketItemWithMetadata, ObjectLockInfo, ReplicationConfig } from "./type.js";
export declare function parseBucketRegion(xml: string): string;
export declare function parseError(xml: string, headerInfo: Record<string, unknown>): Record<string, unknown>;
export declare function parseResponseError(response: http.IncomingMessage): Promise<void>;
/**
 * parse XML response for list objects v2 with metadata in a bucket
 */
export declare function parseListObjectsV2WithMetadata(xml: string): {
  objects: Array<BucketItemWithMetadata>;
  isTruncated: boolean;
  nextContinuationToken: string;
};
export type Multipart = {
  uploads: Array<{
    key: string;
    uploadId: string;
    initiator: unknown;
    owner: unknown;
    storageClass: unknown;
    initiated: unknown;
  }>;
  prefixes: {
    prefix: string;
  }[];
  isTruncated: boolean;
  nextKeyMarker: undefined;
  nextUploadIdMarker: undefined;
};
export type UploadedPart = {
  part: number;
  lastModified?: Date;
  etag: string;
  size: number;
};
export declare function parseListParts(xml: string): {
  isTruncated: boolean;
  marker: number;
  parts: UploadedPart[];
};
export declare function parseListBucket(xml: string): BucketItemFromList[];
export declare function parseInitiateMultipart(xml: string): string;
export declare function parseReplicationConfig(xml: string): ReplicationConfig;
export declare function parseObjectLegalHoldConfig(xml: string): any;
export declare function parseTagging(xml: string): any;
export declare function parseCompleteMultipart(xml: string): {
  location: any;
  bucket: any;
  key: any;
  etag: any;
  errCode?: undefined;
  errMessage?: undefined;
} | {
  errCode: any;
  errMessage: any;
  location?: undefined;
  bucket?: undefined;
  key?: undefined;
  etag?: undefined;
} | undefined;
type UploadID = string;
export type ListMultipartResult = {
  uploads: {
    key: string;
    uploadId: UploadID;
    initiator: unknown;
    owner: unknown;
    storageClass: unknown;
    initiated: Date;
  }[];
  prefixes: {
    prefix: string;
  }[];
  isTruncated: boolean;
  nextKeyMarker: string;
  nextUploadIdMarker: string;
};
export declare function parseListMultipart(xml: string): ListMultipartResult;
export declare function parseObjectLockConfig(xml: string): ObjectLockInfo;
export declare function parseBucketVersioningConfig(xml: string): any;
export declare function parseSelectObjectContentResponse(res: Buffer): SelectResults | undefined;
export declare function parseLifecycleConfig(xml: string): any;
export declare function parseBucketEncryptionConfig(xml: string): any;
export {};