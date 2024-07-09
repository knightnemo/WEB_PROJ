package Process

import Common.API.{API, PlanContext, TraceID}
import Global.{ServerConfig, ServiceCenter}
import Common.DBAPI.{initSchema, writeDB}
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.generic.auto.*
import org.http4s.client.Client

import java.util.UUID

object Init {
  def init(config: ServerConfig): IO[Unit] =
    given PlanContext = PlanContext(traceID = TraceID(UUID.randomUUID().toString), 0)
    for {
      _ <- API.init(config.maximumClientConnection)
      _ <- initSchema(schemaName)
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.files (
          id SERIAL PRIMARY KEY,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_size BIGINT NOT NULL,
          file_type TEXT NOT NULL,
          upload_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_modified TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          review_status TEXT NOT NULL DEFAULT 'pending',
          uploaded_by TEXT,
          metadata JSONB
        )
      """, List())
      _ <- writeDB(s"""
        CREATE INDEX IF NOT EXISTS idx_files_review_status ON ${schemaName}.files(review_status);
        CREATE INDEX IF NOT EXISTS idx_files_upload_date ON ${schemaName}.files(upload_date);
      """, List())
      // Add new columns if they don't exist
      _ <- writeDB(s"""
        ALTER TABLE ${schemaName}.files
        ADD COLUMN IF NOT EXISTS last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE ${schemaName}.files
        ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
        ALTER TABLE ${schemaName}.files
        ADD COLUMN IF NOT EXISTS metadata JSONB;
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add new columns. They may already exist. Error: ${e.getMessage}"))
      }
    } yield ()
}