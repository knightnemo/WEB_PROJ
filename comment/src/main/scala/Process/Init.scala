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
  def init(config: ServerConfig): IO[Unit] = {
    given PlanContext = PlanContext(traceID = TraceID(UUID.randomUUID().toString), 0)
    for {
      _ <- API.init(config.maximumClientConnection)
      _ <- initSchema(schemaName)
      _ <- writeDB(
        s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.comments (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          content TEXT NOT NULL,
          rating INTEGER,
          created_at BIGINT NOT NULL,
          parent_id TEXT,
          FOREIGN KEY (parent_id) REFERENCES ${schemaName}.comments(id)
        )
        """,
        List()
      )
    } yield ()
  }
}