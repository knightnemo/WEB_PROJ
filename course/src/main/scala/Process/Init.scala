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
        CREATE TABLE IF NOT EXISTS ${schemaName}.user_course (
          user_name TEXT,
          course_name TEXT,
          enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_name, course_name)
        )
      """, List())
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.course_ratings (
          user_name TEXT,
          course_name TEXT,
          rating INT,
          rating_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_name, course_name)
        )
      """, List())
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.course_favorites (
          user_name TEXT,
          course_name TEXT,
          favorite_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_name, course_name)
        )
      """, List())
      _ <- writeDB(s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.courses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          instructor TEXT NOT NULL,
          description TEXT,
          rating TEXT,
          image_url TEXT,
          resource_url TEXT,
          duration_minutes INTEGER,
          difficulty_level TEXT,
          category TEXT,
          subcategory TEXT,
          language TEXT,
          prerequisites TEXT,
          interested_users TEXT
        )
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add new columns. They may already exist. Error: ${e.getMessage}"))
      }
    } yield ()
}