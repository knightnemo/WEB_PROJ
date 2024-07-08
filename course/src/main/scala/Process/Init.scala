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
      _ <- writeDB(s"CREATE TABLE IF NOT EXISTS ${schemaName}.user_name (user_name TEXT, password TEXT)", List())
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.courses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          instructor TEXT NOT NULL,
          description TEXT,
          rating REAL DEFAULT 0,
          image_url TEXT,
          resource_url TEXT,
          created_at TIMESTAMP NOT NULL,
          updated_at TIMESTAMP NOT NULL,
          duration_minutes INTEGER,
          difficulty_level TEXT,
          category TEXT,
          subcategory TEXT,
          language TEXT,
          prerequisites TEXT,
          learning_objectives TEXT
        )
      """, List())
      // Add new columns if they don't exist
      _ <- writeDB(s"""
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS difficulty_level TEXT;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS category TEXT;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS subcategory TEXT;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS language TEXT;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS prerequisites TEXT;
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS learning_objectives TEXT;
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add new columns. They may already exist. Error: ${e.getMessage}"))
      }
    } yield ()
}