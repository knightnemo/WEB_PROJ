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
      // In Init.scala
      _ <- writeDB(s"""
  CREATE TABLE IF NOT EXISTS ${schemaName}.notifications (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    publisher TEXT NOT NULL,
    publish_time TEXT NOT NULL,
    recipients TEXT NOT NULL
  )
""", List()).attempt.flatMap {
        case Right(_) => IO.unit
        case Left(e) => IO(println(s"Note: Unable to create notifications table. It may already exist. Error: ${e.getMessage}"))
      }
    } yield ()
}