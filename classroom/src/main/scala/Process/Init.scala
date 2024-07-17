package Process

import Common.API.{API, PlanContext, TraceID}
import Global.{ServerConfig, ServiceCenter}
import Common.DBAPI.{WriteDBMessage, initSchema, writeDB}
import Common.Object.SqlParameter
import Common.API.PlanContext
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
        CREATE TABLE IF NOT EXISTS ${schemaName}.classrooms (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          capacity INT,
          slot1 VARCHAR(255) DEFAULT '0',
          slot2 VARCHAR(255) DEFAULT '0',
          slot3 VARCHAR(255) DEFAULT '0',
          slot4 VARCHAR(255) DEFAULT '0',
          slot5 VARCHAR(255) DEFAULT '0',
          slot6 VARCHAR(255) DEFAULT '0',
          slot7 VARCHAR(255) DEFAULT '0',
          slot8 VARCHAR(255) DEFAULT '0'
        )
        """,
        List()
      )
    } yield ()
}