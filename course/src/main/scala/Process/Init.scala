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
          reviews INTEGER DEFAULT 0,
          image_url TEXT
        )
      """, List())
      //如果表已经存在了
      _ <- writeDB(s"""
        ALTER TABLE ${schemaName}.courses
        ADD COLUMN IF NOT EXISTS image_url TEXT
      """, List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to add image_url column. It may already exist. Error: ${e.getMessage}"))
      }
    } yield ()
}//这里加入了一个image_url