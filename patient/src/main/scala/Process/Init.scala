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
      _ <- writeDB(
        s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.user_name (
          user_name TEXT PRIMARY KEY, 
          password TEXT
        )
        """,
        List()
      )
      _ <- writeDB(
        s"""
        CREATE TABLE IF NOT EXISTS ${schemaName}.patients (
          user_name TEXT PRIMARY KEY,
          slot1 TEXT DEFAULT '0',
          slot2 TEXT DEFAULT '0',
          slot3 TEXT DEFAULT '0',
          slot4 TEXT DEFAULT '0',
          slot5 TEXT DEFAULT '0',
          slot6 TEXT DEFAULT '0',
          slot7 TEXT DEFAULT '0',
          slot8 TEXT DEFAULT '0',
          FOREIGN KEY (user_name) REFERENCES ${schemaName}.user_name(user_name)
        )
        """,
        List()
      )
    } yield ()
}