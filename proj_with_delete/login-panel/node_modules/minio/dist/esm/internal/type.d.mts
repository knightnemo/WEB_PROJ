/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import type * as http from 'node:http';
import type { Readable as ReadableStream } from 'node:stream';
export type VersionIdentificator = {
  versionId?: string;
};
export type Binary = string | Buffer;
export type ResponseHeader = Record<string, string>;
export type ObjectMetaData = Record<string, string | number>;
export type RequestHeaders = Record<string, string | boolean | number | undefined>;
export type Encryption = {
  type: ENCRYPTION_TYPES.SSEC;
} | {
  type: ENCRYPTION_TYPES.KMS;
  SSEAlgorithm?: string;
  KMSMasterKeyID?: string;
};
export type EnabledOrDisabledStatus = 'Enabled' | 'Disabled';
export declare enum ENCRYPTION_TYPES {
  /**
   * SSEC represents server-side-encryption with customer provided keys
   */
  SSEC = "SSE-C",
  /**
   * KMS represents server-side-encryption with managed keys
   */
  KMS = "KMS",
}
export declare enum RETENTION_MODES {
  GOVERNANCE = "GOVERNANCE",
  COMPLIANCE = "COMPLIANCE",
}
export declare enum RETENTION_VALIDITY_UNITS {
  DAYS = "Days",
  YEARS = "Years",
}
export declare enum LEGAL_HOLD_STATUS {
  ENABLED = "ON",
  DISABLED = "OFF",
}
export type Transport = Pick<typeof http, 'request'>;
export interface IRequest {
  protocol: string;
  port?: number | string;
  method: string;
  path: string;
  headers: RequestHeaders;
}
export type ICanonicalRequest = string;
export interface IncompleteUploadedBucketItem {
  key: string;
  uploadId: string;
  size: number;
}
export interface MetadataItem {
  Key: string;
  Value: string;
}
export interface ItemBucketMetadataList {
  Items: MetadataItem[];
}
export interface ItemBucketMetadata {
  [key: string]: any;
}
export interface BucketItemFromList {
  name: string;
  creationDate: Date;
}
export interface BucketItemCopy {
  etag: string;
  lastModified: Date;
}
export type BucketItem = {
  name: string;
  size: number;
  etag: string;
  prefix?: never;
  lastModified: Date;
} | {
  name?: never;
  etag?: never;
  lastModified?: never;
  prefix: string;
  size: 0;
};
export type BucketItemWithMetadata = BucketItem & {
  metadata?: ItemBucketMetadata | ItemBucketMetadataList;
};
export interface BucketStream<T> extends ReadableStream {
  on(event: 'data', listener: (item: T) => void): this;
  on(event: 'end' | 'pause' | 'readable' | 'resume' | 'close', listener: () => void): this;
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}
export interface BucketItemStat {
  size: number;
  etag: string;
  lastModified: Date;
  metaData: ItemBucketMetadata;
  versionId?: string | null;
}
export type StatObjectOpts = {
  versionId?: string;
};
export type ReplicationRuleStatus = {
  Status: EnabledOrDisabledStatus;
};
export type Tag = {
  Key: string;
  Value: string;
};
export type Tags = Record<string, string>;
export type ReplicationRuleDestination = {
  Bucket: string;
  StorageClass: string;
};
export type ReplicationRuleAnd = {
  Prefix: string;
  Tags: Tag[];
};
export type ReplicationRuleFilter = {
  Prefix: string;
  And: ReplicationRuleAnd;
  Tag: Tag;
};
export type ReplicaModifications = {
  Status: ReplicationRuleStatus;
};
export type SourceSelectionCriteria = {
  ReplicaModifications: ReplicaModifications;
};
export type ExistingObjectReplication = {
  Status: ReplicationRuleStatus;
};
export type ReplicationRule = {
  ID: string;
  Status: ReplicationRuleStatus;
  Priority: number;
  DeleteMarkerReplication: ReplicationRuleStatus;
  DeleteReplication: ReplicationRuleStatus;
  Destination: ReplicationRuleDestination;
  Filter: ReplicationRuleFilter;
  SourceSelectionCriteria: SourceSelectionCriteria;
  ExistingObjectReplication: ExistingObjectReplication;
};
export type ReplicationConfigOpts = {
  role: string;
  rules: ReplicationRule[];
};
export type ReplicationConfig = {
  ReplicationConfiguration: ReplicationConfigOpts;
};
export type ResultCallback<T> = (error: Error | null, result: T) => void;
export type GetObjectLegalHoldOptions = {
  versionId: string;
};
/**
 * @deprecated keep for backward compatible, use `LEGAL_HOLD_STATUS` instead
 */
export type LegalHoldStatus = LEGAL_HOLD_STATUS;
export type PutObjectLegalHoldOptions = {
  versionId?: string;
  status: LEGAL_HOLD_STATUS;
};
export interface UploadedObjectInfo {
  etag: string;
  versionId: string | null;
}
export interface RetentionOptions {
  versionId: string;
  mode?: RETENTION_MODES;
  retainUntilDate?: IsoDate;
  governanceBypass?: boolean;
}
export type Retention = RetentionOptions | EmptyObject;
export type IsoDate = string;
export type EmptyObject = Record<string, never>;
export type ObjectLockInfo = {
  objectLockEnabled: EnabledOrDisabledStatus;
  mode: RETENTION_MODES;
  unit: RETENTION_VALIDITY_UNITS;
  validity: number;
} | EmptyObject;
export type ObjectLockConfigParam = {
  ObjectLockEnabled?: 'Enabled' | undefined;
  Rule?: {
    DefaultRetention: {
      Mode: RETENTION_MODES;
      Days: number;
      Years: number;
    } | EmptyObject;
  } | EmptyObject;
};
export type VersioningEnabled = 'Enabled';
export type VersioningSuspended = 'Suspended';
export type BucketVersioningConfiguration = {
  Status: VersioningEnabled | VersioningSuspended;
};
export type TaggingOpts = {
  versionId: string;
};
export type PutTaggingParams = {
  bucketName: string;
  objectName?: string;
  tags: Tags;
  putOpts?: TaggingOpts;
};
export type RemoveTaggingParams = {
  bucketName: string;
  objectName?: string;
  removeOpts?: TaggingOpts;
};
export type InputSerialization = {
  CompressionType?: 'NONE' | 'GZIP' | 'BZIP2';
  CSV?: {
    AllowQuotedRecordDelimiter?: boolean;
    Comments?: string;
    FieldDelimiter?: string;
    FileHeaderInfo?: 'NONE' | 'IGNORE' | 'USE';
    QuoteCharacter?: string;
    QuoteEscapeCharacter?: string;
    RecordDelimiter?: string;
  };
  JSON?: {
    Type: 'DOCUMENT' | 'LINES';
  };
  Parquet?: EmptyObject;
};
export type OutputSerialization = {
  CSV?: {
    FieldDelimiter?: string;
    QuoteCharacter?: string;
    QuoteEscapeCharacter?: string;
    QuoteFields?: string;
    RecordDelimiter?: string;
  };
  JSON?: {
    RecordDelimiter?: string;
  };
};
export type SelectProgress = {
  Enabled: boolean;
};
export type ScanRange = {
  Start: number;
  End: number;
};
export type SelectOptions = {
  expression: string;
  expressionType?: string;
  inputSerialization: InputSerialization;
  outputSerialization: OutputSerialization;
  requestProgress?: SelectProgress;
  scanRange?: ScanRange;
};
export type Expiration = {
  Date: string;
  Days: number;
  DeleteMarker: boolean;
  DeleteAll: boolean;
};
export type RuleFilterAnd = {
  Prefix: string;
  Tags: Tag[];
};
export type RuleFilter = {
  And?: RuleFilterAnd;
  Prefix: string;
  Tag?: Tag[];
};
export type NoncurrentVersionExpiration = {
  NoncurrentDays: number;
  NewerNoncurrentVersions?: number;
};
export type NoncurrentVersionTransition = {
  StorageClass: string;
  NoncurrentDays?: number;
  NewerNoncurrentVersions?: number;
};
export type Transition = {
  Date?: string;
  StorageClass: string;
  Days: number;
};
export type AbortIncompleteMultipartUpload = {
  DaysAfterInitiation: number;
};
export type LifecycleRule = {
  AbortIncompleteMultipartUpload?: AbortIncompleteMultipartUpload;
  ID: string;
  Prefix?: string;
  Status?: string;
  Expiration?: Expiration;
  RuleFilter?: RuleFilter;
  NoncurrentVersionExpiration?: NoncurrentVersionExpiration;
  NoncurrentVersionTransition?: NoncurrentVersionTransition;
  Transition?: Transition;
};
export type LifecycleConfig = {
  Rule: LifecycleRule[];
};
export type LifeCycleConfigParam = LifecycleConfig | null | undefined | '';
export type ApplySSEByDefault = {
  KmsMasterKeyID?: string;
  SSEAlgorithm: string;
};
export type EncryptionRule = {
  ApplyServerSideEncryptionByDefault?: ApplySSEByDefault;
};
export type EncryptionConfig = {
  Rule: EncryptionRule[];
};