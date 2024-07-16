package Process

import Common.API.{API, PlanContext, TraceID}
import Global.{ServerConfig, ServiceCenter}
import Common.DBAPI.{initSchema, writeDB}
import Common.ServiceUtils.schemaName
import cats.effect.IO
import io.circe.generic.auto._
import org.http4s.client.Client

import java.util.UUID

object Init {
  def init(config: ServerConfig): IO[Unit] =
    given PlanContext = PlanContext(traceID = TraceID(UUID.randomUUID().toString), 0)
    for {
      _ <- API.init(config.maximumClientConnection)
      _ <- initSchema(schemaName)

      // Create comments table
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.comments (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          rating INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          upvotes INTEGER DEFAULT 0,
          downvotes INTEGER DEFAULT 0
        )
      """, List())

      // Note: We assume that courses and user_name tables are created in their respective services.
      // If you need to create these tables here as well, uncomment and modify the following code:

      /*
      // Create courses table (if needed)
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.courses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL
          // Add other necessary fields
        )
      """, List())

      // Create user_name table (if needed)
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.user_name (
          user_name TEXT PRIMARY KEY,
          // Add other necessary fields
        )
      """, List())
      */

      // Add foreign key constraints to comments table
      _ <- writeDB(s"""
        ALTER TABLE ${schemaName}.comments
        ADD CONSTRAINT fk_course
        FOREIGN KEY (course_id)
        REFERENCES ${schemaName}.courses(id);
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add foreign key constraint fk_course to comments table. It may already exist. Error: ${e.getMessage}"))
      }

      _ <- writeDB(s"""
        ALTER TABLE ${schemaName}.comments
        ADD CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES ${schemaName}.user_name(user_name);
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add foreign key constraint fk_user to comments table. It may already exist. Error: ${e.getMessage}"))
      }

    } yield ()
}